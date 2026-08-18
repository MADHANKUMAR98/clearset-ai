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

1. **Surveillance & Detection:** Continuous real-time ingestion across DTC, Fedwire, and Euroclear depository flows (128,420 trades monitored daily).
2. **Deterministic Risk Scoring:** Mathematical, non-hallucinatory risk scoring (0–100) pinpointing cutoff urgency, SSI missing/mismatches, trade size exposure, and counterparty failure friction.
3. **Procedural Investigation (10-Step Workflow):** Autonomous verification across master data, depository gateway statuses, SSI directories, counterparty 30-day failure rates, similar historical cases, and binding SOP operating standards.
4. **Interactive Evidence Traceability:** Complete visual lineage from *"WHY is this trade critical?"* directly into supporting telemetry, historical case playbooks, and applicable SOP sections.
5. **Human-in-the-Loop Authorization:** AI recommends actions (e.g. SWIFT MT599 expedited repair and desk escalation) but strictly requires human analyst authorization before case creation and message dispatch.

---

## 🌟 Hero Showcase Case: `TRD-92831`

- **Trade Details:** $2,400,000.00 USD • 13,333 shares of AAPL (`US0378331005`) • Delivery Versus Payment (DVP)
- **Counterparty:** Apex Prime Clearing Ltd. (`CP-192`, BIC: `APEXUS33XXX`)
- **Depository:** Depository Trust Company (DTC)
- **Cutoff Urgency:** 1h 42m remaining until 15:30 EST DTC intraday cutoff
- **Deterministic Risk Score:** **`91 / 100` (CRITICAL)**

### Deterministic Risk Formula Breakdown:
$$\text{Total Score} = 25 + 25 + 20 + 15 + 6 = \mathbf{91 / 100}$$

| Risk Dimension | Rule / Threshold | Points | Justification |
| :--- | :--- | :---: | :--- |
| **Instruction Risk** | Missing Settlement Instruction (SSI) | `+25` | No linked depository subaccount for DTC Participant 0244 |
| **Cutoff Urgency** | Cutoff Approaching (< 120 minutes) | `+25` | 102 minutes remaining until DTC market cutoff window closes |
| **Financial Exposure**| High-Value Transaction (> $1.0M) | `+20` | $2.4M gross value exceeds Tier 1 operations threshold |
| **Counterparty Risk** | Repeated Prior Failures (> 5 in 30d) | `+15` | Apex Prime has 7 failures in past 30 days (8.4% fail rate) |
| **Institutional Memory**| Historical Failure Pattern Precedent | `+6` | Matched 18 prior similar cases where lack of timely repair resulted in depository reject |

---

## 🏛️ System Architecture

ClearSet AI features a clean, decoupled architecture supporting both full local simulation and live Snowflake Cortex integration:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                             REACT 19 UI LAYER                              │
│   Dashboard  •  Exceptions Queue  •  Investigation Workspace  •  Copilot   │
│                 Cases Ledger  •  Policies & SOP Knowledge                  │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION CONTEXT (AppContext.tsx)                    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     SERVICE INTERFACE ABSTRACTION LAYER                    │
│                            (src/services/types.ts)                         │
├──────────────────────┬──────────────────────┬──────────────────────────────┤
│  ISettlementService  │     IRiskService     │       ICortexService         │
│  (Trades, Events,    │  (Deterministic      │  (10-Step Orchestrator,      │
│   SSIs, Metrics)     │   Risk Formula)      │   Copilot Query Grounding)   │
└──────────┬───────────┴──────────┬───────────┴──────────────┬───────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   STAGE 1: LIGHTWEIGHT BACKEND PROXY (server/)             │
│   • Express + TypeScript + snowflake-sdk                                   │
│   • GET /api/health (Auto-detects Snowflake vs Local Fallback mode)        │
│   • GET /api/test-snowflake (Live warehouse verification query)            │
│   • Proxies Cortex Search & Cortex Analyst endpoints                       │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       LOCAL FALLBACK LAYER           │ │        LIVE SNOWFLAKE PLATFORM       │
│ • syntheticData.ts (Trades, Events)  │ │ • CLEARSET_DB.CLEARSET_SCHEMA        │
│ • knowledgeBase.ts (SOPs, Policies)  │ │ • Cortex Search: POLICY_SEARCH       │
│ • Local Risk & Stepper Simulation    │ │ • Cortex Analyst: CLEARSET_ANALYTICS │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🚀 Progress & Implemented Milestones

### ✅ Milestone 1: Snowflake Schema & Test Seed Data
- Relational schema deployed in `CLEARSET_DB.CLEARSET_SCHEMA`:
  - `TRADES`, `SECURITIES`, `COUNTERPARTIES`, `SETTLEMENT_INSTRUCTIONS`, `SETTLEMENT_EVENTS`, `EXCEPTIONS`, `HISTORICAL_CASES`, `INVESTIGATIONS`, `POLICY_CHUNKS`.
- Seed data loaded and validated across all tables including hero trade `TRD-92831`.

### ✅ Milestone 2: Cortex Search & Semantic Views
- Semantic views deployed:
  - `V_EXCEPTIONS_ENRICHED`, `V_CRITICAL_APPROACHING_CUTOFF`, `V_COUNTERPARTY_FAIL_STATS`, `V_SETTLEMENT_EVENTS`, `V_TRADE_ENRICHED`, `V_HISTORICAL_CASES`, `V_SSI_STATUS`.
- Snowflake Cortex Search Service **`CLEARSET_POLICY_SEARCH_SERVICE`** operational over `POLICY_CHUNKS`, successfully retrieving SOP sections (`SOP-OPS-032 §3.2`) for `TRD-92831`.

### ✅ Milestone 3: Cortex Analyst Semantic Model
- Semantic Model codified in [`snowflake/07_semantic_model_CORRECTED.yaml`](snowflake/07_semantic_model_CORRECTED.yaml) and documented in [`snowflake/07_cortex_analyst_validation.md`](snowflake/07_cortex_analyst_validation.md).
- Verified queries passing:
  1. Total gross exposure for critical exceptions = **$11,700,000.00**
  2. `TRD-92831` lookup: $2.4M AAPL, `PENDING` settlement, `MISSING` SSI, Risk Score **91/100**.
  3. Critical exception query returns `TRD-92831`, `TRD-81232`, and `TRD-71292`.
  4. Top failure counterparty = `CP-192` (Apex Prime: 7 fails, 8.4% fail rate).

### ✅ Stage 1 (Integration Foundation): Node.js + TypeScript Backend
- Lightweight backend created under [`server/`](server/):
  - `GET /api/health` — Safe health check reporting `{ mode: "snowflake" | "local", snowflake: boolean }`.
  - `GET /api/test-snowflake` — Harmless query testing connection to Snowflake session.
  - Safe error handling: If Snowflake credentials are absent, the server runs seamlessly in local mode without crashing.
  - Server-side credential isolation via `.env` (template provided in [`server/.env.example`](server/.env.example)).

---

## 🛠️ Project Structure

```text
clearset-ai/
├── package.json               # Root Vite + React 19 SPA manifest & server scripts
├── vite.config.ts             # Vite configuration with @tailwindcss/postcss
├── index.html                 # App shell with Google Inter font
├── README.md                  # Project documentation & architecture
├── server/                    # Node.js + TypeScript Backend Proxy (Stage 1)
│   ├── package.json           # Backend dependencies (express, snowflake-sdk, etc.)
│   ├── tsconfig.json          # NodeNext TypeScript configuration
│   ├── .env.example           # Environment template for Snowflake credentials
│   ├── index.ts               # Express server with /api/health & /api/test-snowflake
│   └── snowflakeClient.ts     # Snowflake SDK connection & query runner
├── snowflake/                 # Snowflake native SQL blueprints & semantic models
│   ├── 01_schema.sql          # Relational DDL tables
│   ├── 02_seeds.sql           # Financial test seeds
│   ├── 03_semantic_views.sql  # Semantic views for Cortex Analyst & reporting
│   ├── 04_cortex_search.sql   # Cortex Search Service setup
│   ├── 05_validation.sql      # Core validation queries
│   ├── 06_cortex_search_validation.sql # Search service tests
│   ├── 07_cortex_analyst_validation.md # Semantic model validation guide
│   └── 07_semantic_model_CORRECTED.yaml # Validated Cortex Analyst semantic model
├── skills/                    # CoCo procedural agent skill definitions
│   ├── investigate_exception/ # 10-step master investigation sequence
│   ├── assess_settlement_risk/# Deterministic risk scoring rules
│   ├── find_similar_cases/    # Institutional memory vector retrieval
│   ├── retrieve_procedure/    # Cortex Search SOP discovery
│   ├── determine_root_cause/  # Evidence synthesis
│   ├── recommend_resolution/  # Action plan formulation
│   └── escalate_exception/    # Desk escalation matrix
├── src/
│   ├── main.tsx               # Entrypoint
│   ├── App.tsx                # App layout & routing
│   ├── index.css              # Obsidian dark theme & design tokens
│   ├── types/                 # TypeScript domain entity & interface definitions
│   ├── services/              # Service contracts (ISettlementService, ICortexService)
│   ├── context/               # Global AppContext & dynamic metric state
│   ├── data/                  # Local synthetic data & SOP knowledge base
│   ├── engine/                # Deterministic risk engine & orchestrator
│   ├── components/            # Reusable UI components & layouts
│   └── views/                 # Core application views (Dashboard, Investigation, Copilot, etc.)
```

---

## ⚡ Quickstart & Running Locally

### 1. Run the Frontend (React 19 SPA)
```bash
# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend will launch at **`http://localhost:5173/`**.

### 2. Run the Backend Proxy (Node.js + TypeScript)
```bash
# Install backend dependencies
cd server
npm install --ignore-scripts
cd ..

# Start backend server with hot reload
npm run server
```
The backend will launch at **`http://localhost:3001/`**.

### 3. Test Backend Endpoints
```bash
# Check health and mode (returns local or snowflake)
curl http://localhost:3001/api/health

# Test Snowflake connection query
curl http://localhost:3001/api/test-snowflake
```

---

## 🔐 Enabling Live Snowflake Connection

To connect the backend to your live Snowflake instance:

1. Copy [`server/.env.example`](server/.env.example) to `server/.env`:
   ```env
   PORT=3001
   SNOWFLAKE_ACCOUNT=your_snowflake_account_identifier
   SNOWFLAKE_USER=your_snowflake_username
   SNOWFLAKE_PASSWORD=your_snowflake_password
   SNOWFLAKE_DATABASE=CLEARSET_DB
   SNOWFLAKE_SCHEMA=CLEARSET_SCHEMA
   SNOWFLAKE_WAREHOUSE=COMPUTE_WH
   SNOWFLAKE_ROLE=SYSADMIN
   ```
2. Restart the backend (`npm run server`).
3. Calling `GET /api/health` will confirm: `mode: "snowflake"`, `snowflake: true`.

---

## 🏆 Key Features

- **Domain-Specific Post-Trade AI Copilot:** Purpose-built for capital markets settlement exception management.
- **Deterministic & Explainable:** Mathematical 91-point score on `TRD-92831` with zero hallucinations.
- **10-Step Procedural Workflow:** Guided investigation from trade master data to depository matching, SSI check, and policy lookup.
- **Evidence Traceability:** Complete visual lineage from risk factors into raw depository events, counterparty metrics, and SOP citations.
- **Human-in-the-Loop:** Sensitive SWIFT MT599 dispatch and case creation strictly require human analyst authorization.
- **Snowflake-Native:** Relational schema, Cortex Search (`CLEARSET_POLICY_SEARCH_SERVICE`), and Cortex Analyst (`CLEARSET_ANALYTICS`) fully validated with automated fallback.

