# ClearSet AI — Complete Project Guide

## 1. What ClearSet AI solves

ClearSet AI is a post-trade settlement operations copilot. It helps an operations analyst find, understand, investigate, and resolve trades that might fail to settle.

In capital markets, a trade is not complete when it is booked. It must still settle: securities and cash must move correctly between parties. A missing settlement instruction, a cash mismatch, an approaching market cutoff, or a counterparty with repeated failures can turn a normal trade into an expensive operational exception.

ClearSet AI turns that manual process into a guided workflow:

```text
Trade / settlement data
        ↓
Exception detection and deterministic risk score
        ↓
Evidence, counterparty history, and policy retrieval
        ↓
Recommended action
        ↓
Human approval before any operational action
```

### Business value

| Challenge | ClearSet AI benefit |
|---|---|
| Analysts work across many systems and spreadsheets. | One workspace combines trade, settlement, counterparty, history, and policy evidence. |
| Settlement cutoffs create time pressure. | High-risk cases are prioritized by an explainable score. |
| AI answers can be untrusted. | Risk factors, data sources, and SOP references are visible to the analyst. |
| Historical operating knowledge is hard to find. | Cortex Search retrieves relevant SOP and policy material. |
| Automated actions can be unsafe. | Human approval remains the final control point. |

---

## 2. The demo case: TRD-92831

`TRD-92831` is the primary demonstration trade because it has several clear settlement-risk signals:

| Field | Demo value | Why it matters |
|---|---:|---|
| Trade value | $2,400,000 | A failed high-value trade creates larger exposure. |
| Exception | Missing Instruction | The trade cannot settle without valid settlement instructions. |
| Settlement status | PENDING | The operational process has not completed. |
| Instruction / SSI status | MISSING | A direct root-cause signal. |
| Counterparty | Apex Prime Clearing Ltd. / CP-192 | Counterparty history contributes to risk. |
| Risk score | 91 / 100 | A deterministic, explainable priority score. |

The score is designed to show **why** a case is urgent rather than simply labeling it “high risk.” The app displays factors such as missing SSI, cutoff proximity, trade value, and prior counterparty failures.

---

## 3. Architecture at a glance

```text
                         Browser
                           │
                           ▼
                  React / Vite frontend
       Dashboard · Queue · Investigation · Copilot
                           │ /api
                           ▼
                   Express backend proxy
          Data APIs · Cortex Analyst · Cortex Search
                           │
             SPCS OAuth token + Snowflake host
                           │
                           ▼
                      Snowflake
  Tables / Views · Semantic model · Cortex Analyst · Cortex Search
```

The React browser application never receives Snowflake credentials. All Snowflake communication is server-side through the Express service deployed to Snowpark Container Services (SPCS).

### Why this architecture is useful

- **Security:** credentials and the SPCS OAuth token stay inside the container.
- **Governance:** Snowflake role and data permissions continue to apply.
- **Reliability:** the frontend can use local fallback data when live services are unavailable.
- **Demo quality:** the user sees a polished application, while the actual data/AI services remain Snowflake-native.

---

## 4. Repository map

```text
clearset-ai/
├── src/                    React frontend
├── server/                 Express API and Snowflake integration
├── snowflake/              SQL and semantic/Cortex asset definitions
├── skills/                 Human-readable procedural agent instructions
├── public/                 Static assets
├── Dockerfile              SPCS container image recipe
├── service-spec.yaml       Existing SPCS service configuration
├── README.md               Technical setup and API documentation
└── CLEARSET_AI_PROJECT_GUIDE.md  This guide
```

---

## 5. Frontend: `src/`

The frontend is a React + TypeScript application. Its job is to present operational information, let users investigate exceptions, and call the backend APIs.

### 5.1 Application entry and shell

| File / folder | What it does | Benefit |
|---|---|---|
| `src/main.tsx` | Starts the React application. | Provides the browser entry point. |
| `src/App.tsx` | Composes the application shell and active view. | Keeps navigation and page switching consistent. |
| `src/index.css`, `src/App.css` | Global visual theme and application styling. | Creates the dark enterprise ClearSet visual language. |
| `src/components/layout/Navbar.tsx` | Top navigation, search, metrics, and connection indicator. | Makes live Snowflake versus local fallback status visible. |
| `src/components/layout/Sidebar.tsx` | Main navigation and priority badges. | Keeps exception triage one click away. |

### 5.2 Shared state: `src/context/AppContext.tsx`

`AppContext` is the frontend’s operational state manager. It owns the currently loaded exceptions, dashboard metrics, cases, selected investigation, Copilot messages, and backend mode.

```text
Backend health check
        ↓
AppContext decides: live Snowflake or local fallback
        ↓
Views render from the same shared exceptions / cases / metrics
```

Important responsibilities:

- Calls the backend health endpoint and records `checking`, `live`, or `local` mode.
- Loads exceptions and related data through service interfaces.
- Derives dashboard metrics from the active dataset.
- Selects an exception for investigation.
- Keeps navigation, Copilot, dashboard, and cases in sync.

**Benefit:** views do not invent separate copies of the data. A resolved case or selected trade is reflected throughout the application.

### 5.3 Domain model: `src/types/`

`src/types/index.ts` defines the common business entities:

| Entity | Meaning |
|---|---|
| `Trade` | Security, amount, counterparty, settlement state, and cutoff details. |
| `ExceptionItem` | A trade that needs operational review, including severity and risk score. |
| `Counterparty` | Counterparty profile and prior-failure history. |
| `SettlementInstruction` | SSI / settlement account information. |
| `SettlementEvent` | Depository, SWIFT, ISO, or internal process event. |
| `RiskScoreBreakdown` | Total score plus the factors that produced it. |
| `CaseRecord` | Human decision, audit trail, and resolution outcome. |
| `PolicyDocument` | SOP / policy content and required actions. |

**Benefit:** strict TypeScript models make frontend and backend data handling safer and easier to explain.

---

## 6. User-facing views: `src/views/`

### 6.1 `DashboardView.tsx` — Operations dashboard

The restored original ClearSet dashboard contains:

| Section | What it shows | Operational benefit |
|---|---|---|
| Operations banner | Surveillance status and fast actions. | Immediately tells an analyst what the screen is for. |
| Metric cards | Trades monitored, exception count, critical count, exposure, and settlement rate. | Gives a quick shift-level view of operations. |
| Critical priority queue | Top critical exceptions with risk, value, cutoff, counterparty, and investigation action. | Directs attention to the most urgent work. |
| Counterparty fail chart | Concentration of prior failures by counterparty. | Reveals repeat operational friction. |
| Institutional playbooks | SOP-focused summary cards. | Makes the response process visible to an analyst. |

The queue and chart use the current exception dataset. It works with both live Snowflake responses and local fallback data.

> Note: A few original dashboard display values are intentionally demo/illustrative values. They should be presented as operational-demo context, not as newly calculated live Snowflake metrics.

### 6.2 `ExceptionsView.tsx` — Exception queue

This is the working list of settlement exceptions. It supports reviewing and filtering records by severity, status, and other operational fields.

**Benefit:** analysts can move from portfolio-level monitoring to the specific case that needs work.

### 6.3 `InvestigationView.tsx` — Evidence workspace

This is the heart of the product. When an analyst opens a trade, ClearSet presents a guided investigation rather than a single opaque AI answer.

The investigation flow covers:

1. Identify the trade and its economics.
2. Check settlement state.
3. Validate settlement instructions / SSI.
4. Examine counterparty history.
5. Find similar past cases.
6. Retrieve an applicable SOP.
7. Calculate deterministic settlement risk.
8. Determine root cause.
9. Recommend a resolution.
10. Request human approval.

Evidence tabs provide trade details, settlement events, counterparty information, history, and policies.

**Benefit:** the analyst can challenge the recommendation, inspect the source evidence, and make an accountable decision.

### 6.4 `CopilotView.tsx` — AI assistant

The Copilot accepts operational questions such as:

- “Show me critical settlement exceptions approaching cutoff.”
- “Why is TRD-92831 critical?”
- “What should I do according to our SOP?”

It first tries the live Cortex Analyst backend path for structured questions. Policy-retrieval steps can use Cortex Search. If a live call is unavailable, it gracefully falls back to local, pre-defined operational responses.

**Benefit:** this gives a useful demo and local-development experience without pretending that unavailable live AI output is live.

### 6.5 `CasesView.tsx` — Cases ledger

The cases ledger stores and displays approved, rejected, or pending operational decisions and their audit trail.

**Benefit:** supports traceability, accountability, and review after a settlement incident.

### 6.6 `PoliciesView.tsx` — SOP knowledge base

This view lets users inspect policies and procedures relevant to exception resolution.

**Benefit:** reduces time spent looking for operating instructions and helps keep recommendations aligned with policy.

---

## 7. Frontend service layer: `src/services/`

The service layer separates views from data-source details.

| File | Responsibility | Benefit |
|---|---|---|
| `types.ts` | Interfaces for settlement, risk, knowledge, and Cortex services. | Makes live and local implementations interchangeable. |
| `apiClient.ts` | Browser-safe calls to `/api/...`. | The browser never calls Snowflake directly. |
| `settlementService.ts` | Retrieves/massages trade, exception, event, and metric data. | Preserves a local fallback mode. |
| `riskService.ts` | Deterministic risk calculations. | Makes scoring explainable and repeatable. |
| `knowledgeService.ts` | Policy retrieval, including Cortex Search when live. | Connects recommendations to SOP information. |
| `cortexService.ts` | Hybrid Cortex Analyst/Search behavior and local fallback. | Provides AI assistance without making the app brittle. |

### Cortex object-rendering protection

`cortexService.ts` has a safe value formatter. If Snowflake/Cortex returns a nested object, the frontend serializes it using `JSON.stringify(...)` rather than allowing React/JavaScript to display `[object Object]`.

**Benefit:** results remain readable and a common live-demo rendering bug is avoided.

---

## 8. Backend: `server/`

The server is a small Express API that sits between the browser and Snowflake.

### 8.1 `server/index.ts`

This file defines the HTTP API.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Reports whether the backend has live Snowflake connectivity. |
| `GET /api/exceptions` | Returns settlement exceptions. |
| `GET /api/trades` | Returns trade data. |
| `GET /api/counterparties/:id` | Returns counterparty data. |
| `GET /api/settlement-events/:tradeId` | Returns settlement events. |
| `POST /api/cortex/search` | Queries Cortex Search for policy/SOP material. |
| `POST /api/cortex/analyst` | Sends a natural-language question to Cortex Analyst. |

**Benefit:** API contracts are centralized, credentials stay server-side, and the frontend stays simple.

### 8.2 `server/snowflakeClient.ts`

This module creates Snowflake SDK connections.

It has two supported modes:

```text
Local development
  Environment-based Snowflake connection configuration

SPCS runtime
  SNOWFLAKE_HOST + /snowflake/session/token OAuth authentication
```

In SPCS, Snowflake injects the OAuth token at `/snowflake/session/token`. The server reads it internally and never sends it to the browser.

**Benefit:** the deployed application authenticates with Snowflake-native runtime identity rather than embedding a password or PAT in the container.

---

## 9. Snowflake capabilities

### 9.1 Structured settlement data

The Snowflake layer contains the operational entities needed for settlement analysis: trades, counterparties, instructions, events, exceptions, historical cases, and investigations.

**Benefit:** AI and dashboards use governed, centralized business data rather than disconnected mock APIs.

### 9.2 Semantic model / Cortex Analyst

Cortex Analyst receives natural-language questions and converts them into governed analytical queries using the ClearSet semantic configuration.

Example question:

```text
What is the highest-risk pending trade with a missing instruction?
```

**Benefit:** reduces the need for analysts to write SQL while keeping the answer tied to the approved semantic data model.

### 9.3 Cortex Search

Cortex Search retrieves matching SOP and policy content from indexed operational knowledge.

Example search intent:

```text
What is the escalation procedure for a missing settlement instruction near cutoff?
```

**Benefit:** gives the analyst relevant procedures at the moment of decision.

### 9.4 SPCS deployment

The application runs in Snowpark Container Services:

```text
Docker image → Snowflake image registry → existing SPCS service → public endpoint
```

The current service exposes port `8080`, uses `/api/health` as its readiness probe, and has a public endpoint protected by Snowflake ingress authentication.

**Benefit:** the UI, backend, Snowflake access, and Cortex integrations run within the Snowflake environment.

---

## 10. Local fallback mode

ClearSet intentionally preserves local data and local Copilot behavior.

```text
Live backend reachable? ── yes → use live Snowflake data / Cortex paths
                         no  → use local data and safe local responses
```

This is not a replacement for live Snowflake. It is a resilience and development feature.

**Benefit:** the application can still be demonstrated, developed, and visually tested when a backend, browser session, or Snowflake service is unavailable.

---

## 11. Skills: `skills/`

The skill folders document procedural workflows such as:

- `investigate_exception`
- `assess_settlement_risk`
- `find_similar_cases`
- `retrieve_procedure`
- `determine_root_cause`
- `recommend_resolution`
- `escalate_exception`

These are useful operational blueprints: they specify what an AI-assisted workflow should do, the evidence it should inspect, and the intended business result.

**Benefit:** they make the agentic design understandable, repeatable, and easier to extend. In the present application, the user-facing 10-step flow is implemented primarily in the service/UI layer; these files serve as the procedural design foundation.

---

## 12. Snowflake SQL assets: `snowflake/`

| Asset | Purpose |
|---|---|
| `01_schema.sql` | Database schema and primary operational tables. |
| `02_seeds.sql` | Demonstration data including the hero trade and counterparties. |
| `03_semantic_views.sql` | Analytical views for semantic/Cortex use. |
| `04_cortex_search.sql` | Cortex Search configuration for SOP/policy knowledge. |
| `05_validation.sql`, `06_cortex_search_validation.sql`, `07_cortex_analyst_validation.md` | Verification material for the Snowflake assets. |
| Semantic YAML files | Natural-language analytical model definitions. |

**Benefit:** these files make the data, semantic model, and AI-search setup reproducible and reviewable.

---

## 13. Deployment and security files

| File | Purpose | Benefit |
|---|---|---|
| `Dockerfile` | Packages pre-built frontend and backend into a Node Alpine container. | Reproducible application image. |
| `service-spec.yaml` | Defines the existing SPCS container, resources, health probe, environment, and public endpoint. | Consistent deployment configuration. |
| `alter-service.sql` | SQL form of the existing service update specification. | Useful deployment reference. |
| `.dockerignore` | Keeps unnecessary files out of the Docker build context. | Reduces image size and exposure risk. |

### Security model

- Browser code has no Snowflake credentials.
- SPCS uses the injected OAuth token at runtime.
- The OAuth token is not printed or baked into the image.
- No external access integration is needed for internal Snowflake Cortex access.
- The service uses a readiness endpoint so SPCS waits for the application before routing traffic.

---

## 14. End-to-end user journey

```text
1. Analyst opens Dashboard
2. Finds critical exception TRD-92831
3. Opens Investigation Workspace
4. Reviews trade, SSI, settlement events, counterparty, and policy evidence
5. Sees deterministic risk score and root cause
6. Uses Copilot for an analytical or SOP question
7. Reviews a recommended resolution
8. Approves, rejects, or modifies the action
9. Case and audit trail are available in the Cases Ledger
```

### Why this is stronger than a simple chatbot

A simple chatbot can answer a question. ClearSet AI provides a structured operational system:

- it prioritizes work,
- explains risk,
- shows evidence,
- retrieves policy,
- preserves human control, and
- records decisions.

---

## 15. How to present it to a hackathon judge

Use this short narrative:

> “ClearSet AI is a Snowflake-native post-trade settlement copilot. It uses governed settlement data to surface the highest-risk exceptions, Cortex Analyst for structured natural-language analysis, Cortex Search for SOP retrieval, and SPCS OAuth for secure deployment. The AI never acts alone: it provides evidence and a recommendation, while a human analyst owns the final decision.”

Recommended live demo order:

1. Dashboard: show the operations view and live Snowflake indicator.
2. Open `TRD-92831` from the priority queue.
3. Explain the deterministic 91/100 score.
4. Show the evidence tabs and missing SSI root cause.
5. Ask Copilot a Cortex Analyst question.
6. Retrieve the relevant SOP through Cortex Search.
7. Show human approval and the resulting case audit trail.
8. Close with the SPCS/OAuth security architecture.

---

## 16. Important current limitations and next steps

| Area | Current state | Good next step |
|---|---|---|
| Dashboard display values | Some original dashboard indicators are illustrative. | Derive all displayed operational metrics from live APIs. |
| Hybrid AI behavior | Live Cortex has local fallback for resilience. | Add a visible per-response “live” or “fallback” provenance badge. |
| Skills | Present as documented procedural blueprints. | Connect skill definitions directly to a runtime orchestration layer. |
| Runtime role | Current deployment uses a powerful Snowflake role for the demo. | Use a dedicated least-privilege production role. |
| Authenticated browser validation | SPCS ingress requires an authenticated Snowflake browser session. | Maintain a short demo checklist for an already authenticated browser. |

These are not reasons the project is weak. They are the clearest path from a strong hackathon prototype to a more production-ready operations platform.
