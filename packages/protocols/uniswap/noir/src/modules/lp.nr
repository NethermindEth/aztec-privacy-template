// Minimal Uniswap LP primitives behind the optional LP module flag.
use crate::privacy_flags::ENABLE_LP;

pub struct UniswapLpInput {
    pub operator: Field,
    pub token_a: Field,
    pub token_b: Field,
    pub amount_a: Field,
    pub amount_b: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    2
}

pub fn encode_lp_input(input: UniswapLpInput) -> Field {
    input.operator
        + input.token_a
        + input.token_b
        + input.amount_a
        + input.amount_b
        + input.chain_nonce
}

pub fn is_lp_amount_valid(amount_a: Field, amount_b: Field) -> bool {
    amount_a != 0 && amount_b != 0
}

pub fn is_module_enabled() -> bool {
    ENABLE_LP
}
