# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository (**Security → Report a
vulnerability**). Do not open a public issue. You will get an acknowledgement within three
business days and a fix or mitigation plan within thirty.

Please include the affected package and version (`@vlo/sdk`, `@vlo/agent`, or a crate), a
reproduction, and the impact as you understand it.

## Supported versions

Only the latest published minor of each package receives fixes.

## What Vlo protects, and how

- **API auth** is a bearer token (`auth.token`). Every `/v1/*` route rejects a missing or
  wrong token with `401 unauthorized`. `/healthz` is unauthenticated by design.
- **Pushed tasks** are signed: `vlo-signature: v1=<hmac-sha256>` over the timestamp and body
  with `auth.pushSecret`. A worker rejects unsigned, stale or tampered pushes.
- **Signal links** (`/v1/runs/{id}/links/{name}`) carry `?token=v1.<expiry>.<hmac>` derived
  from the push secret; they expire (default 7 days) and bind to one run and one signal.
- **Secrets never reach templates.** `vlo deploy` renders from a plan of names and regions;
  the journal URL, token and push secret are read only by the running host.
- **Payload caps** bound what a client can make the kernel parse; oversize payloads fail
  with `payload_too_large` before any allocation of note.

## Rotating secrets

Rotate `auth.token` and `auth.pushSecret` by deploying the new values to every role at
once; in-flight pushes signed with the old secret fail closed and are retried by the lease
reaper. Signal links signed before rotation stop working.
