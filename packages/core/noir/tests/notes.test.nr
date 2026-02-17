use crate::notes::{Note, is_owner, note_commitment};

#[test]
fn note_commitment_is_deterministic() {
    let note = Note {
        owner: 1,
        asset: 2,
        amount: 3,
        salt: 4,
    };

    assert(note_commitment(note) == note_commitment(note));
    assert(is_owner(note, 1));
}
