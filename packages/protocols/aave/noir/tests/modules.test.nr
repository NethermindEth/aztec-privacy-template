use crate::modules::borrow::{AaveBorrowInput, encode_borrow_input, is_borrow_amount_valid};
use crate::modules::repay::{AaveRepayInput, encode_repay_input, is_repay_amount_valid};
use crate::{enable_borrow, enable_repay};

#[test]
fn borrow_module_helpers_are_deterministic() {
    let input = AaveBorrowInput {
        borrower: 1,
        asset: 2,
        amount: 3,
        chain_nonce: 4,
    };

    assert(encode_borrow_input(input) == encode_borrow_input(input));
    assert(is_borrow_amount_valid(3));
}

#[test]
fn repay_module_helpers_are_deterministic() {
    let input = AaveRepayInput {
        payer: 1,
        asset: 2,
        amount: 3,
        chain_nonce: 4,
    };

    assert(encode_repay_input(input) == encode_repay_input(input));
    assert(is_repay_amount_valid(3));
}

#[test]
fn aave_optional_modules_default_disabled() {
    assert(enable_borrow() == false);
    assert(enable_repay() == false);
}
