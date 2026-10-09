// Adds `tasks.timeout_ms` and the index behind the host's timeout backstop.
export const sql = `-- Vlo journal, Postgres. Activity timeouts.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_ms bigint;

-- Timeout backstop: running attempts whose dispatch is older than their budget.
CREATE INDEX IF NOT EXISTS tasks_timeout_idx
  ON tasks (dispatched_at_ms)
  WHERE status = 'running' AND timeout_ms IS NOT NULL;
`;
