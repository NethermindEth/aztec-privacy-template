// Minimal Aave repay primitives behind the optional repay module flag.
use crate::privacy_flags::ENABLE_REPAY;

pub struct AaveRepayInput {
    pub payer: Field,
    pub asset: Field,
    pub amount: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    4
}

pub fn encode_repay_input(input: AaveRepayInput) -> Field {
    input.payer + input.asset + input.amount + input.chain_nonce
}

pub fn is_repay_amount_valid(amount: Field) -> bool {
    amount != 0
}

pub fn is_module_enabled() -> bool {
    ENABLE_REPAY
}
