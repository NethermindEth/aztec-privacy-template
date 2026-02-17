// Minimal Lido-specific Noir primitives for the template's unstake flow.

pub struct LidoUnstakeInput {
    pub staker: Field,
    pub protocol: Field,
    pub amount: Field,
    pub recipient: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    2
}

pub fn encode_unstake_input(input: LidoUnstakeInput) -> Field {
    input.staker + input.protocol + input.amount + input.recipient + input.chain_nonce
}

pub fn is_unstake_amount_valid(amount: Field) -> bool {
    amount != 0
}
