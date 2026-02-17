use dep::aztec::macros::aztec;

#[aztec]
pub(crate) contract UniswapPrivacyAdapter {
    use dep::aztec::{
        macros::{
            functions::{external, initializer},
            storage::storage,
        },
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
        pending_swaps: Map<Field, PublicMutable<bool, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress, portal_address: EthAddress) {
        assert(!admin.is_zero(), "Admin address cannot be zero");
        assert(!portal_address.is_zero(), "Portal address cannot be zero");

        self.storage.admin.write(admin);
        self.storage.portal_address.initialize(portal_address);
    }

    #[external("private")]
    fn request_swap(
        token_in: Field,
        token_out: Field,
        amount_in: u128,
        min_amount_out: u128,
        fee: u32,
        recipient: Field,
        secret_hash: Field,
    ) -> pub Field {
        let caller = self.msg_sender().unwrap();
        assert(amount_in > 0, "Amount must be greater than zero");
        assert(fee > 0, "Fee must be greater than zero");

        let owner_hash = poseidon2_hash([caller.to_field(), secret_hash]);
        let intent_id = poseidon2_hash([
            owner_hash,
            token_in,
            token_out,
            amount_in as Field,
            min_amount_out as Field,
            fee as Field,
            recipient,
            1,
        ]);

        let content = poseidon2_hash([
            intent_id,
            owner_hash,
            token_in,
            token_out,
            amount_in as Field,
            min_amount_out as Field,
            fee as Field,
            recipient,
            secret_hash,
        ]);

        let portal = self.storage.portal_address.read();
        self.context.message_portal(portal, content);
        UniswapPrivacyAdapter::at(self.context.this_address())
            ._set_swap_pending(intent_id)
            .enqueue(self.context);

        intent_id
    }

    #[external("private")]
    fn finalize_swap(intent_id: Field, amount_out: u128, secret: Field, message_leaf_index: Field) {
        let portal = self.storage.portal_address.read();
        let content = poseidon2_hash([intent_id, amount_out as Field]);
        self.context.consume_l1_to_l2_message(content, secret, portal, message_leaf_index);
        UniswapPrivacyAdapter::at(self.context.this_address())
            ._clear_swap_pending(intent_id)
            .enqueue(self.context);
    }

    #[external("public")]
    fn _set_swap_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_swaps.at(intent_id).write(true);
    }

    #[external("public")]
    fn _clear_swap_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_swaps.at(intent_id).write(false);
    }

    #[external("public")]
    fn is_swap_pending(intent_id: Field) -> pub bool {
        self.storage.pending_swaps.at(intent_id).read()
    }

}
