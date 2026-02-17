pub struct PortalMessage {
    pub l1_from: Field,
    pub l2_to: Field,
    pub asset: Field,
    pub amount: Field,
    pub nonce: Field,
}

pub fn encode_message_hash(message: PortalMessage) -> Field {
    message.l1_from + message.l2_to + message.asset + message.amount + message.nonce
}

pub fn same_message(a: PortalMessage, b: PortalMessage) -> bool {
    encode_message_hash(a) == encode_message_hash(b)
}
