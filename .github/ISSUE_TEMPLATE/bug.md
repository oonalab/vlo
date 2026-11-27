---
name: Bug report
about: Something behaves differently from the docs
labels: bug
---

**Package and version**
`@oona/vlo` x.y.z / crate `vlo-…` x.y.z

**Journal and host**
SQLite or Postgres (which pooler, if any); `vlo dev`, `vlo serve`, or embedded via `createHost`; dispatcher mode.

**What happened**
Steps, the run id if you have one, and the relevant lines from `GET /v1/runs/{id}/events`
or `vlo doctor --json`.

**What you expected**

**Minimal reproduction**
A workflow + worker that shows it, or a golden fixture if it is a kernel transition.
