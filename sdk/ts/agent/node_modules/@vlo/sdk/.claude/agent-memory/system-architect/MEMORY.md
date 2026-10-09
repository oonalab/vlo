# Memory Index

- [Local Postgres for conformance](reference_local_postgres_for_conformance.md) — throwaway Homebrew PG on :55432 for `VLO_TEST_DATABASE_URL`; socket dirs must be disabled
- [Doctor: no gcs locally](feedback_doctor_no_gcs_locally.md) — `vlo doctor`'s blob check is a real round trip; a `gcs://` profile makes the agent hit GCP
- [markDispatched never applies](project_mark_dispatched_dead.md) — open defect: dispatch never records worker_id/lease; don't assert those on task rows
