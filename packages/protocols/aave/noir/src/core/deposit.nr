// Minimal Aave-specific Noir primitives for the template's deposit flow.

pub struct AaveDepositInput {
    pub receiver: Field,
    pub asset: Field,
    pub amount: Field,
    pub recipient: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    1
}

pub fn encode_deposit_input(input: AaveDepositInput) -> Field {
    input.receiver + input.asset + input.amount + input.recipient + input.chain_nonce
}

pub fn is_deposit_amount_valid(amount: Field) -> bool {
    amount != 0
}
