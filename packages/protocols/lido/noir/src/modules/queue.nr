// Minimal Lido withdrawal queue primitives behind the optional queue module flag.
use crate::privacy_flags::ENABLE_QUEUE;

pub struct LidoQueueInput {
    pub staker: Field,
    pub protocol: Field,
    pub amount: Field,
    pub chain_nonce: Field,
}

pub fn action_id() -> Field {
    3
}

pub fn encode_queue_input(input: LidoQueueInput) -> Field {
    input.staker + input.protocol + input.amount + input.chain_nonce
}

pub fn is_queue_amount_valid(amount: Field) -> bool {
    amount != 0
}

pub fn is_module_enabled() -> bool {
    ENABLE_QUEUE
}
