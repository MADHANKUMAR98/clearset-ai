# Phase 2 Architecture Migration Plan: Real Snowflake & Cortex Integration

## Executive Summary
ClearSet AI is currently operating as a complete, high-fidelity **Phase 1 Local Simulation & Product Prototype**. It models an institutional post-trade settlement exception copilot with deterministic risk scoring, a 10-step procedural investigation workflow (highlighting hero trade `TRD-92831`), an interactive evidence inspector, an AI copilot, and human-in-the-loop authorization.

With the provision of the dedicated **Snowflake AI Data Cloud trial account**, ClearSet AI will transition to **Phase 2: Real Snowflake Data & Cortex Intelligence Integration** without altering the user experience, breaking existing UI components, or exposing credentials.

---

## 1. Current Repository Architecture (Phase 1 State)

### High-Level Architecture Diagram
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REACT 19 UI LAYER                                    │
│   DashboardView  •  ExceptionsView  •  InvestigationView  •  CopilotView  •  CasesView │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION CONTEXT (AppContext.tsx)                            │
│           State: exceptions, cases, investigationSteps, copilotMessages, metrics        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER (src/services/)                                 │
│  ISettlementService        IRiskService        IKnowledgeService        ICortexService │
│  (settlementService.ts)    (riskService.ts)    (knowledgeService.ts)   (cortexService) │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 LOCAL MOCKS & ENGINES                                  │
│   • src/data/syntheticData.ts (Trades, Counterparties, SSIs, Events, Cases)            │
│   • src/data/knowledgeBase.ts (SOP-OPS-032, SOP-OPS-014, POL-RSK-008, REG-EU-909)     │
│   • src/engine/riskEngine.ts (Deterministic 5-factor mathematical point allocation)     │
│   • src/engine/agentOrchestrator.ts (10-step simulated step generator & telemetry)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1 vs. Phase 2 Component Mapping

| Component Area | Phase 1 (Current Local Simulation) | Phase 2 (Snowflake & Cortex Backed) |
| :--- | :--- | :--- |
| **Relational Data Storage** | In-memory JavaScript objects in `syntheticData.ts` | Real Snowflake tables: `TRADES`, `SECURITIES`, `COUNTERPARTIES`, `SETTLEMENT_INSTRUCTIONS`, `SETTLEMENT_EVENTS`, `EXCEPTIONS` |
| **Semantic & Filter Queries** | JavaScript array filtering (`.filter()`, `.find()`) | Snowflake SQL Views (`V_EXCEPTIONS_ENRICHED`, `V_CRITICAL_APPROACHING_CUTOFF`, `V_COUNTERPARTY_FAIL_STATS`) |
| **Operational SOP Knowledge** | In-memory array in `knowledgeBase.ts` | `POLICY_CHUNKS` table indexed in Snowflake **Cortex Search Service** (`CLEARSET_POLICY_SEARCH_SERVICE`) |
| **Similar Cases & Precedents**| Static fixture `HISTORICAL_CASES_TRD92831` | `HISTORICAL_CASES` table with vector embeddings (`VECTOR(FLOAT, 768)`) searched via `SNOWFLAKE.CORTEX.EMBED_TEXT_768` / vector similarity |
| **10-Step Investigation Steps**| Hardcoded string array log simulator | Live Snowflake query execution per step + Cortex Search SOP retrieval + Cortex Complete root cause synthesis |
| **Post-Trade AI Copilot** | Regex/keyword routing in `LocalCortexService` | Snowflake **Cortex Analyst** (structured semantic query generation) + **Cortex Complete** (`snowflake-arctic` / `claude-3-5-sonnet` / `mistral-large2`) |
| **Risk Scoring Engine** | Deterministic formula in `LocalRiskService` | Deterministic formula evaluated on live Snowflake trade & counterparty metrics (preserving mathematical 0-100 explainability) |
| **Case & Audit Trail Storage**| React local state array `cases` | Persistence to Snowflake table `CLEARSET_DB.CLEARSET_SCHEMA.INVESTIGATIONS` via SQL `INSERT` + local cache |

---

## 3. Security & Zero-Frontend-Credentials Architecture

> [!CAUTION]
> **Zero Client-Side Credentials Rule:**
> Under no circumstances will Snowflake account identifiers, usernames, passwords, private keys, or API tokens be exposed in Vite frontend code or committed to git.

### Secure Backend Gateway Design
```text
┌─────────────────────────────────┐
│     React Frontend (Vite)       │
│  (Zero Snowflake Credentials)   │
└────────────────┬────────────────┘
                 │ HTTP Requests to relative `/api/*`
                 ▼
┌─────────────────────────────────┐
│   ClearSet Secure Server / API  │
│  (Node.js Express / Fastify /   │
│   Vite Backend Middleware)      │
│  - Reads server-side `.env`     │
│  - Uses `snowflake-sdk` & REST  │
│  - Validates queries & params   │
│  - Handles Cortex AI endpoints  │
└────────────────┬────────────────┘
                 │ Secure TLS / SQL API / Cortex API
                 ▼
┌─────────────────────────────────┐
│    Snowflake AI Data Cloud      │
│   Account / DB: CLEARSET_DB     │
│   Schema: CLEARSET_SCHEMA       │
│   Cortex Analyst & Search       │
└─────────────────────────────────┘
```

### Authentication Configuration (.env - Git-Ignored)
```env
# Server-side only (never prefixed with VITE_)
SNOWFLAKE_ACCOUNT=xy12345.us-east-1
SNOWFLAKE_USER=CLEARSET_SERVICE_USER
SNOWFLAKE_PASSWORD=YourSecurePasswordOrKey
SNOWFLAKE_DATABASE=CLEARSET_DB
SNOWFLAKE_SCHEMA=CLEARSET_SCHEMA
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN
PORT=3001
```

### Seamless Phase 1 Local Fallback Guarantee
All service implementations in `src/services/` will use a **Failover Strategy**:
1. When the backend server is reachable and Snowflake returns data, use live Snowflake data.
2. If Snowflake credentials are not configured, the network is offline, or any query errors occur, the service layer transparently catches the error and serves the existing Phase 1 simulated data.
3. The UI will display a live status pill (e.g., `LIVE SNOWFLAKE CONNECTED` vs. `LOCAL SIMULATION (FALLBACK)`).

---

## 4. Required Snowflake Objects & Cortex Features

### A. Snowflake Database & Schema Objects
1. **Database:** `CLEARSET_DB`
2. **Schema:** `CLEARSET_SCHEMA`
3. **Warehouse:** `COMPUTE_WH`
4. **Tables:**
   - `COUNTERPARTIES`: Master records, 30-day failure counts, historical failure rates, contacts.
   - `SECURITIES`: ISIN, CUSIP, ticker, asset class, depository (DTC, Fedwire, Euroclear).
   - `TRADES`: Trade economics, settlement date/type, status, cutoff time.
   - `SETTLEMENT_INSTRUCTIONS`: Standing settlement instructions (SSI), account numbers, mismatch details.
   - `SETTLEMENT_EVENTS`: Depository message log (SWIFT MT541, MT548, MT599, ISO 20022).
   - `EXCEPTIONS`: Exception records, severity, deterministic risk scores, JSON breakdowns.
   - `HISTORICAL_CASES`: Historical institutional memory with vector embedding column `VECTOR(FLOAT, 768)`.
   - `POLICY_CHUNKS`: Segmented SOPs, mandatory actions, and escalation thresholds.
   - `INVESTIGATIONS`: Immutable audit trail for resolved cases, approval notes, and human decision records.
5. **Views:**
   - `V_EXCEPTIONS_ENRICHED`: Multi-table join view for rapid analytical inspection.
   - `V_CRITICAL_APPROACHING_CUTOFF`: Real-time critical queue sorted by cutoff urgency.
   - `V_COUNTERPARTY_FAIL_STATS`: Counterparty failure rate metrics.
6. **Semantic Model YAML:**
   - `clearset_semantic_model.yaml`: Semantic manifest for Cortex Analyst defining entities, measures, and dimensions for natural language operations.

### B. Cortex AI Features to Utilize
1. **Snowflake Cortex Search Service (`CLEARSET_POLICY_SEARCH_SERVICE`):**
   - Natural language search over `POLICY_CHUNKS` table to retrieve relevant SOP sections during Step 6 and Copilot questions.
2. **Snowflake Cortex Analyst:**
   - Natural language to SQL generation over `V_EXCEPTIONS_ENRICHED` and `COUNTERPARTIES` tables.
3. **Snowflake Cortex Complete (`SNOWFLAKE.CORTEX.COMPLETE`):**
   - Model: `claude-3-5-sonnet` / `mistral-large2` / `snowflake-arctic` / `llama3.1-70b`.
   - Generates dynamic root cause synthesis and customized action recommendations based on retrieved evidence.
4. **Snowflake Cortex Embeddings (`SNOWFLAKE.CORTEX.EMBED_TEXT_768`):**
   - Vector search across `HISTORICAL_CASES` to find similar past exceptions and calculate resolution statistics.

---

## 5. Files to Create and Modify

### Files That Need Creation [NEW]
1. `server/index.ts` (or `server/server.ts`): Secure Node.js backend server handling Snowflake connection pool, `/api/settlement/*`, `/api/cortex/*`, `/api/knowledge/*`, and `/api/health` endpoints.
2. `server/snowflakeClient.ts`: Snowflake SDK wrapper with connection management, query execution, and error handling.
3. `server/cortexClient.ts`: Snowflake Cortex AI integration (Analyst, Search Service, and Complete API).
4. `snowflake/05_semantic_model.yaml`: Snowflake Cortex Analyst semantic definition file for post-trade settlement domain.
5. `src/services/snowflakeSettlementService.ts`: `ISettlementService` implementation calling `/api/settlement/*` with fallback to `LocalSettlementService`.
6. `src/services/snowflakeCortexService.ts`: `ICortexService` implementation calling `/api/cortex/*` with fallback to `LocalCortexService`.
7. `src/services/snowflakeKnowledgeService.ts`: `IKnowledgeService` implementation calling `/api/knowledge/*` with fallback to `LocalKnowledgeService`.
8. `.env.example`: Template for environment variables.

### Files That Need Modification [MODIFY]
1. `package.json`: Add `snowflake-sdk`, `dotenv`, `express` (or `fastify`), `cors`, `tsx` (or `ts-node`), and concurrent dev script (`npm run dev:all`).
2. `vite.config.ts`: Configure Vite API proxy to forward `/api` requests to `http://localhost:3001`.
3. `snowflake/04_cortex_search.sql`: Finalize Cortex Search Service creation script and test queries.
4. `src/services/settlementService.ts`: Export hybrid/Snowflake service instance while preserving `LocalSettlementService`.
5. `src/services/cortexService.ts`: Export hybrid/Snowflake service instance while preserving `LocalCortexService`.
6. `src/services/knowledgeService.ts`: Export hybrid/Snowflake service instance while preserving `LocalKnowledgeService`.
7. `src/components/layout/Navbar.tsx`: Update live status indicator to dynamically reflect backend connection health.

---

## 6. Step-by-Step Implementation Order (Pending Approval)

```text
Step 1: Snowflake DDL & Data Ingestion Setup
  ├── Run 01_schema.sql (Create DB, Schema, Tables)
  ├── Run 02_seeds.sql (Populate Master, Trade, and Exception Data)
  ├── Run 03_semantic_views.sql (Create Analytical Views)
  └── Run 04_cortex_search.sql (Populate SOP Chunks & Initialize Cortex Search Service)

Step 2: Secure Backend Server & Snowflake SDK Integration
  ├── Install backend dependencies (snowflake-sdk, express, cors, dotenv)
  ├── Create server/snowflakeClient.ts (Connection pooling, secure query execution)
  ├── Create server/cortexClient.ts (Cortex Search, Analyst, and Complete integration)
  ├── Create server/index.ts (API routes for trades, exceptions, investigations, and copilot)
  └── Configure vite.config.ts proxy for /api

Step 3: Frontend Service Layer Dual-Mode Upgrades
  ├── Create src/services/snowflakeSettlementService.ts (with LocalSettlementService fallback)
  ├── Create src/services/snowflakeCortexService.ts (with LocalCortexService fallback)
  ├── Create src/services/snowflakeKnowledgeService.ts (with LocalKnowledgeService fallback)
  └── Update service exports and verify zero UI regressions

Step 4: End-to-End Verification & Hero Flow Validation
  ├── Test TRD-92831 10-step investigation with live Snowflake telemetry
  ├── Test Copilot natural language queries against Snowflake & Cortex
  ├── Test Human Approval case creation with live write to INVESTIGATIONS table
  └── Test Offline/Fallback mode by simulating disconnected backend
```

---

## 7. Verification Plan

### Automated Tests
- Server health check endpoint (`GET /api/health`).
- Snowflake query verification script verifying tables, views, and seed counts.
- TypeScript compilation (`npm run build`).
- Linter verification (`npm run lint`).

### Manual Verification
1. **Live Snowflake Connection Test:** Launch server with valid `.env`, verify green "LIVE SNOWFLAKE CONNECTED" badge in Navbar.
2. **Investigation Workflow Test:** Click "Run AI Investigation" on `TRD-92831`, verify live logs and Cortex-generated synthesis.
3. **Approval & Audit Trail Test:** Click "Approve & Dispatch", verify new case in Cases Ledger and row in Snowflake `INVESTIGATIONS`.
4. **Fallback Test:** Stop backend server, reload UI, verify that ClearSet AI seamlessly operates in Phase 1 local simulation without errors.
