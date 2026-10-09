// Adds `tasks.timeout_ms` and the index behind the host's timeout backstop.
//
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so unlike 0001 this file is not self-guarding:
// the `migrations` row is what keeps it from running twice.
export const sql = `-- Vlo journal, SQLite. Mirror of migrations/pg/0002_task_timeout.

ALTER TABLE tasks ADD COLUMN timeout_ms INTEGER;

-- Timeout backstop: running attempts whose dispatch is older than their budget.
CREATE INDEX IF NOT EXISTS tasks_timeout_idx
  ON tasks (dispatched_at_ms)
  WHERE status = 'running' AND timeout_ms IS NOT NULL;
`;
