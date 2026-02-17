pub struct AuthWitness {
    pub action: Field,
    pub actor: Field,
    pub nonce: Field,
    pub expiry: Field,
}

pub fn compute_auth_witness_hash(wit: AuthWitness) -> Field {
    wit.action + wit.actor + wit.nonce + wit.expiry
}

pub fn is_auth_witness_valid(wit: AuthWitness, expected: Field) -> bool {
    compute_auth_witness_hash(wit) == expected
}

pub fn is_expired(wit: AuthWitness) -> bool {
    wit.expiry == 0
}
