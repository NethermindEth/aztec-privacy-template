use dep::aztec::macros::aztec;

#[aztec]
pub(crate) contract AavePrivacyAdapter {
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
        pending_deposits: Map<Field, PublicMutable<bool, Context>, Context>,
        pending_withdrawals: Map<Field, PublicMutable<bool, Context>, Context>,
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
    fn request_deposit(
        asset: Field,
        amount: u128,
        referral_code: u16,
        secret_hash: Field,
    ) -> pub Field {
        let caller = self.msg_sender().unwrap();
        assert(amount > 0, "Amount must be greater than zero");

        let owner_hash = poseidon2_hash([caller.to_field(), secret_hash]);
        let intent_id = poseidon2_hash([
            owner_hash,
            asset,
            amount as Field,
            referral_code as Field,
            1,
        ]);

        let content = poseidon2_hash([
            intent_id,
            owner_hash,
            asset,
            amount as Field,
            referral_code as Field,
            secret_hash,
        ]);

        let portal = self.storage.portal_address.read();
        self.context.message_portal(portal, content);
        AavePrivacyAdapter::at(self.context.this_address())._set_deposit_pending(intent_id).enqueue(
            self.context,
        );

        intent_id
    }

    #[external("private")]
    fn request_withdraw(asset: Field, amount: u128, secret_hash: Field) -> pub Field {
        let caller = self.msg_sender().unwrap();
        assert(amount > 0, "Amount must be greater than zero");

        let owner_hash = poseidon2_hash([caller.to_field(), secret_hash]);
        let intent_id = poseidon2_hash([owner_hash, asset, amount as Field, 2]);
        let content = poseidon2_hash([intent_id, owner_hash, asset, amount as Field, secret_hash]);

        let portal = self.storage.portal_address.read();
        self.context.message_portal(portal, content);
        AavePrivacyAdapter::at(self.context.this_address())
            ._set_withdraw_pending(intent_id)
            .enqueue(self.context);

        intent_id
    }

    #[external("private")]
    fn finalize_deposit(intent_id: Field, shares: u128, secret: Field, message_leaf_index: Field) {
        let portal = self.storage.portal_address.read();
        let content = poseidon2_hash([intent_id, shares as Field, 1]);
        self.context.consume_l1_to_l2_message(content, secret, portal, message_leaf_index);
        AavePrivacyAdapter::at(self.context.this_address())
            ._clear_deposit_pending(intent_id)
            .enqueue(self.context);
    }

    #[external("private")]
    fn finalize_withdraw(intent_id: Field, amount: u128, secret: Field, message_leaf_index: Field) {
        let portal = self.storage.portal_address.read();
        let content = poseidon2_hash([intent_id, amount as Field, 2]);
        self.context.consume_l1_to_l2_message(content, secret, portal, message_leaf_index);
        AavePrivacyAdapter::at(self.context.this_address())
            ._clear_withdraw_pending(intent_id)
            .enqueue(self.context);
    }

    #[external("public")]
    fn _set_deposit_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_deposits.at(intent_id).write(true);
    }

    #[external("public")]
    fn _set_withdraw_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_withdrawals.at(intent_id).write(true);
    }

    #[external("public")]
    fn _clear_deposit_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_deposits.at(intent_id).write(false);
    }

    #[external("public")]
    fn _clear_withdraw_pending(intent_id: Field) {
        let caller = self.msg_sender().unwrap();
        let contract_address = self.context.this_address();
        assert(caller.to_field() == contract_address.to_field(), "Unauthorized public entrypoint");
        self.storage.pending_withdrawals.at(intent_id).write(false);
    }

    #[external("public")]
    fn is_deposit_pending(intent_id: Field) -> pub bool {
        self.storage.pending_deposits.at(intent_id).read()
    }

    #[external("public")]
    fn is_withdraw_pending(intent_id: Field) -> pub bool {
        self.storage.pending_withdrawals.at(intent_id).read()
    }

}
