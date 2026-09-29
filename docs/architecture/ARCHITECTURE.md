# ClearSet AI — Architecture Documentation

## System Overview

ClearSet AI is a **Snowflake-native, domain-specific AI copilot** for capital markets post-trade operations. It detects, investigates, and resolves settlement exceptions with full auditability and human-in-the-loop governance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLEARSET AI SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   FRONTEND   │    │   BACKEND    │    │  SNOWFLAKE   │                  │
│  │  (React 19)  │◄──►│  (Express)   │◄──►│  (SPCS)      │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  Dashboard   │    │  API Layer   │    │  Core Tables │                  │
│  │  Exceptions  │    │  /api/*      │    │  TRADES      │                  │
│  │  Investigation│   │  Cortex      │    │  EXCEPTIONS  │                  │
│  │  Copilot     │    │  Auth        │    │  COUNTERPARTIES                 │
│  │  Cases       │    │  Webhooks    │    │  SECURITIES  │                  │
│  │  Policies    │    │  CoCo CLI    │    │  SETTLEMENT_EVENTS             │
│  └──────────────┘    └──────────────┘    │  RESOLUTION_CASES              │
│                                          │  HISTORICAL_CASES              │
│                                          │  POLICY_CHUNKS                 │
│                                          └──────────────┘                  │
│                                             │                              │
│                                             ▼                              │
│                                    ┌──────────────────┐                    │
│                                    │   CORTEX AI      │                    │
│                                    │  ──────────────  │                    │
│                                    │  Cortex Search   │                    │
│                                    │  (SOP Retrieval) │                    │
│                                    │                  │                    │
│                                    │  Cortex Analyst  │                    │
│                                    │  (Semantic SQL)  │                    │
│                                    └──────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend (React 19 + Vite)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS + Custom Design System
- **State Management**: React Context (AppContext)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: Tab-based (no router - SPA tabs)

#### Key Views
| View | Purpose |
|------|---------|
| `DashboardView` | Operational overview with metrics, risk tiles, charts |
| `ExceptionsView` | Exception queue with filtering, sorting, risk scoring |
| `InvestigationView` | 10-step procedural investigation workflow |
| `CopilotView` | Natural language queries via Cortex Analyst |
| `CasesView` | Resolution cases ledger with audit PDF generation |
| `PoliciesView` | SOP knowledge base browser |

### 2. Backend (Express + TypeScript)
- **Runtime**: Node.js 22 (Alpine in production)
- **Framework**: Express 4
- **Auth**: Dual-mode (Password local / OAuth SPCS)
- **Database**: Snowflake via `@snowflake/sdk`
- **AI**: Cortex REST APIs (Search + Analyst)

#### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/exceptions` | GET | List exceptions with enrichment |
| `/api/trades` | GET | List trades with enrichment |
| `/api/counterparties/:id` | GET | Counterparty details |
| `/api/settlement-events/:tradeId` | GET | SWIFT event timeline |
| `/api/cortex/search` | POST | Cortex Search (SOP retrieval) |
| `/api/cortex/analyst` | POST | Cortex Analyst (semantic queries) |
| `/api/cases` | GET/POST | Resolution cases CRUD |
| `/api/cases/:id/report` | GET | Audit PDF report |
| `/api/metrics` | GET | Operational impact metrics |
| `/api/notify/critical-exception` | POST | Slack notification (optional) |
| `/api/slack/status` | GET | Slack integration status |

### 3. Snowflake Data Layer

#### Core Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `TRADES` | Trade master data | TRADE_ID, ISIN, CP_ID, TRADE_VALUE, SETTLEMENT_DATE, CUTOFF_TIME |
| `EXCEPTIONS` | Exception queue | EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, RISK_SCORE |
| `COUNTERPARTIES` | Counterparty master | CP_ID, NAME, BIC, CREDIT_RATING, PRIOR_FAILURES_30D |
| `SECURITIES` | Security master | ISIN, TICKER, NAME, ASSET_CLASS, DEPOSITORY |
| `SETTLEMENT_INSTRUCTIONS` | SSI details | INSTRUCTION_ID, TRADE_ID, STATUS, MISMATCH_DETAILS |
| `SETTLEMENT_EVENTS` | SWIFT event log | EVENT_ID, TRADE_ID, MESSAGE_TYPE, STATUS, SOURCE |
| `EXCEPTIONS` | Exception queue | EXCEPTION_ID, TRADE_ID, SEVERITY, RISK_SCORE |
| `RESOLUTION_CASES` | Audit ledger | CASE_ID, TRADE_ID, STATUS, APPROVED_BY, APPROVED_AT |
| `HISTORICAL_CASES` | Institutional memory | HISTORICAL_CASE_ID, ROOT_CAUSE, RESOLUTION_STRATEGY |
| `POLICY_CHUNKS` | SOP knowledge base | CHUNK_ID, DOC_CODE, CHUNK_TEXT, KEYWORDS |

#### Semantic Views
| View | Purpose |
|------|---------|
| `V_EXCEPTIONS_ENRICHED` | Exceptions with trade/counterparty/security joins |
| `V_CRITICAL_APPROACHING_CUTOFF` | Critical exceptions sorted by urgency |
| `V_COUNTERPARTY_FAIL_STATS` | Counterparty failure statistics |
| `V_POLICY_SEARCH` | Policy chunks for Cortex Search |
| `V_SETTLEMENT_EVENTS` | Settlement events with trade context |
| `V_TRADE_ENRICHED` | Trades with counterparty/security details |
| `V_HISTORICAL_CASES` | Historical cases with counterparty details |
| `V_SSI_STATUS` | SSI status with trade context |

### 4. Cortex AI Services

#### Cortex Search Service
- **Service Name**: `CLEARSET_POLICY_SEARCH_SERVICE`
- **Source**: `POLICY_CHUNKS` table
- **Search Column**: `CHUNK_TEXT`
- **Attributes**: `DOC_CODE`, `POLICY_NAME`, `POLICY_SECTION`, `APPLICABLE_CP_ID`, `APPLICABLE_ASSET_CLASS`
- **Warehouse**: `COMPUTE_WH`
- **Target Lag**: 1 hour
- **Use Cases**: SOP retrieval, policy lookup, regulatory reference

#### Cortex Analyst
- **Semantic Model**: `CLEARSET_ANALYTICS`
- **Tables**: `TRADES`, `EXCEPTIONS`, `COUNTERPARTIES`, `SECURITIES`, `SETTLEMENT_EVENTS`, `RESOLUTION_CASES`
- **Relationships**: Defined FK/PK relationships
- **Use Cases**: Natural language trade queries, risk explanations, settlement status

### 5. CoCo CLI Integration

#### Skill: `investigate-settlement-exception`
- **Location**: `.snowflake/cortex/skills/investigate-settlement-exception/`
- **Trigger**: `npm run coco:investigate -- <TRADE_ID>`
- **Workflow**: 10-step autonomous investigation
- **Tools**: Bash (snowsql queries), Web Fetch, SQL Execute
- **Output**: Structured investigation → `AWAITING ANALYST AUTHORISATION`

#### Launcher: `scripts/coco_investigate.mjs`
- **Validation**: Trade ID format validation
- **Health Check**: Backend preflight
- **Execution**: `cortex exec --allowed Bash --max-turns 60 --no-history`
- **Output**: Structured investigation report

### 6. CoCo CLI Skills (7 Total)

| Skill | Purpose |
|-------|---------|
| `assess_settlement_risk` | Calculate risk score from trade data |
| `determine_root_cause` | Analyze exception to find root cause |
| `find_similar_cases` | Search historical cases for patterns |
| `recommend_resolution` | Generate resolution recommendation |
| `escalate_exception` | Trigger escalation workflow |
| `retrieve_procedure` | Fetch applicable SOP from Cortex Search |
| `investigate_exception` | **Main skill** - orchestrate full investigation |

### 7. Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY BOUNDARIES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   BROWSER   │    │   BACKEND   │    │     SNOWFLAKE       │  │
│  │             │    │             │    │                     │  │
│  │ • No creds  │    │ • .env only │    │ • OAuth runtime     │  │
│  │ • API only  │    │ • No PAT in │    │   (no pwd in img)   │  │
│  │   calls     │    │   Docker    │    │ • Param SQL only    │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                        │            │
│         │ HTTPS/WSS        │ HTTPS                  │ Snowflake  │
│         │                  │                        │ Internal   │
│         ▼                  ▼                        ▼            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              ZERO-FABRICATION DATA CONTRACT                  │ │
│  │  Every value labeled: LIVE SNOWFLAKE / COMPUTED /           │ │
│  │  LOCAL FALLBACK / DATA NOT AVAILABLE                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Security Controls
| Control | Implementation |
|---------|----------------|
| Credential Isolation | All secrets in `server/.env` (gitignored) |
| Frontend Safety | Browser → `/api/*` only; zero Snowflake creds |
| Runtime OAuth (SPCS) | Token read from `/snowflake/session/token` per request |
| Image Hygiene | Build-time scan: no `.env*`, tokens, secrets |
| Parameterized SQL | All queries use `?` bindings; no string interpolation |
| PAT Policy | `CLEARSET_PAT_POLICY` network rules at user level |
| Least Privilege | Migration path documented in `docs/security/LEAST_PRIVILEGE_ROLE.md` |
| Audit Trail | Human approvals persisted to `RESOLUTION_CASES` |

### 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────┐  │
│  │  BUILD  │───►│  TEST   │───►│  PUSH   │───►│  DEPLOY     │  │
│  │         │    │         │    │         │    │             │  │
│  │ • npm   │    │ • unit  │    │ • snow  │    │ • snow spcs │  │
│  │   build │    │ • integ │    │   login │    │   service   │  │
│  │ • tsc   │    │ • e2e   │    │ • docker│    │   create/   │  │
│  │ • oxlint│    │ • verify│    │   push  │    │   upgrade   │  │
│  └────┬────┘    └────┬────┘    └────┬────┘    └──────┬──────┘  │
│       │              │              │              │          │
│       ▼              ▼              ▼              ▼          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              GITHUB ACTIONS CI/CD PIPELINE                   ││
│  │  On push/PR: lint → typecheck → test → build → deploy       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Environments
| Environment | Purpose | URL |
|-------------|---------|-----|
| Local Dev | Development | `http://localhost:5173` + `http://localhost:3001` |
| Docker Local | Integration | `http://localhost:5173` + `http://localhost:3001` |
| SPCS Production | Live Demo | `https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app` |

### 9. Data Flow Examples

#### Exception Detection → Investigation → Resolution
```
1. Trade booked → TRD-92831 ($2.4M AAPL, Missing Instruction)
2. Exception created → EX-92831 (CRITICAL, Risk 91)
3. Dashboard shows → Exception appears in queue with Risk 91
4. User clicks "Investigate" → InvestigationView opens
5. 10-step workflow executes:
   a. Trade master data lookup
   b. Depository gateway status
   c. SSI directory validation
   c. Counterparty failure history
   e. Historical case search
   f. SOP retrieval (Cortex Search)
   g. Risk score breakdown
   h. Cortex Analyst query
   i. Resolution recommendation
   j. Human approval gate
6. Human clicks "Approve" → Case persisted to RESOLUTION_CASES
7. "Generate Audit Report" → PDF with full evidence chain
8. Case appears in Cases ledger
```

#### Cortex Analyst Query Flow
```
User: "Show me trade TRD-81232 with risk score"
        │
        ▼
┌───────────────────┐
│  Frontend sends   │
│  POST /api/cortex │
│  /analyst         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Backend calls    │
│  Cortex Analyst   │
│  REST API         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Semantic Model   │
│  (CLEARSET_       │
│  ANALYTICS)       │
│  generates SQL    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Snowflake        │
│  executes SQL     │
│  returns rows     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Returns JSON     │
│  with source:     │
│  LIVE SNOWFLAKE   │
└───────────────────┘
```

### 10. Technology Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 19 |
| | TypeScript | 5.x |
| | Vite | 5.x |
| | Tailwind CSS | 3.x |
| | Recharts | 2.x |
| **Backend** | Node.js | 22 (Alpine) |
| | Express | 4.x |
| | TypeScript | 5.x |
| | @snowflake/sdk | Latest |
| **Database** | Snowflake | Enterprise |
| | Cortex Search | Native |
| | Cortex Analyst | Native |
| **AI/ML** | Cortex Search | Native |
| | Cortex Analyst | Native |
| | CoCo CLI | 1.1.66 |
| **Deployment** | Docker | 24.x |
| | SPCS | Snowflake |
| | Docker Registry | Snowflake |
| **CI/CD** | GitHub Actions | Latest |
| **Testing** | Node.js test runner | Native |
| **Linting** | oxlint | Latest |

---

*Document Version: 1.0 | Last Updated: 2026-09-27*