// Minimal Aave borrow primitives behind the optional borrow module flag.
use crate::privacy_flags::ENABLE_BORROW;

pub struct AaveBorrowInput {
    pub borrower: Field,
    pub asset: Field,
    pub amount: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    3
}

pub fn encode_borrow_input(input: AaveBorrowInput) -> Field {
    input.borrower + input.asset + input.amount + input.chain_nonce
}

pub fn is_borrow_amount_valid(amount: Field) -> bool {
    amount != 0
}

pub fn is_module_enabled() -> bool {
    ENABLE_BORROW
}
