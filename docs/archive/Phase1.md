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

ClearSet AI features a clean, service-oriented architecture designed to transition seamlessly from local intelligence simulation (Phase 1) to live Snowflake Cortex (Phase 2):

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                             REACT 18 UI LAYER                              │
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
│                      (src/services/types.ts)                               │
├──────────────────────┬──────────────────────┬──────────────────────────────┤
│  ISettlementService  │     IRiskService     │       ICortexService         │
│  (Trades, Events,    │  (Deterministic      │  (10-Step Orchestrator,      │
│   SSIs, Metrics)     │   Risk Formula)      │   Copilot Query Grounding)   │
└──────────┬───────────┴──────────┬───────────┴──────────────┬───────────────┘
           │                      │                          │
           ▼                      ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: LOCAL INTELLIGENCE ENGINES                     │
│   LocalSettlementService  •  LocalRiskService  •  LocalCortexService       │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │  (Plug-and-Play Transition to Phase 2)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: LIVE SNOWFLAKE CORTEX ASSETS                   │
│   • Snowflake Relational Tables (TRADES, COUNTERPARTIES, SETTLEMENT_EVENTS)│
│   • Cortex Analyst (Semantic YAML Views for Natural Language Analytics)    │
│   • Cortex Search Service (Vector Search over Staged SOP PDF/MD Docs)      │
│   • Snowflake Agent / CoCo Skills (Autonomous Procedural Workflow)         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. Post-Trade Operations Dashboard (`/dashboard`)
- **Top Telemetry:** Real-time firm metrics (128,420 trades, 386 exceptions, 42 critical, $84.6M gross exposure).
- **Derived State:** Numbers dynamically update as exceptions are investigated and resolved.
- **Critical Priority Queue:** Sorted by deterministic risk score with one-click investigation triggers.
- **Counterparty Fail Concentration:** Horizontal distribution chart identifying high-friction counterparties.
- **Institutional Resolution Memory:** Live ticker of historical playbook success rates.

### 2. Investigation Workspace (`/investigation`)
- **Showcase Target:** `TRD-92831` ($2.4M AAPL trade with missing SSI).
- **Interactive "WHY?" Breakdown:** Clicking any risk dimension navigates directly to the corresponding Evidence tab.
- **10-Step Procedural Workflow Runner:**
  1. `identify_trade` — Query trade economics, ISIN, and booking desk.
  2. `check_settlement_state` — Query SWIFT MT541/548 matching status.
  3. `check_instructions` — Validate SSI against depository participant directory.
  4. `analyze_counterparty` — Compute 30-day failure rate and delay metrics.
  5. `find_similar_cases` — Retrieve institutional memory and prior resolution outcomes.
  6. `retrieve_procedure` — Search Knowledge Base for applicable SOP sections.
  7. `assess_settlement_risk` — Compute mathematical deterministic point breakdown.
  8. `determine_root_cause` — Pinpoint primary failure and contributing factors.
  9. `recommend_resolution` — Formulate actionable 4-step repair plan.
  10. `request_human_approval` — Present resolution package for analyst authorization.
- **Evidence Inspector:** 5 tabs (*Applicable SOP §3.2*, *18 Similar Cases*, *Counterparty CP-192*, *Settlement & SSI*, *Trade Specs*).
- **Human-in-the-Loop Action Panel:** `[ Approve & Dispatch ]` modal that confirms resolution, logs analyst notes, creates an immutable case in `/cases`, avoids $1,566.67/day in CSDR penalties, and simulates SWIFT MT599 repair dispatch.

### 3. AI Copilot (`/copilot`)
- Grounded post-trade copilot supporting 5 core operational queries:
  1. *"Show me critical settlement exceptions approaching cutoff."* → Renders interactive trade card.
  2. *"Investigate TRD-92831."* → Dispatches 10-step procedural workflow runner.
  3. *"Why is TRD-92831 critical?"* → Renders 5-factor point breakdown widget (91/100).
  4. *"What should I do according to our SOP?"* → Renders SOP-OPS-032 §3.2 citation and action protocol.
  5. *"Have we seen this counterparty fail before?"* → Renders CP-192 profile with 7 fails in 30d (8.4% fail rate) and 18 historical cases (88.9% success rate).

### 4. Exceptions Queue (`/exceptions`)
- Institutional data table with multi-dimensional filtering by **Severity** (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), **Asset Class** (`Equities`, `Fixed Income`), and **Status** (`OPEN`, `INVESTIGATING`, `PENDING_APPROVAL`, `RESOLVED`).

### 5. Cases & Institutional Memory Ledger (`/cases`)
- Complete audit trail of past and newly resolved cases. Shows root causes, AI recommendations, human decisions, timestamps, and feedback loops into institutional training memory.

### 6. Policies & SOP Knowledge Base (`/policies`)
- Searchable repository containing binding operations procedures:
  - `SOP-OPS-032`: Settlement Exception Standard Operating Procedure (§3.2 SSI Repair)
  - `SOP-OPS-014`: Intraday Depository Settlement Cutoffs & Escalation Timelines
  - `POL-RSK-008`: Counterparty Settlement Failure & Credit Risk Escalation Policy
  - `REG-EU-909`: Central Securities Depositories Regulation (CSDR Article 7 Settlement Discipline)

---

## ❄️ Snowflake Native Blueprints (Phase 2 Ready)

All SQL DDL, seed data, semantic views, and Cortex Search scripts are prepared in [`snowflake/`](file:///Users/vc/Downloads/Madhan/snowflake/):

| Script | Purpose |
| :--- | :--- |
| [`01_schema.sql`](file:///Users/vc/Downloads/Madhan/snowflake/01_schema.sql) | DDL for `COUNTERPARTIES`, `SECURITIES`, `TRADES`, `SETTLEMENT_INSTRUCTIONS`, `SETTLEMENT_EVENTS`, `EXCEPTIONS`, `HISTORICAL_CASES`, `INVESTIGATIONS` |
| [`02_seeds.sql`](file:///Users/vc/Downloads/Madhan/snowflake/02_seeds.sql) | Institutional financial dataset seeding high-friction counterparties, active trades, and historical cases |
| [`03_semantic_views.sql`](file:///Users/vc/Downloads/Madhan/snowflake/03_semantic_views.sql) | Cortex Analyst semantic views (`V_EXCEPTION_TRIAGE_ANALYTICS`, `V_COUNTERPARTY_PERFORMANCE_ANALYTICS`) |
| [`04_cortex_search.sql`](file:///Users/vc/Downloads/Madhan/snowflake/04_cortex_search.sql) | Cortex Search Service configuration indexing staged SOP markdown and regulatory documents |

---

## 🛠️ Project Structure

```text
Madhan/
├── package.json               # Vite + React 18 + TypeScript + Tailwind v4
├── vite.config.ts             # Vite configuration with @tailwindcss/vite
├── postcss.config.js          # PostCSS configuration with @tailwindcss/postcss
├── index.html                 # App shell with Google Inter font
├── snowflake/                 # Snowflake native SQL blueprints & semantic views
│   ├── 01_schema.sql          # Relational DDL tables
│   ├── 02_seeds.sql           # Financial test seeds
│   ├── 03_semantic_views.sql  # Cortex Analyst views
│   └── 04_cortex_search.sql   # Cortex Search setup
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
│   ├── index.css              # Obsidian theme, color tokens & typography
│   ├── types/                 # TypeScript entity & interface definitions
│   │   ├── index.ts           # Core domain types
│   │   └── services.ts        # Service contracts
│   ├── services/              # Decoupled service layer
│   │   ├── types.ts           # ISettlementService, IRiskService, ICortexService
│   │   ├── settlementService.ts # Local mock / future Snowflake SQL adapter
│   │   ├── riskService.ts     # Deterministic risk engine
│   │   ├── cortexService.ts   # 10-step stepper & grounded copilot handler
│   │   └── knowledgeService.ts# SOP search & retrieval
│   ├── context/
│   │   └── AppContext.tsx     # Global state management & dynamic metric derivation
│   ├── data/
│   │   ├── syntheticData.ts   # Consistent financial entities & historical cases
│   │   └── knowledgeBase.ts   # Post-trade standard operating procedures
│   ├── components/
│   │   └── layout/
│   │       ├── Navbar.tsx     # Brand, live exposure, search & telemetry badge
│   │       └── Sidebar.tsx    # Navigation & priority risk triage widget
│   └── views/
│       ├── DashboardView.tsx     # Metrics, priority queue, fail distribution
│       ├── InvestigationView.tsx # Hero showcase workspace for TRD-92831
│       ├── CopilotView.tsx       # Grounded Cortex Agent chat interface
│       ├── ExceptionsView.tsx    # High-density exception table with filters
│       ├── CasesView.tsx         # Cases ledger & audit trail
│       └── PoliciesView.tsx      # SOP & policy knowledge explorer
```

---

## ⚡ Quickstart & Running Locally

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Start Vite local development server
npm run dev
```

The application will launch at **`http://localhost:5173/`**.

### Build Verification
```bash
# Type check and build production bundle
npm run build
```

---

## 🏆 Hackathon Evaluation Summary

- **Domain-Specific AI Copilot:** Built strictly for capital markets post-trade exception management.
- **Deterministic & Explainable:** Mathematical 91-point score on `TRD-92831` with zero hallucinations.
- **Procedural Agent Workflow:** 10-step investigation workflow with live telemetry log streaming.
- **Evidence Traceability:** Complete visual lineage from risk factors into raw depository events, counterparty metrics, and SOP citations.
- **Human-in-the-Loop:** Sensitive SWIFT MT599 dispatch and case creation strictly require human analyst authorization.
- **Snowflake-Native Ready:** Full DDL, seeds, semantic views, and Cortex Search scripts prepared for Phase 2.
