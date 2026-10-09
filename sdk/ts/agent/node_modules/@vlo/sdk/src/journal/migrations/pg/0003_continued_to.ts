// Adds `runs.continued_to`: the successor a `continue_as_new` run handed its input to.
export const sql = `-- Vlo journal, Postgres. continue_as_new successor link.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS continued_to text;
`;
