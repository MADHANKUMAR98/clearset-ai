<div align="center">

# ⚡ ClearSet AI — Post-Trade Settlement Copilot

### *The copilot that refuses to lie to you.*

**Snowflake-Native Domain-Specific AI Copilot for Capital Markets Post-Trade Operations**

*Detect • Investigate • Explain • Approve — with guaranteed human-in-the-loop control.*

`React 19` · `TypeScript` · `Express` · `Snowflake Cortex` · `SPCS Production`

![tests](https://img.shields.io/badge/tests-45%20passing-brightgreen) ![lint](https://img.shields.io/badge/lint-oxlint%200%20errors-blue) ![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node-%E2%89%A520-green) ![Snowflake](https://img.shields.io/badge/Snowflake-CoCo%20Hackathon%202026-red)

---

**🔴 LIVE IN PRODUCTION → [eabwoc-lhbbrso-dz87434.snowflakecomputing.app](https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app)** *(Snowflake SSO required)*

**⏱️ Judges: instant access**
| Field | Value |
|-------|-------|
| **URL** | https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app |
| **Username** | `CLEARSET_JUDGE` |
| **Password** | `JudgeDemo26` |
| **Expires** | ≈ **2026-11-03** (time-boxed, auto-disables itself) |
| **Role** | Read-only — writes blocked at privilege level |

**📋 Full evaluation script → [docs/JUDGE_QUICKSTART.md](docs/JUDGE_QUICKSTART.md)**

Image digest `sha256:1559651f…` · Container `READY` · Restarts `0` · Auth `OAUTH only`

</div>

---

## 🎬 The Two-Minute Story

It's 4:47 PM on settlement date. A **$2.4M Apple DVP trade at DTC has no instruction**. The cutoff is in 90 minutes. In the real world right now, a human is squinting at six systems, three spreadsheets, and a chat window — hoping they don't miss something that triggers a **CSDR Article 7 cash penalty**, a replacement-cost buy-in, or worse, a counterparty credit event.

Settlement failures cost institutional banks **billions annually**. Not because analysts are bad — because the truth is scattered across depositories, SSIs, SOPs, and history, and nobody can see it all at once.

**ClearSet AI puts the whole truth on one screen** — and then makes the AI show its receipts before it's allowed to do anything.

> 🧠 **The curious part:** every number in this app carries a label telling you where it came from — `LIVE SNOWFLAKE`, `COMPUTED`, or `DATA NOT AVAILABLE`. If the AI doesn't know, it says so. We built a copilot whose most impressive feature is admitting ignorance.

---

## 🎯 Hackathon Track & Problem Statement

| | |
|---|---|
| **Event** | Snowflake CoCo CLI Hackathon 2026 — GCC Edition |
| **Track** | Domain-Specific AI Copilot |
| **Domain** | Financial Services / Capital Markets / Post-Trade Operations |
| **Standards covered** | DVP/RVP · SSI validation · SWIFT MT541/548/599 · ISO 20022 · CSDR Settlement Discipline · Depository cutoff surveillance (DTC, Fedwire, Euroclear) |
| **Persona** | Post-Trade Ops Analysts, Settlement Specialists & Exception Desk Leads |

---

## 💡 What It Actually Does

Five moves, one deterministic loop:

1. **🔍 Surveillance & Detection** — A live exception queue across 35 institutional trades (equities, treasuries, FX) spanning **13 distinct exception types**: missing instructions, cash discrepancies, SSI mismatches, counterparty freezes, past-cutoff stragglers…
2. **🎲 Deterministic Risk Scoring (0–100)** — A mathematical, non-hallucinatory formula blending time-to-cutoff urgency, SSI status, trade size exposure, counterparty failure friction, and historical precedent. Every point traces to a rule. Ask it *"why 91?"* and it shows you the math.
3. **🪜 Procedural Investigation (10-Step Workflow)** — Autonomous verification marching through trade master data → depository gateway statuses → SSI directories → 30-day counterparty failure rates → similar historical cases → binding SOP sections. Like a senior operator's checklist, executed by software.
4. **🧵 Evidence Traceability** — Complete visual lineage from *"WHY is this trade critical?"* straight into supporting telemetry, historical playbooks, and the exact SOP paragraph that governs the fix.
5. **🤝 Human-in-the-Loop Authorization** — The AI recommends (e.g., *SWIFT MT599 expedited repair + desk escalation*) — but the **dispatch button stays locked until a human clicks Approve**. No exceptions. By design.

---

## 🤖 Genuine CoCo CLI Integration

This is not a mock agent. ClearSet ships a **registered Cortex Code skill** and a launcher that drives the real CoCo CLI (`cortex exec`) against live Snowflake:

```bash
npm run coco:investigate -- TRD-92831
```

- **Skill:** `investigate-settlement-exception` (`.snowflake/cortex/skills/` — visible in `cortex skill list`)
- **Launcher:** `scripts/coco_investigate.mjs` — preflights app health, writes the prompt via `--file` (shell-quoting-safe), runs `cortex exec --allowed Bash --max-turns 60`, enforces ID validation
- **The agent does real work:** it discovers `snowsql` on its own, queries `TRADES`/`EXCEPTIONS`/`COUNTERPARTIES`/`SETTLEMENT_EVENTS` itself, cross-references SOPs, and produces a structured investigation ending in `AWAITING ANALYST AUTHORISATION`
- **Verified live** on both hero trades with zero field drift vs raw SQL ground truth — and zero cross-contamination between runs (`--no-history`)
- **Measured run (2026-09-29):** 4 min 28 s wall clock → all 10 steps, 11 replay sections, **56 provenance-labelled evidence lines** (45 `LIVE SNOWFLAKE`, 7 `COMPUTED`, 2 `CORTEX ANALYST`, 1 `CORTEX SEARCH`), deterministic score **91/100** independently matching Snowflake's stored score. We deliberately claim no "minutes saved" figure — the manual baseline was never instrumented, and a made-up number would undermine everything else in this README.
- **Replayable without CoCo credits:** every successful run is written to `public/coco-replay.json` and shown by the in-app **CoCo CLI Replay** panel, so an evaluator can step through a real investigation even if the account's CoCo entitlement is unavailable at judging time.
- Full procedure, safety notes, and verification transcript: [`docs/COCO_RUNBOOK.md`](docs/COCO_RUNBOOK.md)

---

## 📄 Audit-Ready Resolution Reports

Every human-approved case can generate an evidence-grade PDF from `RESOLUTION_CASES` + live trade/counterparty/depository joins + fresh Cortex retrieval at generation time:

```bash
curl -o report.pdf http://localhost:3001/api/cases/<CASE_ID>/report
```

Deterministic factor math, root cause, recommendation, approval identity/timestamps, SWIFT event history, and the exact SOP paragraphs retrieved *that minute* — every value sourced, unavailable evidence labeled unavailable. Read-only: generation triggers no operational action.

---

## 📊 Operational Impact Metrics

`GET /api/metrics` computes judge-facing impact numbers live from Snowflake — open fail exposure, critical exposure, estimated CSDR-style accrual (documented modeling assumption, labeled `ESTIMATE`), and human-approval throughput with `CREATED_AT → APPROVED_AT` turnaround. Rendered as an additive dashboard tile; honest `DATA NOT AVAILABLE` when Snowflake is unreachable.

---

## 🌟 Meet the Hero Cases

Two protected production records you'll see throughout the app:

<table>
<tr><th></th><th>Case 1</th><th>Case 2</th></tr>
<tr><td><b>Trade</b></td><td><code>TRD-92831</code> — $2.4M AAPL (DVP @ DTC)</td><td><code>TRD-81232</code> — $8.1M US Treasury (DVP @ Fedwire)</td></tr>
<tr><td><b>Exception</b></td><td>Missing Instruction</td><td>Cash Discrepancy</td></tr>
<tr><td><b>Risk Score</b></td><td><b>91/100</b> 🔴</td><td><b>89/100</b> 🔴</td></tr>
<tr><td><b>Counterparty</b></td><td>CP-192 Apex Prime Clearing</td><td>CP-104 Vanguard Global Markets</td></tr>
<tr><td><b>Status</b></td><td>OPEN</td><td>INVESTIGATING</td></tr>
</table>

> ⚖️ **Provenance in action:** when Snowflake's live score differs from the deterministic calculation, the UI shows both — e.g. `⚠ Live Snowflake: 89 | Deterministic: 84` — and explains why (Snowflake's score weighs actual historical precedent at 11 pts vs the frontend baseline's 6 pts). Transparency over false precision, always.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         REACT 19 UI LAYER                                  │
│   Dashboard  •  Exceptions Queue  •  Investigation Workspace  •  Copilot   │
│               Cases Ledger  •  Policies & SOP Knowledge                    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION CONTEXT (AppContext.tsx)                    │
│   exceptions • activeSettlementEvents • activeSettlementInstruction        │
│   backendMode (live | local | checking) • dashboardMetrics                 │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     SERVICE INTERFACE ABSTRACTION LAYER                    │
│                            (src/services/types.ts)                         │
├──────────────────────┬──────────────────────┬──────────────────────────────┤
│  ISettlementService  │   IKnowledgeService  │       ICortexService         │
│  HybridSettlement    │   HybridKnowledge    │     HybridCortex             │
│  (Live → Fallback)   │  (Cortex Search →    │  (Cortex Analyst →           │
│                      │   Local POLICY_DOCS) │   Local keyword match)       │
└──────────┬───────────┴──────────────────┬───┴──────────────────┬───────────┘
           │                              │                      │
           ▼                              ▼                      ▼
┌───────────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       BACKEND PROXY (server/ — Node+Express+TS)   │ │        LIVE SNOWFLAKE PLATFORM       │
│  GET  /api/health              POST /api/cortex/search   │ • CLEARSET_DB.CLEARSET_SCHEMA        │
│  GET  /api/test-snowflake      POST /api/cortex/analyst  │ • Cortex Search: POLICY_SEARCH_SVC   │
│  GET  /api/exceptions          GET  /api/trades          │ • Cortex Analyst: CLEARSET_ANALYTICS │
│  GET  /api/counterparties/:id  GET  /api/settlement-…    │ • Semantic View (Autopilot-built)    │
│  GET/POST /api/cases                                     │ • RESOLUTION_CASES audit ledger      │
│                                                          └──────────────────────────────────────┘
│  Auth: Snowflake SDK (local) / injected OAuth (SPCS)      ┌──────────────────────────────────────┐
│        PAT Bearer token for Cortex Analyst REST API       │       LOCAL FALLBACK LAYER           │
└───────────────────────────────────────────────────────────┤ • syntheticData.ts • knowledgeBase.ts│
                                                            │ • Full offline simulation            │
                                                            │ • Always intact — never removed      │
                                                            └──────────────────────────────────────┘
```

**Design principle:** the fallback isn't a stub — it's a complete parallel universe. Unplug Snowflake and the entire console keeps working, clearly labeled as simulation. Plug it back in and everything re-labels itself `LIVE SNOWFLAKE`.

---

## ✅ Implementation Status — Shipped

| Stage | Description | Status |
|-------|-------------|--------|
| **1. Foundation** | Node.js/Express/TypeScript backend, health check, Snowflake connection pool, Vite proxy | ✅ |
| **2. Live Data** | 8 Snowflake-backed endpoints with graceful local fallback | ✅ |
| **3. Cortex AI** | Cortex Search + Cortex Analyst (real REST calls, real retrieval) | ✅ |
| **4. Full Integration** | React UI ↔ live backend, dynamic dashboard, provenance badges everywhere | ✅ |
| **5. Case Persistence** | `RESOLUTION_CASES`, parameterized writes, full human-approval workflow | ✅ |
| **6. Demo Data Expansion** | 35 trades / 21 exceptions / 13 exception types; date-refresh script keeps cutoffs forever-fresh (`snowflake/10`) | ✅ |
| **7. UI Polish Pass** | Shared primitives & design tokens, skeleton loading, severity rails, motion, focus rings | ✅ |
| **8. Release Audit** | Secrets sweep, image scan, code review — zero findings | ✅ |
| **9. SPCS Deployment** | Built → pushed → upgraded → verified RUNNING/OAUTH/READY | ✅ |
| **10. Slack Alerts** | Optional critical-exception notifications — never bypasses approval gate | ✅ |
| **11. Audit PDF Reports** | Evidence-grade report per approved case; deterministic + Cortex evidence | ✅ |
| **12. CoCo CLI Integration** | Genuine `cortex exec` investigations via registered skill, live-verified | ✅ |
| **13. Impact Metrics** | Live exposure & approval-throughput metrics with honest estimates | ✅ |
| **14. Predictive Failure Prevention** | Per-exception failure probability, risk drivers, recommended actions, live model metrics | ✅ |
| **15. Settlement Chain Trace** | Hop-by-hop SWIFT/depository visualiser with inter-hop latency + cutoff clock | ✅ |
| **16. CoCo Replay & Prevention Draft** | In-app replay of the recorded CoCo investigation + SWIFT MT599 draft behind human approval | ✅ |

### 🎛️ Feature Flags (safe rollout → zero-touch rollback)

Each wow feature ships **behind a flag that defaults to off**, so the core
product never changes shape: the API route returns `404` and the panel renders
nothing. Flipping the flag back *is* the rollback — no schema change, no
service-spec change, no redeploy.

| Frontend flag | Backend guard | What it turns on |
|---|---|---|
| `VITE_PREDICTIVE_ENGINE` | `PREDICTIVE_ENGINE_ENABLED` | `/api/predict` + Predictive Failure Prevention panel |
| `VITE_SETTLEMENT_CHAIN_VIZ` | *(reuses existing events API)* | Settlement Chain Trace panel |
| `VITE_COCO_CLI_REPLAY` | *(static artefact)* | CoCo CLI Investigation Replay panel |

Documented in `.env.example` and `server/.env.example`. Current local demo
settings live in `.env` (git-ignored).

**Currently deployed state:** service spec carries `PREDICTIVE_ENGINE_ENABLED=true`,
and the production bundle is built with all three `VITE_*` flags **on** (the
replay panel reads the committed artefact `public/coco-replay.json`). Rolling any
of them back is a one-line flag flip plus a rebuild — no schema change, no
service-spec change.

---

## 📋 Verified Against Live Snowflake

Every endpoint exercised against `CLEARSET_DB.CLEARSET_SCHEMA`:

| Endpoint | Latest verified result |
|----------|------------------------|
| `GET /api/health` | `{ mode: "snowflake", snowflake: true }` |
| `GET /api/exceptions` | **21 rows**, 13 exception types, EX-92831 ranked by risk 91 |
| `GET /api/trades` | **35 rows**, TRD-92831 & TRD-81232 intact |
| `GET /api/counterparties/CP-192` | Apex Prime Clearing Ltd. |
| `GET /api/settlement-events/TRD-92831` | Full SWIFT event timeline |
| `GET /api/cases` | Audit ledger (empty until a human approves — correct) |
| `POST /api/cases` | Parameterized INSERT verified; test row cleaned up |
| `POST /api/cortex/search` | Returns SOP-3.2 for TRD-92831, SOP-2.4 for TRD-81232 |
| `POST /api/cortex/analyst` | TRD-92831 → 91/MISSING · TRD-81232 → 89/MISMATCHED |
| `GET /api/cases/:caseId/report` | PDF 200 — factors, Cortex evidence, approval stamp (smoke-verified on pushed artifact) |
| `GET /api/metrics` | `{ openExceptionCount: 19, openExceptionValueUSD: 74605000, casesApproved: 2, avgApprovalTurnaroundMinutes: 420 }` |
| `POST /api/notify/critical-exception` | Delivered/skipped reported honestly; app flow unaffected either way |

---

## 🗣️ Ask the Copilot (Try These)

Paste these into the Copilot tab once you're running:

```text
Show me trade TRD-92831 with its trade value, settlement status,
instruction status, risk score, and exception type.
```

```text
Which counterparties have the highest settlement failure rate
over the last 30 days?
```

```text
What is the total value at risk across all open exceptions
before today's cutoffs?
```

Answers arrive grounded in the governed semantic model — with the source labeled. If Cortex can't answer from data, the copilot won't invent an answer.

---

## 🛠️ Project Structure

```
clearset-ai/
├── package.json               # Root Vite + React 19 SPA manifest
├── vite.config.ts             # Vite config with /api proxy to backend :3001
├── index.html                 # App shell
├── service-spec.yaml          # SPCS service specification (deployed)
├── docker-compose.yml         # Local containerised stack (backend + frontend)
├── Dockerfile                 # Multi-stage production image (pre-built SPA)
├── .github/workflows/ci.yml   # CI gate: lint → typecheck → 45 tests → build
├── server/                    # Node.js + TypeScript Backend (Express)
│   ├── index.ts               # Server entry: route wiring + Cortex Analyst auth
│   ├── routes/                # predict.ts — flag-guarded /api/predict & /api/metrics
│   ├── snowflakeClient.ts     # Dual-auth SDK client (password local / OAuth SPCS)
│   ├── services/              # slack · auditReport · metrics · predictiveEngine
│   ├── test/                  # 42 node:test unit tests (no network required)
│   ├── tsconfig.json          # NodeNext TypeScript config
│   └── .env.example           # Credential template (NEVER commit .env)
├── snowflake/                 # SQL blueprints & platform setup
│   ├── 01_schema.sql          # DDL: all tables
│   ├── 02_seeds.sql           # Seed data incl. protected TRD-92831, TRD-81232
│   ├── 03_semantic_views.sql  # Enriched analytical views
│   ├── 04_cortex_search.sql   # CLEARSET_POLICY_SEARCH_SERVICE setup
│   ├── 07_semantic_model_CORRECTED.yaml # Semantic view (deployed via SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML)
│   ├── 08_resolution_cases.sql# RESOLUTION_CASES audit ledger DDL
│   ├── 09_demo_data_expansion.sql # 35-trade multi-scenario portfolio
│   ├── 10_refresh_demo_dates.sql  # Re-anchor cutoffs to today (idempotent)
│   └── ops/cost-7d.sql        # Warehouse cost report (7-day window)
├── scripts/
│   ├── coco_investigate.mjs   # CoCo CLI launcher — drives `cortex exec`
│   ├── migrate/               # cutover.ps1 · migrate_all.py · repair_demo_data.py
│   └── test/test-spcs.py      # SPCS service smoke test (health, endpoints, auth)
├── docs/                      # Start at docs/README.md (full index)
│   ├── JUDGE_QUICKSTART.md    # 5-minute evaluation script
│   ├── DEMO_VIDEO.md          # Narration script + shot list
│   ├── COCO_RUNBOOK.md        # CoCo CLI procedure, safety notes, transcripts
│   ├── api/ · architecture/ · deployment/
│   ├── security/LEAST_PRIVILEGE_ROLE.md
│   └── archive/               # Workshop transcripts + superseded plans
├── skills/                       # CoCo CLI skill definitions (7)
│   ├── assess_settlement_risk/SKILL.md
│   ├── determine_root_cause/SKILL.md
│   ├── find_similar_cases/SKILL.md
│   ├── recommend_resolution/SKILL.md
│   ├── escalate_exception/SKILL.md
│   ├── retrieve_procedure/SKILL.md
│   └── investigate_exception/SKILL.md
├── .snowflake/cortex/skills/  # Registered Cortex skill (visible to `cortex skill list`)
└── src/
    ├── App.tsx                # Responsive shell + tab routing
    ├── index.css              # Obsidian dark theme + focus/motion tokens
    ├── components/
    │   ├── layout/            # Navbar (health pill) · Sidebar (risk triage)
    │   ├── ui/                # primitives.tsx · tokens.ts (design system)
    │   ├── ImpactMetricsTile.tsx       # Live exposure & approval throughput
    │   ├── PredictionPanel.tsx         # Predictive Failure Prevention (flag)
    │   ├── SettlementChainViz.tsx      # Settlement Chain Trace (flag)
    │   └── CocoReplayPanel.tsx         # CoCo CLI Investigation Replay (flag)
    ├── views/                 # Dashboard · Exceptions · Investigation ·
    │                          # Copilot · Cases · Policies
    ├── hooks/useFeatureFlag.ts # Frontend flag gate (VITE_*)
    ├── services/              # Interface-first hybrid services (live→fallback)
    ├── engine/                # riskEngine.ts (deterministic 0–100) · orchestrator
    ├── context/AppContext.tsx # Central state: exceptions, mode, metrics
    └── data/                  # syntheticData.ts · knowledgeBase.ts
```

---

## ⚡ Quickstart (Local Development)

### Prerequisites
- Node.js 20+ (22 recommended)
- Snowflake account with `CLEARSET_DB` deployed (run `snowflake/*.sql` in order)
- Programmatic Access Token (PAT) for Cortex Analyst REST API

### Run it

```bash
# Terminal 1 — Backend
cd server && npm install --ignore-scripts
cp .env.example .env          # then fill in your credentials (below)
npm run dev                   # → http://localhost:3001

# Terminal 2 — Frontend
npm install
npm run dev                   # → http://localhost:5173
```

`server/.env`:

```env
PORT=3001

SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password

SNOWFLAKE_DATABASE=CLEARSET_DB
SNOWFLAKE_SCHEMA=CLEARSET_SCHEMA
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN   # Temporary — see docs/security/LEAST_PRIVILEGE_ROLE.md

# For Cortex Analyst REST API — generate in Snowsight:
# Admin → Users & Roles → <user> → Programmatic access tokens
SNOWFLAKE_PAT=your_pat_token_here
```

### Smoke-test in 30 seconds

```bash
curl http://localhost:3001/api/health
# {"mode":"snowflake","snowflake":true,...}

curl -X POST http://localhost:3001/api/cortex/analyst \
  -H "Content-Type: application/json" \
  -d '{"question":"Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type."}'
```

> 💡 Demo looking stale? `snowflake/10_refresh_demo_dates.sql` re-anchors all non-protected trades to today's cutoffs — idempotent, rerunnable forever.

### Run the test suite (45 tests, no network needed)

```bash
npm run server:test
```

### Drive a real CoCo CLI investigation

```bash
npm run coco:investigate -- TRD-92831
```

Requires `cortex` on PATH and the backend healthy on :3001. The agent investigates autonomously and always ends awaiting human authorization. Each successful run is saved to `public/coco-replay.json`, which powers the in-app **CoCo Replay** panel (`VITE_COCO_CLI_REPLAY=true`). If the run prints `Cortex Code is not enabled…`, the account is missing CoCo credits — the wrapper prints exactly how to unblock it.

---

## 📚 Documentation Map

Start at **[`docs/README.md`](docs/README.md)** — every document in the repo, one line each.

| I want to… | Read |
|---|---|
| Evaluate this in 5 minutes | [`docs/JUDGE_QUICKSTART.md`](docs/JUDGE_QUICKSTART.md) |
| Narrate the demo video | [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md) |
| Run the real CoCo CLI investigation | [`docs/COCO_RUNBOOK.md`](docs/COCO_RUNBOOK.md) |
| Understand the architecture & data flow | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) |
| Map an API endpoint | [`docs/api/API.md`](docs/api/API.md) |
| Deploy / upgrade / roll back on SPCS | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) |
| Harden roles & remove ACCOUNTADMIN | [`docs/security/LEAST_PRIVILEGE_ROLE.md`](docs/security/LEAST_PRIVILEGE_ROLE.md) |
| See what changed, and when | [`CHANGELOG.md`](CHANGELOG.md) |
| Contribute (tests, lint, PR rules) | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

---

## 🔐 Security Posture

| Control | Implementation |
|---------|----------------|
| **Credential Isolation** | All secrets in `server/.env` — gitignored, untracked, verified |
| **Frontend Safety** | Browser talks only to `/api/*`; zero Snowflake credentials client-side |
| **Runtime OAuth (SPCS)** | Token read fresh from `/snowflake/session/token` per request cycle — none baked into the image |
| **Image Hygiene** | Build-time scan: no `.env*`, no token paths, no secret patterns, no sensitive env vars |
| **Parameterized SQL** | Every query uses `?` bindings — no string interpolation, ever |
| **PAT Policy** | `CLEARSET_PAT_POLICY` network rules applied at user level |
| **Least Privilege Roadmap** | ACCOUNTADMIN is temporary; migration path documented in `docs/security/LEAST_PRIVILEGE_ROLE.md` |
| **Audit Trail** | Human approvals persisted to `RESOLUTION_CASES` with approver identity + timestamp |

---

## 🚀 Production Deployment (Completed)

Deployed to **Snowflake Park (SPCS)** — the app runs *inside* your Snowflake account:

```bash
# 1. Build (pre-built frontend + backend, node:22-alpine runtime)
docker build -t lhbbrso-dz87434.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest .

# 2. Push via Snowflake registry auth
snow spcs image-registry login --connection clearset-hack
docker push lhbbrso-dz87434.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest
# → digest sha256:1559651f2b4bb50a61ace70ea311edb078d6498b4efc762d859e5c698448cb5c

# 3. Create/Upgrade service
snow spcs service create CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
  --spec-path service-spec.yaml \
  --compute-pool CLEARSET_POOL \
  --connection clearset-hack
```

**Deployment verification record (2026-09-29, re-verified after account migration):**

| Check | Result |
|-------|--------|
| Service state | `RUNNING`, `is_upgrading = false` |
| Container | `READY`, restartCount `0` |
| Image digest match | Pushed == registry == running ✓ |
| Runtime auth | Log evidence: `authentication successful using: OAUTH` — password never used |
| Readiness probe | `/api/health` on :8080 executing live Snowflake queries each cycle |
| External access integrations | `None` — Cortex called via internal SNOWFLAKE_HOST |
| Public URL | 302 → Snowflake SSO (expected ingress behavior) |

---

## 🏆 Why This One Is Different

- **Zero-Fabrication Doctrine** — every datapoint wears its provenance: `LIVE SNOWFLAKE` / `COMPUTED` / `LOCAL FALLBACK` / `DATA NOT AVAILABLE`. An AI that says "I don't know" is rarer than one that's right.
- **Deterministic Where It Matters** — risk scoring is math, not vibes. Hallucination-free by construction.
- **Human Judgment Is Non-Negotiable** — dispatch stays physically locked behind analyst approval. The copilot advises; the human decides; the ledger remembers.
- **Production, Not Prototype** — containerized, OAuth-native, health-probed, audited, and running on SPCS inside the Snowflake account.
- **Graceful Under Failure** — full offline fallback layer means the demo never dies mid-presentation. (We've thought about this.)

---

## 📄 License

MIT — see [`LICENSE`](LICENSE). Built for the Snowflake CoCo CLI Hackathon 2026 (GCC Edition).

<div align="center">

**Built to make settlement failures boring.**

⚡ *Detect early · Investigate procedurally · Approve deliberately · Audit everything*

</div>
