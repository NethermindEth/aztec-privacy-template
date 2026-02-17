// Minimal Lido yield helpers behind the optional yield module flag.
use crate::privacy_flags::ENABLE_YIELD;

pub struct LidoYieldInput {
    pub staker: Field,
    pub reward_token: Field,
    pub amount: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    4
}

pub fn encode_yield_input(input: LidoYieldInput) -> Field {
    input.staker + input.reward_token + input.amount + input.chain_nonce
}

pub fn is_yield_amount_valid(amount: Field) -> bool {
    amount != 0
}

pub fn is_module_enabled() -> bool {
    ENABLE_YIELD
}
