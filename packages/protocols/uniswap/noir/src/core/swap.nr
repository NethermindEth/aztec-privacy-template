// Minimal Uniswap-specific Noir primitives for the template's swap flow.

pub struct UniswapSwapInput {
    pub sender: Field,
    pub token_in: Field,
    pub token_out: Field,
    pub amount_in: Field,
    pub min_amount_out: Field,
    pub fee_bps: Field,
    pub recipient: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    1
}

pub fn encode_swap_input(input: UniswapSwapInput) -> Field {
    input.sender
        + input.token_in
        + input.token_out
        + input.amount_in
        + input.min_amount_out
        + input.fee_bps
        + input.recipient
        + input.chain_nonce
}

pub fn is_swap_amount_valid(amount: Field) -> bool {
    amount != 0
}
