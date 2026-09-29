# Changelog

All notable changes to ClearSet AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- *Nothing pending — everything below in 2.1.2 is merged.*

## [2.1.2] - 2026-09-29

### Added
- `docs/README.md`: single navigation index for every document in the repo
- `SECURITY.md`: security policy — reporting path, in-scope areas, controls in place, accepted limitations
- `docs/archive/README.md` + `docs/archive/`: workshop transcripts and superseded planning documents moved out of the repository root (content preserved, links still resolve)
- `docs/security/` (role-hardening guide), `scripts/test/test-spcs.py`, `snowflake/ops/cost-7d.sql` — structural homes for files that had been sitting in the root
- README badges (tests / lint / license / node / hackathon) and a *Documentation Map* section

### Fixed
- **Judges could not have used the deployed app** — found by authenticating as `CLEARSET_JUDGE` and exercising every SQL path the server runs. Three independent defects, all fixed:
  1. `server/snowflakeClient.ts` pinned `role: SNOWFLAKE_ROLE` (`ACCOUNTADMIN` in `service-spec.yaml`) onto the SPCS OAuth connection. The injected token belongs to the signed-in user, so every judge session was refused at login (`250001 / 08001 Role 'ACCOUNTADMIN' ... not granted to this user`) and every SQL-backed page would have failed. The OAuth path no longer forces a role — each request runs as the signed-in user's own default role (`CLEARSET_JUDGE_ROLE` for judges, the admin's own role for us); `SNOWFLAKE_ROLE` was removed from the service spec.
  2. `CLEARSET_JUDGE_ROLE` had **no warehouse grant**, so even correctly-roled queries failed with `000606 No active warehouse`. Judge grants went 21 → **25**: `USAGE ON WAREHOUSE COMPUTE_WH`, `USAGE ON CORTEX SEARCH SERVICE ...CLEARSET_POLICY_SEARCH_SERVICE`, `SELECT ON SEMANTIC VIEW ...CLEARSET_ANALYTICS`, and the `SNOWFLAKE.CORTEX_ANALYST_USER` database role that the Cortex Analyst REST API requires (it was only on `ACCOUNTADMIN`/`SNOWFLAKE`/`PUBLIC`).
  3. Re-verified as the judge after the fix: views and tables read fine (`COMPUTE_WH`, 21 exceptions), `SNOWFLAKE.CORTEX.SEARCH_PREVIEW` returns 3 SOP hits, the semantic view is visible — and `CREATE TABLE` is still refused with `42501 Insufficient privileges`, so read-only is enforced by privilege, not by convention.
- **CI ran scripts that do not exist** (`npm run test:unit`, `npm run test:integration`) → the workflow now runs `npm run server:test` (45 tests); the phantom integration job was removed and deploy/smoke jobs now skip cleanly when repository secrets are absent
- **`npm ci` failed on Linux runners**: two `os: win32`-only native bindings were pinned as hard devDependencies (they are already optional dependencies of `oxlint`/`rolldown`) — removed, lockfile regenerated
- **`make verify` / `make test` were broken** (they called non-existent npm scripts); `make migrate`/`make seed` pointed at a file path that no longer exists
- `.gitignore`'s `migrate/` pattern was silently ignoring `scripts/migrate/` (the cutover tooling) — scoped to the repository root
- Judge expiry corrected to **≈ 2026-11-03** in README, judge quickstart and deployment guide; 15 machine-local `file:///e:/…` links in `snowflake/*.md` converted to repository-relative links; `your-org` placeholder links pointed at the real repository
- README claimed a proprietary licence while the repository ships MIT; claimed 37 tests while the suite has 42

### Changed
- Repository root reduced to standard project files only (15 scratch/shell-accident files and stale one-off scripts deleted)
- README project-structure tree rewritten to match the tree as it actually stands (routes, hooks, feature-flag panels, migrate tooling, docs layout)
- `CONTRIBUTING.md` testing section rewritten to the real gate (`server/test/*.test.mjs`, `make verify`) instead of non-existent `tests/unit` · `tests/integration` · `tests/e2e` suites
- `snowflake/00_deployment_checklist.md` now documents steps 6–10 (semantic view, resolution cases, demo expansion, date refresh) and the scripted cutover path actually used for this account
- `package.json` identity set to `clearset-ai@2.1.1` (was `madhan@0.0.0`)
- **CoCo CLI replay made judge-visible**: the investigation prompt now requires a `STEP <n> - <TITLE>` header for all 10 sections, and the replay parser understands provenance labels behind list markers (`1. [LIVE SNOWFLAKE] ...`) while rejecting decorative ruling from highlights — a live re-run produced 11 sections and 56 labelled evidence lines instead of 4 sections and 5 lines
- `VITE_COCO_CLI_REPLAY` enabled for the production bundle; the recorded `TRD-92831` investigation is committed at `public/coco-replay.json`, so a judge can watch a real run without needing CoCo credits
- Measured run figures documented in the README (4 min 28 s wall clock, 91/100 independent match) with an explicit note that no manual-baseline "time saved" claim is made
- Redeployed to SPCS with image digest `sha256:1559651f2b4bb50a61ace70ea311edb078d6498b4efc762d859e5c698448cb5c` (spec digest `28cb2192…`); instance `READY`, `authentication successful using: OAUTH`, ingress still 302-gated

## [2.1.1] - 2026-09-29

### Added
- `scripts/migrate/cutover.ps1`: scripted account cutover — stages 0–5 = connection resolve → connectivity → **CoCo CLI GO/NO-GO gate** → provision (schema/DDL incl. Cortex Search + `RESOLUTION_CASES`) → data migration → verification. Migration only proceeds if CoCo answers (proven live: `COCO_OK`).
- Image repository `CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_REPO`, compute pool `CLEARSET_POOL` (`CPU_X64_S`, 1 node, auto-suspend 300s) and service `CLEARSET_AI` on the new account.
- Semantic view `CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_ANALYTICS` created from `snowflake/07_semantic_model_CORRECTED.yaml` via `SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML` (required by the Cortex Analyst route).
- Authentication policy `CLEARSET_PAT_POLICY` (`PAT_POLICY = NETWORK_POLICY_EVALUATION = ENFORCED_NOT_REQUIRED`) — PAT auth without a network policy; plus a local-dev PAT (`CLEARSET_LOCAL_DEV`, 90 days) in `server/.env`.

### Fixed
- `scripts/migrate/migrate_all.py` now seeds the 8 expansion **counterparties** (`CP-301`–`CP-308`); without them `V_EXCEPTIONS_ENRICHED` inner-joined only 5 of 21 exceptions on a fresh account.

### Changed
- Migrated to hackathon account `LHBBRSO-DZ87434` (locator `WL10034`, Enterprise) — `clearset-hack` connection; production URL `https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app`; registry `lhbbrso-dz87434.registry.snowflakecomputing.com`. Previous account `EBGEXCW-LY21740` retained untouched as fallback.
- Redeployed with image digest `sha256:c0956ebaacbf974f637b94edc6e23c2c41d4c206de7c3b690e52e851c4ae8f35` (spec digest `09eb70a1…`), `PREDICTIVE_ENGINE_ENABLED=true`, instance `READY`.
- `migrate_all.py` / `repair_demo_data.py` default connection and all docs/Makefile/CI/test references point at `clearset-hack`; judge role granted 21 privileges (parity) with ~36-day expiry covering the evaluation window.

## [2.1.0] - 2026-09-29

### Added
- **Predictive Failure Prevention** (`/api/predict` + Predictive panel): per-exception failure probability, risk drivers, recommended actions, live model metrics — gated by `PREDICTIVE_ENGINE_ENABLED` / `VITE_PREDICTIVE_ENGINE`
- **Settlement Chain Trace**: hop-by-hop SWIFT/depository visualiser with inter-hop latency and cutoff clock — gated by `VITE_SETTLEMENT_CHAIN_VIZ`
- **SWIFT MT599 prevention draft**: generated from a prediction, watermarked *DRAFT — AWAITING HUMAN APPROVAL*, never transmitted
- **CoCo CLI replay artefact**: `scripts/coco_investigate.mjs` parses a successful `cortex exec` run into `public/coco-replay.json` for the in-app replay panel (`VITE_COCO_CLI_REPLAY`), and prints actionable remediation when Snowflake entitlement is missing
- `docs/DEMO_VIDEO.md`: shot-by-shot recording script

### Fixed
- Duplicate rows in `V_EXCEPTIONS_ENRICHED` (SECURITIES/COUNTERPARTIES were double-loaded; deduped and missing seed trades/SSI/events restored via `scripts/migrate/repair_demo_data.py`) — queue now returns 21 distinct exceptions
- `scripts/migrate/migrate_all.py` made idempotent so re-runs cannot duplicate seed data

### Changed
- Redeployed to SPCS with image digest `sha256:6db647b6f4b4eaabe4fe549a328b4c7efd36f958606b57d4912dd676bf7e2461`; service spec now carries `PREDICTIVE_ENGINE_ENABLED=true` (rollback = flip the flag)

## [2.0.0] - 2026-09-27

### Added
- **Impact Metrics Panel** (`/api/metrics`): Operational impact metrics including open fail exposure, critical exposure, CSDR accrual estimates, and approval throughput
- **CoCo CLI Integration**: Genuine `cortex exec` investigations via registered skill `investigate-settlement-exception`
- **Audit-Ready PDF Reports**: Evidence-grade resolution reports from `RESOLUTION_CASES` with deterministic factors, Cortex evidence, and SWIFT event history
- **Cortex Search Service**: 5 SOP policy chunks with search attributes
- **Cortex Analyst Semantic Model**: `CLEARSET_ANALYTICS` with 6 tables and full relationships
- **Demo Data Expansion**: 35 trades, 21 exceptions, 13 exception types across 13 counterparties
- **Judge Access**: `CLEARSET_JUDGE` user with read-only role, auto-expiring credentials

### Changed
- Migrated from account `CVSCEVX-CK13255` to `EBGEXCW-LY21740`
- Updated production URL to `https://eafhmc-ebgexcw-ly21740.snowflakecomputing.app`
- New Docker image digest: `sha256:d84844965c145dce7d47400f7e46e0961b827fcd7f535ce9bbacf84d6ff620ee`
- New compute pool: `CLEARSET_POOL` (CPU_X64_S)
- New image registry: `ebgexcw-ly21740.registry.snowflakecomputing.com`

### Security
- New PAT generated for production account
- Judge user with read-only grants and 36-day expiry
- Service role granted for SPCS ingress access
- No credentials baked into Docker image

### Fixed
- Cortex Search service creation on trial account (graceful fallback)
- PARSE_JSON in VALUES clause (replaced with SELECT/UNION ALL)
- Docker registry authentication flow

## [1.5.0] - 2026-08-23

### Added
- **Audit-Ready Resolution Reports**: PDF generation from `RESOLUTION_CASES` with deterministic factors, SWIFT events, and Cortex evidence
- **Cortex Analyst Integration**: Natural language queries via semantic model
- **Cortex Search Integration**: SOP retrieval with 5 policy chunks
- **Resolution Cases Table**: `RESOLUTION_CASES` audit ledger with approval workflow
- **Cases View**: Full case management UI with audit PDF generation

### Changed
- Migrated to SPCS production deployment
- OAuth-only runtime authentication
- Health check endpoint for SPCS readiness probe

## [1.0.0] - 2026-08-15

### Added
- Initial ClearSet AI release
- React 19 frontend with Vite
- Express/TypeScript backend
- Snowflake integration with dual auth (password local / OAuth SPCS)
- Deterministic risk scoring (0-100)
- 10-step investigation workflow
- Exception queue with risk scoring
- Dashboard with risk tiles and charts
- CoCo CLI skills (7 registered)
- Snowflake schema with 10 tables
- Demo data: 5 trades, 5 counterparties, 5 securities

---

## Version History Summary

| Version | Date | Key Milestone |
|---------|------|---------------|
| 2.0.0 | 2026-09-27 | Hackathon submission: Metrics, CoCo CLI, Audit PDF, Judge Access |
| 1.5.0 | 2026-08-23 | SPCS Production, Audit Reports, Cortex AI |
| 1.0.0 | 2026-08-15 | Initial Release |

---

*Generated with [Keep a Changelog](https://keepachangelog.com/)*
