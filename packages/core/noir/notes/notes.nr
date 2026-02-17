pub struct Note {
    pub owner: Field,
    pub asset: Field,
    pub amount: Field,
    pub salt: Field,
}

pub fn note_commitment(note: Note) -> Field {
    note.owner + note.asset + note.amount + note.salt
}

pub fn note_owner(note: Note) -> Field {
    note.owner
}

pub fn is_owner(note: Note, owner: Field) -> bool {
    note.owner == owner
}
