---
name: doctor-no-gcs-locally
description: Never smoke-test `vlo doctor` against a profile whose blob is `gcs://` — the blob check makes a real GCS call with local ADC
metadata:
  type: feedback
---

When smoke-testing `vlo doctor`, always point the profile's `blob` at `file://`, never `gcs://`.

**Why:** the blob check is a real 1 KiB put/get round trip, so a `gcs://` profile makes the
agent's own process authenticate to Google Cloud with whatever ADC is on the machine. That
collides with the project's hard rule that agents never access GCP directly (CLAUDE.md, "No
GCP Access"). It happened once during Track B of the M1 deploy work; the call failed on a
stale `invalid_rapt` token, so nothing was read, but the attempt should not have been made.

**How to apply:** in any scratch `vlo.config.ts` used for a local CLI smoke, keep `blob` on
`file://`. If a `gcs://` profile genuinely needs checking, hand the user the
`vlo doctor --profile <name>` command to run themselves and interpret their output.
