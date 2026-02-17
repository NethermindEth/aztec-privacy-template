// Minimal Aave-specific Noir primitives for the template's withdraw flow.

pub struct AaveWithdrawInput {
    pub depositor: Field,
    pub asset: Field,
    pub amount: Field,
    pub recipient: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    2
}

pub fn encode_withdraw_input(input: AaveWithdrawInput) -> Field {
    input.depositor + input.asset + input.amount + input.recipient + input.chain_nonce
}

pub fn is_withdraw_amount_valid(amount: Field) -> bool {
    amount != 0
}
