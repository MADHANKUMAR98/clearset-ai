# ClearSet AI — Documentation Index

Every document in this repository, in one place. Start with the top three if you
have five minutes; everything else is reference.

---

## 🏆 For judges

| Document | What it is | Read time |
|---|---|---|
| [`../README.md`](../README.md) | Product story, architecture, live verification table | 10 min |
| [`JUDGE_QUICKSTART.md`](JUDGE_QUICKSTART.md) | **The 5-minute evaluation script** — credentials, URLs, exactly what to click | 5 min |
| [`DEMO_VIDEO.md`](DEMO_VIDEO.md) | Narration script with timestamps for the 2–3 min demo video | 5 min |

## 🤖 CoCo CLI (the hackathon track)

| Document | What it is |
|---|---|
| [`COCO_RUNBOOK.md`](COCO_RUNBOOK.md) | How to run `npm run coco:investigate -- <TRADE_ID>`: preflight, safety rails, `--no-history`, what a good run looks like, verification transcript |
| [`../.snowflake/cortex/skills/investigate-settlement-exception/SKILL.md`](../.snowflake/cortex/skills/investigate-settlement-exception/SKILL.md) | The skill CoCo CLI actually loads at runtime |
| [`../skills/*/SKILL.md`](../skills/) | The seven procedural skill definitions the investigation workflow mirrors |

## 🏗️ Engineering reference

| Document | What it is |
|---|---|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Layers, data flow, service abstraction, fallback semantics, feature-flag matrix |
| [`api/API.md`](api/API.md) | Every `/api/*` endpoint: method, params, sample responses, provenance labels |
| [`deployment/DEPLOYMENT.md`](deployment/DEPLOYMENT.md) | Build → push → create/upgrade → verify; rollback; local docker-compose |
| [`security/LEAST_PRIVILEGE_ROLE.md`](security/LEAST_PRIVILEGE_ROLE.md) | Moving off `ACCOUNTADMIN`: role, grants, and the judge read-only role design |
| [`../SECURITY.md`](../SECURITY.md) | Security posture summary + how to report a finding |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Versioned history (what shipped in 2.1.x) |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Branching, commit style, and the exact verification gate before a PR |

## 🗄️ Snowflake assets

| Location | What it is |
|---|---|
| [`../snowflake/`](../snowflake/) | Numbered SQL: schema → seeds → views → Cortex Search → semantic model → resolution cases → demo data → date refresh |
| [`../snowflake/00_deployment_checklist.md`](../snowflake/00_deployment_checklist.md) | Ordered checklist for provisioning a brand-new account |
| [`../snowflake/ops/cost-7d.sql`](../snowflake/ops/cost-7d.sql) | 7-day warehouse credit burn report |
| [`../scripts/migrate/`](../scripts/migrate/) | Idempotent data migration + `cutover.ps1` (staged, resumable account cutover) |
| [`../scripts/test/test-spcs.py`](../scripts/test/test-spcs.py) | Post-deploy smoke test against the running SPCS service |

## 🗃️ Archive

Superseded planning documents and hackathon workshop transcripts live in
[`archive/`](archive/). Kept for provenance — **not** current guidance.

---

### Conventions used throughout

- **Provenance labels** (`LIVE SNOWFLAKE` / `COMPUTED` / `ESTIMATE` / `LOCAL FALLBACK` /
  `DATA NOT AVAILABLE`) are a product contract, not decoration: a value never
  appears without stating where it came from.
- **Numbers are dated.** Any "verified on <date>" claim in these docs carries the
  date it was last re-run. If a doc is older than the change log entry it
  describes, trust [`CHANGELOG.md`](../CHANGELOG.md).
- **Feature flags default to off.** Documents describing the predictive engine,
  chain trace, or CoCo replay say which flag gates them.
