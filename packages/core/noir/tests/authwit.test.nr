use crate::authwit::{AuthWitness, compute_auth_witness_hash, is_auth_witness_valid};

#[test]
fn auth_witness_validates_expected_hash() {
    let witness = AuthWitness {
        action: 10,
        actor: 20,
        nonce: 30,
        expiry: 40,
    };

    let hash = compute_auth_witness_hash(witness);
    assert(is_auth_witness_valid(witness, hash));
}
