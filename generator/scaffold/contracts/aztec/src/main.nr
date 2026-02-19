use dep::aztec::macros::aztec;

#[aztec]
pub(crate) contract GenericPrivacyAdapter {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol_types::{
            address::{AztecAddress, EthAddress},
            hash::poseidon2_hash,
            traits::ToField,
        },
        state_vars::{Map, PublicImmutable, PublicMutable},
    };

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        portal_address: PublicImmutable<EthAddress, Context>,
        pending_actions: Map<Field, PublicMutable<bool, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress, portal_address: EthAddress) {
        // `admin` and `portal_address` values should be sourced from deployment manifest/runbook.
        // See scaffold docs/DEPLOYMENT.md for environment-level configuration guidance.
        assert(!admin.is_zero(), "Admin address cannot be zero");
        assert(!portal_address.is_zero(), "Portal address cannot be zero");

        self.storage.admin.write(admin);
        self.storage.portal_address.initialize(portal_address);
    }

    // Generic request skeleton:
    // - build deterministic intent id from caller + protocol fields
    // - emit L2 -> L1 message for portal request matching
    // - mark pending intent so finalize can clear it later
    // Personalization examples:
    // - lending flow: rename `asset` -> `market_id`, `action_type` -> `position_action`
    // - swap flow: treat `asset` as `token_in`, add `token_out` + `min_out` fields
    // Keep equivalent semantics in L1 `actionData` so hash compatibility is preserved.
    #[external("private")]
    fn request_action(
        asset: Field,
        amount: u128,
        action_type: Field,
        secret_hash: Field,
    ) -> pub Field {
        let caller = self.msg_sender().unwrap();
        assert(amount > 0, "Amount must be greater than zero");

        let owner_hash = poseidon2_hash([caller.to_field(), secret_hash]);
        let intent_id = poseidon2_hash([owner_hash, asset, amount as Field, action_type]);
        let content = poseidon2_hash([
            intent_id,
            owner_hash,
            asset,
            amount as Field,
            action_type,
            secret_hash,
        ]);

        let portal = self.storage.portal_address.read();
        self.context.message_portal(portal, content);
        GenericPrivacyAdapter::at(self.context.this_address())._set_pending(intent_id).enqueue(
            self.context,
        );

        intent_id
    }

    // Generic finalize skeleton:
    // - consume portal completion message
    // - clear pending intent state
    // Payload compatibility contract:
    // - this `content` hash MUST match the L1 success-path completion payload emitted by GenericPortal
    // - if you change completion fields here, update L1 completion construction + relayer transport logic
    // Example: if finalize requires `result_fee`, include it in both L1 completion payload and this hash.
    #[external("private")]
    fn finalize_action(
        intent_id: Field,
        result_amount: u128,
        secret: Field,
        message_leaf_index: Field,
    ) {
        let portal = self.storage.portal_address.read();
        let content = poseidon2_hash([intent_id, result_amount as Field]);
        self.context.consume_l1_to_l2_message(content, secret, portal, message_leaf_index);
        GenericPrivacyAdapter::at(self.context.this_address())._clear_pending(intent_id).enqueue(
            self.context,
        );
    }

    #[external("public")]
    fn _set_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_actions.at(intent_id).write(true);
    }

    #[external("public")]
    fn _clear_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_actions.at(intent_id).write(false);
    }

    #[external("public")]
    fn is_pending(intent_id: Field) -> pub bool {
        self.storage.pending_actions.at(intent_id).read()
    }
}
