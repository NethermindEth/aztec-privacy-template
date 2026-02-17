use crate::messaging::{PortalMessage, encode_message_hash, same_message};

#[test]
fn message_hash_matches_when_same() {
    let a = PortalMessage {
        l1_from: 1,
        l2_to: 2,
        asset: 3,
        amount: 4,
        nonce: 5,
    };

    let b = PortalMessage {
        l1_from: 1,
        l2_to: 2,
        asset: 3,
        amount: 4,
        nonce: 5,
    };

    assert(same_message(a, b));
    assert(encode_message_hash(a) == encode_message_hash(b));
}
