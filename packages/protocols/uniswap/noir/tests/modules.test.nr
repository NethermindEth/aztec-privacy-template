use crate::modules::lp::{UniswapLpInput, encode_lp_input, is_lp_amount_valid};
use crate::enable_lp;

#[test]
fn lp_module_helpers_are_deterministic() {
    let input = UniswapLpInput {
        operator: 1,
        token_a: 2,
        token_b: 3,
        amount_a: 4,
        amount_b: 5,
        chain_nonce: 6,
    };

    assert(encode_lp_input(input) == encode_lp_input(input));
    assert(is_lp_amount_valid(4, 5));
}

#[test]
fn lp_module_default_disabled() {
    assert(enable_lp() == false);
}
