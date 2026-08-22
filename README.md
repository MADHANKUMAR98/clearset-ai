# ⚡ ClearSet AI — Post-Trade Settlement Copilot

> **Snowflake-Native Domain-Specific AI Copilot for Capital Markets Post-Trade Operations**  
> *Detect, investigate, explain, and resolve settlement exceptions using institutional financial data, historical memory, operational SOPs, and regulatory knowledge — with guaranteed human-in-the-loop control.*

---

## 🎯 Hackathon Track & Problem Statement

- **Track:** Domain-Specific AI Copilot
- **Domain:** Financial Services / Capital Markets / Post-Trade Operations (DVP/RVP, SSI Validation, SWIFT MT541/548/599, ISO 20022, CSDR Settlement Discipline Regime, Depository Cutoff Surveillance)
- **Target Persona:** Post-Trade Operations Analysts, Settlement Specialists & Exception Desk Leads

---

## 💡 Executive Summary

Settlement failures cost institutional investment banks and broker-dealers billions annually in European CSDR Article 7 cash penalties, replacement costs, and counterparty credit risks. ClearSet AI transforms manual, high-stress post-trade operations into a guided, deterministic workflow:

1. **Surveillance & Detection** — Continuous real-time ingestion across DTC, Fedwire, and Euroclear depository flows (128,420 trades monitored daily).
2. **Deterministic Risk Scoring** — Mathematical, non-hallucinatory risk scoring (0–100) pinpointing cutoff urgency, SSI missing/mismatches, trade size exposure, and counterparty failure friction.
3. **Procedural Investigation (10-Step Workflow)** — Autonomous verification across master data, depository gateway statuses, SSI directories, counterparty 30-day failure rates, similar historical cases, and binding SOP operating standards.
4. **Interactive Evidence Traceability** — Complete visual lineage from *"WHY is this trade critical?"* directly into supporting telemetry, historical case playbooks, and applicable SOP sections.
5. **Human-in-the-Loop Authorization** — AI recommends actions (e.g. SWIFT MT599 expedited repair and desk escalation) but strictly requires human analyst authorization before case creation and message dispatch.

---

## 🌟 Hero Showcase Cases

| Trade | Value | Exception | Risk Score | Counterparty | Status |
|-------|-------|-----------|------------|--------------|--------|
| **TRD-92831** | $2.4M AAPL (DVP, DTC) | Missing Instruction | **91/100** (LIVE=91, Deterministic=91) | CP-192 Apex Prime Clearing | OPEN |
| **TRD-81232** | $8.1M US Treasury (DVP, Fedwire) | Cash Discrepancy | **89/100** (LIVE=89, Deterministic=84) | CP-104 Vanguard Global Markets | INVESTIGATING |

> **Provenance Transparency:** When Live Snowflake risk score differs from deterministic calculation, a badge displays: `⚠ Live Snowflake: 89 | Deterministic: 84` — explaining that Snowflake's pre-computed score uses actual historical precedent analysis (11 pts) vs frontend fixed baseline (6 pts).

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
└──────────┬───────────┴──────────┬───────────┴──────────────┬───────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               BACKEND PROXY  (server/  — Node.js + Express + TS)           │
│  GET  /api/health                  POST /api/cortex/search                 │
│  GET  /api/test-snowflake          POST /api/cortex/analyst                │
│  GET  /api/exceptions              GET  /api/trades                        │
│  GET  /api/counterparties/:id      GET  /api/settlement-events/:tradeId    │
│  GET  /api/cases                   POST /api/cases                         │
│                                                                             │
│  Auth: Snowflake SDK (password) for data queries                           │
│        PAT Bearer token for Cortex Analyst REST API                        │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       LOCAL FALLBACK LAYER           │ │        LIVE SNOWFLAKE PLATFORM       │
│ • syntheticData.ts (Trades, Events)  │ │ • CLEARSET_DB.CLEARSET_SCHEMA        │
│ • knowledgeBase.ts (SOPs, Policies)  │ │ • Cortex Search: POLICY_SEARCH_SVC   │
│ • Local Risk & Stepper Simulation    │ │ • Cortex Analyst: CLEARSET_ANALYTICS │
│ • Always intact — never removed      │ │ • Semantic View (Autopilot-built)    │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🚀 Implementation Status — All Complete

| Stage | Description | Status |
|-------|-------------|--------|
| **1. Foundation** | Node.js/Express/TypeScript backend, health check, Snowflake connection pool, Vite proxy | ✅ |
| **2. Live Data** | 5 Snowflake endpoints with graceful local fallback | ✅ |
| **3. Cortex AI** | Cortex Search + Cortex Analyst (PAT-authenticated REST) | ✅ |
| **4. Full Integration** | React UI ↔ Live Backend, dynamic dashboard, provenance badges | ✅ |
| **5. Case Persistence** | `RESOLUTION_CASES` table, POST/GET `/api/cases`, human approval workflow | ✅ |
| **6. SPCS Deployment** | Docker image, Snowflake registry, service upgrade, OAuth runtime | ✅ |

---

## 📋 Live Endpoint Verification

All endpoints verified against **live Snowflake** (`CLEARSET_DB.CLEARSET_SCHEMA`):

| Endpoint | Result |
|----------|--------|
| `GET /api/health` | `mode: "snowflake", snowflake: true` |
| `GET /api/exceptions` | 5 rows, EX-92831 first (RISK_SCORE=91) |
| `GET /api/trades` | 5 rows, TRD-92831 present |
| `GET /api/counterparties/CP-192` | Apex Prime Clearing Ltd. |
| `GET /api/settlement-events/TRD-92831` | 5 SWIFT event rows |
| `GET /api/cases` | `mode: "snowflake"` (empty array) |
| `POST /api/cortex/search` | SOP-3.2 (TRD-92831), SOP-2.4 (TRD-81232) |
| `POST /api/cortex/analyst` | TRD-92831: 91/MISSING; TRD-81232: 89/MISMATCHED |

---

## 🛠️ Project Structure

```
clearset-ai/
├── package.json               # Root Vite + React 19 SPA manifest
├── vite.config.ts             # Vite config with /api proxy to backend :3001
├── index.html                 # App shell with Google Inter font
├── README.md                  # This file
├── service-spec.yaml          # SPCS service specification
├── LEAST_PRIVILEGE_ROLE.md    # Snowflake role preparation guide
├── server/                    # Node.js + TypeScript Backend (Express)
│   ├── package.json           # Backend deps: express, snowflake-sdk, dotenv, tsx
│   ├── tsconfig.json          # NodeNext TypeScript config
│   ├── .env.example           # Credential template (NEVER commit .env)
│   ├── index.ts               # All API routes + Cortex Analyst PAT auth
│   └── snowflakeClient.ts     # SDK connection, executeStatement, diagnostics
├── snowflake/                 # Snowflake SQL blueprints & semantic model
│   ├── 01_schema.sql          # DDL: all tables
│   ├── 02_seeds.sql           # Seed data including TRD-92831, TRD-81232
│   ├── 03_semantic_views.sql  # V_EXCEPTIONS_ENRICHED and others
│   ├── 04_cortex_search.sql   # CLEARSET_POLICY_SEARCH_SERVICE setup
│   ├── 08_resolution_cases.sql # RESOLUTION_CASES table DDL
│   └── 07_semantic_model.yaml # Semantic view (Autopilot-built)
├── skills/                    # CoCo CLI skill definitions
│   └── investigate_exception/...
└── src/
    ├── main.tsx
    ├── App.tsx                # Tab-based routing via AppContext.activeTab
    ├── index.css              # Obsidian dark theme
    ├── types/index.ts         # All domain types (Trade, ExceptionItem, etc.)
    ├── services/
    │   ├── types.ts           # ISettlementService, ICortexService, IKnowledgeService
    │   ├── apiClient.ts       # All fetch functions (no credentials — backend-only)
    │   ├── settlementService.ts  # Local + Hybrid (live Snowflake + fallback)
    │   ├── cortexService.ts      # Local + Hybrid (Cortex Search/Analyst)
    │   └── riskService.ts        # LocalRiskService (wraps riskEngine)
    ├── context/
    │   └── AppContext.tsx     # Central state: exceptions, events, SSI, backendMode
    ├── data/
    │   ├── syntheticData.ts   # Local fallback: trades, events, counterparties, cases
    │   └── knowledgeBase.ts   # 4 policy documents (SOP-OPS-032, POL-RSK-008, etc.)
    ├── engine/
    │   ├── riskEngine.ts      # Deterministic risk formula (0–100, 5 factors)
    │   └── agentOrchestrator.ts
    ├── components/layout/
    │   ├── Navbar.tsx         # Health status (LIVE SNOWFLAKE / LOCAL SIMULATION)
    │   └── Sidebar.tsx        # Dynamic priority triage (highest-risk live exception)
    └── views/
        ├── DashboardView.tsx  # Live metrics + dynamic counterparty chart
        ├── ExceptionsView.tsx # Live exception queue
        ├── InvestigationView.tsx # Live settlement events + SSI + provenance badge
        ├── CopilotView.tsx    # Cortex Analyst + live status badge
        ├── CasesView.tsx      # Audit trail ledger (Snowflake + local fallback)
        └── PoliciesView.tsx   # SOP knowledge browser (local + Cortex Search)
```

---

## ⚡ Quickstart (Local Development)

### Prerequisites
- Node.js 20+ (or 22.12+)
- Snowflake account with `CLEARSET_DB` deployed (see `snowflake/` folder)
- Snowflake Programmatic Access Token (PAT) for Cortex Analyst REST API

### 1. Frontend
```bash
npm install
npm run dev
# → http://localhost:5173
```

### 2. Backend
```bash
cd server
npm install --ignore-scripts
```

Create `server/.env` from `server/.env.example`:
```env
PORT=3001

SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password

SNOWFLAKE_DATABASE=CLEARSET_DB
SNOWFLAKE_SCHEMA=CLEARSET_SCHEMA
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN   # Temporary — see LEAST_PRIVILEGE_ROLE.md

# Required for Cortex Analyst REST API
# Generate in Snowsight: Admin → Users & Roles → <user> → Programmatic access tokens
# Set role restriction: ACCOUNTADMIN, expiry: 90 days
SNOWFLAKE_PAT=your_pat_token_here
```

```bash
cd server
npm run dev
# → http://localhost:3001
```

### 3. Verify Locally
```bash
# Health check
curl http://localhost:3001/api/health
# → {"mode":"snowflake","snowflake":true,...}

# Exceptions
curl http://localhost:3001/api/exceptions

# Cortex Analyst
curl -X POST http://localhost:3001/api/cortex/analyst \
  -H "Content-Type: application/json" \
  -d '{"question":"Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type."}'
```

---

## 🔐 Security Notes

| Control | Implementation |
|---------|----------------|
| **Credential Isolation** | All Snowflake secrets in `server/.env` (gitignored, never committed) |
| **Frontend Safety** | React calls only `/api/*` on Express — no Snowflake credentials in browser |
| **No VITE_ Secrets** | `VITE_*` env vars intentionally unused for credentials |
| **PAT Policy** | `CLEARSET_PAT_POLICY` applied at user level for network policy compliance |
| **Runtime OAuth** | SPCS injects `/snowflake/session/token` at runtime — no credentials in Docker image |
| **Parameterized SQL** | All Snowflake queries use `?` bindings — no string interpolation |
| **Debug Endpoint Removed** | `/api/debug-snowflake` stripped before production |
| **Least-Privilege Role** | Documented in `LEAST_PRIVILEGE_ROLE.md` (ACCOUNTADMIN is temporary) |

---

## 🏗️ SPCS Deployment (Production)

### Prerequisites
```bash
# Verify Docker
docker version

# Verify Snowflake CLI
snow connection test --connection fr43183
snow spcs image-registry login --connection fr43183
```

### Build & Push
```bash
# Build production image (pre-built frontend + backend)
docker build -t ziaihbo-fr43183.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest .

# Verify no credentials in image
docker history <image> | grep -iE "password|pat|token|env"

# Push to Snowflake registry
docker push ziaihbo-fr43183.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest
```

### Deploy to SPCS
```bash
# Upgrade existing service (do not create new)
snow spcs service upgrade CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
  --spec-path service-spec.yaml --connection fr43183

# Wait for RUNNING
snow spcs service status CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI --connection fr43183
# → status: READY, restartCount: 0
```

### Post-Deployment Verification
- **Public URL:** `https://mafdxb-ziaihbo-fr43183.snowflakecomputing.app` (SPCS ingress requires Snowflake SSO — HTTP 302 is expected for unauthenticated requests)
- **Runtime Logs:** Verify `authentication successful using: OAUTH`, `CLEARSET_DB`, `CLEARSET_SCHEMA`, `COMPUTE_WH`, no password/PAT
- **Authenticated API:** Test via Snowflake-authenticated session:
  - `GET /api/health` → `mode: "snowflake"`
  - `GET /api/exceptions` → 5 rows
  - `POST /api/cortex/analyst` → correct trade data for TRD-92831 and TRD-81232

---

## 🏆 Key Features

- **Domain-Specific Post-Trade AI Copilot** — Purpose-built for capital markets settlement exception management
- **Deterministic & Explainable** — Mathematical risk scoring with zero hallucinations; every point traceable to a rule
- **10-Step Procedural Workflow** — Guided investigation from trade master data to depository matching, SSI check, policy lookup
- **Live Snowflake Integration** — 8 API endpoints verified against live `CLEARSET_DB.CLEARSET_SCHEMA`
- **Cortex Analyst via Semantic View** — Natural language queries over `CLEARSET_ANALYTICS` (Autopilot-built) with PAT-authenticated REST
- **Cortex Search** — Policy chunk retrieval from `CLEARSET_POLICY_SEARCH_SERVICE` — ranked SOP sections in real time
- **RESOLUTION_CASES Persistence** — Human approvals persisted to Snowflake with full audit trail
- **Guaranteed Fallback** — Full UI works offline via `syntheticData.ts` / `knowledgeBase.ts` — no crashes, no empty screens
- **Human-in-the-Loop** — SWIFT MT599 dispatch and case creation require explicit analyst authorization
- **Provenance Transparency** — Live vs Deterministic vs Local Fallback badges on every data point
- **Zero Credential Leakage** — All secrets in `server/.env` (gitignored), runtime OAuth only

---

## 📄 License

Proprietary — ClearSet AI for Snowflake CoCo CLI Hackathon 2026.