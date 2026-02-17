use crate::modules::queue::{LidoQueueInput, encode_queue_input, is_queue_amount_valid};
use crate::modules::yield::{LidoYieldInput, encode_yield_input, is_yield_amount_valid};
use crate::{enable_queue, enable_yield};

#[test]
fn queue_module_helpers_are_deterministic() {
    let input = LidoQueueInput {
        staker: 1,
        protocol: 2,
        amount: 3,
        chain_nonce: 4,
    };

    assert(encode_queue_input(input) == encode_queue_input(input));
    assert(is_queue_amount_valid(3));
}

#[test]
fn yield_module_helpers_are_deterministic() {
    let input = LidoYieldInput {
        staker: 1,
        reward_token: 2,
        amount: 3,
        chain_nonce: 4,
    };

    assert(encode_yield_input(input) == encode_yield_input(input));
    assert(is_yield_amount_valid(3));
}

#[test]
fn lido_optional_modules_default_disabled() {
    assert(enable_queue() == false);
    assert(enable_yield() == false);
}
