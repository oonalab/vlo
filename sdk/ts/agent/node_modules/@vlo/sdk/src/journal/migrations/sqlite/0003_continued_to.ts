// Adds `runs.continued_to`: the successor a `continue_as_new` run handed its input to.
//
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so like 0002 this file is not self-guarding:
// the `migrations` row is what keeps it from running twice.
export const sql = `-- Vlo journal, SQLite. Mirror of migrations/pg/0003_continued_to.

ALTER TABLE runs ADD COLUMN continued_to TEXT;
`;
