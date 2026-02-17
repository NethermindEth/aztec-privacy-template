// Minimal Lido-specific Noir primitives for the template's stake flow.

pub struct LidoStakeInput {
    pub staker: Field,
    pub protocol: Field,
    pub amount: Field,
    pub recipient: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    1
}

pub fn encode_stake_input(input: LidoStakeInput) -> Field {
    input.staker + input.protocol + input.amount + input.recipient + input.chain_nonce
}

pub fn is_stake_amount_valid(amount: Field) -> bool {
    amount != 0
}
