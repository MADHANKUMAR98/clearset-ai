# Security Policy

ClearSet AI handles simulated settlement data inside a Snowflake account. This
file summarises the controls in place and how to raise a concern.

## Reporting a vulnerability

Please report security findings **privately** before opening a public issue:

- Open a private security advisory on this repository, **or**
- Contact the maintainers directly with the details (reproduction steps, affected
  endpoint or file, impact).

We aim to acknowledge within 2 business days. For a hackathon submission, a
privately messaged report to the team is equally welcome.

## What is in scope

| Area | Notes |
|---|---|
| Snowflake credentials, PATs, OAuth tokens | Must never appear in git, images, logs, or client bundles |
| Authorization on the API surface | Read/write behaviour of `/api/*`, especially approval-gated routes |
| SQL construction | All queries must stay parameterised (`?` bindings) |
| The human-approval gate | Any path that performs an operational action without approval is a critical finding |

## Controls currently in place

- **Secret isolation** — all credentials live in `server/.env` (gitignored and
  untracked). The Docker build explicitly excludes `.env*` and token files, and
  the image is scanned for secret patterns before deploy.
- **No credentials in the browser** — the SPA talks only to `/api/*`; Snowflake
  credentials never reach the client bundle.
- **OAuth-only at runtime in production** — the container reads the session token
  from `/snowflake/session/token` per request cycle; nothing is baked into the image.
- **Parameterised SQL everywhere** — no string interpolation of user input.
- **Least privilege** — running as `ACCOUNTADMIN` is explicitly temporary;
  the migration path to dedicated roles is documented in
  [`docs/security/LEAST_PRIVILEGE_ROLE.md`](docs/security/LEAST_PRIVILEGE_ROLE.md).
- **PAT network policy** — `CLEARSET_PAT_POLICY` is attached to the service user
  so tokens are not usable from arbitrary networks.
- **Read-only judge access** — judge credentials are time-boxed and their role
  cannot write; the expiry is enforced by Snowflake, not by the app.
- **Audit trail** — every human approval is persisted to `RESOLUTION_CASES` with
  approver identity and timestamp.

## Non-goals / accepted limitations

- The local development fallback layer ships synthetic data for offline demos.
  It is clearly labelled `LOCAL FALLBACK` in the UI and is never used to perform
  operational actions.
- Slack notifications, if configured, intentionally carry exception summaries
  only — no credentials and no customer PII beyond trade identifiers.

## Supported versions

Only the version currently deployed to SPCS (see [`CHANGELOG.md`](CHANGELOG.md))
is supported. Rollback is a service-spec flag flip or an image-tag re-point;
see [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md).
