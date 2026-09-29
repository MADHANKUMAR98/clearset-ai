# ClearSet AI

## Snowflake CoCo CLI Hackathon 2026

**Problem Statement:** Domain-Specific AI Copilot  
**Domain:** Financial Services / Capital Markets / Post-Trade Operations  
**Project Type:** Snowflake-native AI application  
**Current Status:** Phase 1 complete — waiting for dedicated Snowflake trial account

---

# 1. Executive Summary

**ClearSet AI** is a domain-specific AI copilot for post-trade operations in financial markets.

It helps operations analysts **detect, investigate, explain, and resolve settlement exceptions** by combining structured trade data, settlement information, counterparty history, historical cases, operational SOPs, and AI-driven investigation.

The final goal is to make Snowflake the central **data + intelligence + AI workflow platform** behind the application.

The application is intentionally more than a chatbot:

```text
Financial Data
      +
Historical Cases
      +
Operational SOPs
      +
Risk Analysis
      +
Snowflake Cortex
      +
CoCo / Agentic Workflow
      ↓
Evidence-backed AI Investigation
      ↓
Human Approval
      ↓
Auditable Resolution
```

---

# 2. Hackathon Problem Statement

We selected:

## Domain-Specific AI Copilot

The selected use case is specifically focused on:

> **Capital-markets post-trade settlement exception management.**

The copilot is designed to understand financial-domain concepts and provide actionable recommendations instead of generic AI responses.

It works with concepts such as:

- Trades
- Securities
- Settlement
- DVP / RVP / FOP
- Standing Settlement Instructions (SSI)
- Counterparties
- Custodians
- Settlement cutoffs
- SWIFT messages
- ISO 20022 events
- Settlement failures
- Historical investigation cases
- Operational SOPs
- Escalation policies
- Settlement risk

---

# 3. Why We Chose This Problem

Post-trade operations can involve large volumes of trades and settlement events.

When an exception occurs, an analyst may need to manually investigate:

1. Which trade is affected?
2. What is its settlement status?
3. Is the SSI missing or incorrect?
4. Has the counterparty failed before?
5. Have similar cases happened previously?
6. What does the relevant SOP say?
7. How severe is the risk?
8. What is the likely root cause?
9. What action should be taken?
10. Should the exception be escalated or resolved?

ClearSet AI turns this fragmented workflow into one guided AI investigation.

---

# 4. Complete Project Phases

The project is divided into the following phases.

```text
PHASE 0
Hackathon Strategy & Architecture
        ↓
PHASE 1
Local MVP / Product Prototype
        ↓
PHASE 2
Snowflake Data Foundation
        ↓
PHASE 3
Snowflake Cortex Intelligence
        ↓
PHASE 4
CoCo CLI / Agentic Workflow
        ↓
PHASE 5
Secure Backend Integration
        ↓
PHASE 6
End-to-End Snowflake AI Copilot
        ↓
PHASE 7
Enterprise Workflow & Auditability
        ↓
PHASE 8
Demo & UX Optimization
        ↓
PHASE 9
Hackathon Submission
        ↓
PHASE 10
Finale / Judge Demonstration
```

---

# 5. Phase 0 — Hackathon Strategy & Architecture

**Status: COMPLETE**

The objective of Phase 0 was to understand the hackathon and design a solution that directly addresses the evaluation criteria.

### Decisions made

- Problem statement: **Domain-Specific AI Copilot**
- Industry: **Financial Services / Capital Markets**
- Domain: **Post-Trade Operations**
- Primary workflow: **Settlement Exception Investigation**
- Application name: **ClearSet AI**
- UI: React + TypeScript
- Initial implementation: Local synthetic data
- Final platform: Snowflake + Cortex + CoCo
- Human-in-the-loop approval
- Evidence-backed recommendations
- Explainable risk scoring

### Hackathon evaluation alignment

| Evaluation Area | Weight | ClearSet Strategy |
|---|---:|---|
| Real-World Relevance | 30% | Realistic post-trade settlement problem |
| Technical Execution | 40% | Snowflake + Cortex + CoCo + agentic workflow |
| Solution Completeness | 30% | Detection → Investigation → Recommendation → Human Approval |

---

# 6. Phase 1 — Local MVP / Product Prototype

**Status: COMPLETE**

This phase was created while waiting for the dedicated Snowflake environment.

The goal was to build the complete product experience before connecting Snowflake.

### Current architecture

```text
React UI
   ↓
AppContext
   ↓
Service Interfaces
   ├── ISettlementService
   ├── IRiskService
   ├── ICortexService
   └── IKnowledgeService
   ↓
Local Implementations
   ├── LocalSettlementService
   ├── LocalRiskService
   ├── LocalCortexService
   └── LocalKnowledgeService
```

The service abstraction is important because Phase 2 can replace local services with Snowflake-backed services without rebuilding the UI.

---

# 7. Phase 1 Features

## 7.1 Dashboard

The dashboard provides:

- Trade metrics
- Exception metrics
- Critical exception count
- Exposure
- Settlement health
- Risk distribution
- Priority exception queue
- AI investigation entry points

---

## 7.2 Exceptions Workspace

The exceptions screen provides:

- Search
- Filtering
- Severity
- Risk score
- Trade value
- Counterparty
- Cutoff urgency
- Investigation launch

---

## 7.3 Investigation Workspace

This is the main showcase screen.

It contains:

- Trade details
- Risk score
- Risk-factor breakdown
- Investigation workflow
- Settlement information
- SSI information
- Counterparty intelligence
- Historical cases
- SOP/policy evidence
- Settlement event timeline
- Root cause
- AI recommendation
- Human approval

---

## 7.4 AI Copilot

The Copilot supports the main demonstration questions:

```text
Show me critical settlement exceptions approaching cutoff.

Investigate TRD-92831.

Why is TRD-92831 critical?

What should I do according to our SOP?

Have we seen this counterparty fail before?
```

Phase 1 answers these using local synthetic data.

Phase 3+ will replace this with real Snowflake/Cortex intelligence.

---

## 7.5 Evidence Traceability

Every important recommendation should be traceable.

Example:

```text
Risk Factor
    ↓
Supporting Data
    ↓
Historical Evidence
    ↓
Applicable SOP
    ↓
Root Cause
    ↓
Recommendation
```

Example:

```text
Missing SSI +25
      ↓
Settlement & SSI Evidence

Cutoff +25
      ↓
Settlement Timeline

Counterparty History +15
      ↓
Counterparty Profile

Historical Pattern +6
      ↓
Similar Cases
```

---

# 8. Showcase Case — TRD-92831

The primary demo scenario is synthetic trade:

## TRD-92831

Characteristics:

- AAPL US equities
- DVP settlement
- Trade value: $2.4M
- Missing settlement instruction
- Settlement cutoff approaching
- Counterparty: CP-192
- 7 previous counterparty failures
- 18 similar historical cases

---

# 9. Explainable Risk Engine

The risk engine is deterministic.

For TRD-92831:

```text
Missing Settlement Instruction       +25
Cutoff Approaching                   +25
High-Value Transaction               +20
Counterparty Failure History         +15
Historical Pattern                    +6
                                      ---
Total                                  91
```

Result:

```text
91 / 100
CRITICAL
```

The application can explain every point rather than presenting an unexplained AI score.

This is important for financial operations because users need to understand **why** an exception is considered risky.

---

# 10. Ten-Step Investigation Workflow

The core workflow is:

```text
1. Identify Trade
        ↓
2. Check Settlement State
        ↓
3. Check Instructions
        ↓
4. Analyze Counterparty
        ↓
5. Find Similar Cases
        ↓
6. Retrieve Applicable Procedure
        ↓
7. Assess Risk
        ↓
8. Determine Root Cause
        ↓
9. Generate Recommendation
        ↓
10. Request Human Approval
```

Phase 1 simulates this workflow.

Phase 4 will connect it to real Snowflake/CoCo capabilities.

---

# 11. Human-in-the-Loop

ClearSet should never silently perform sensitive operational actions.

The intended process is:

```text
AI Recommendation
       ↓
Evidence Review
       ↓
Human Decision
       ↓
Approve / Reject / Escalate
       ↓
Case Created
       ↓
Audit Trail
```

Phase 1 implements this locally.

Later phases will make the underlying data and actions Snowflake-backed.

---

# 12. Phase 2 — Snowflake Data Foundation

**Status: WAITING FOR DEDICATED SNOWFLAKE ACCOUNT**

This phase begins when the dedicated trial account is available.

The objective is to move the application's synthetic financial data into Snowflake.

### Planned database structure

```text
CLEARSET_DB
│
├── RAW
│   ├── TRADES
│   ├── SECURITIES
│   ├── COUNTERPARTIES
│   ├── SETTLEMENT_INSTRUCTIONS
│   ├── SETTLEMENT_EVENTS
│   └── EXCEPTIONS
│
├── ANALYTICS
│   ├── HISTORICAL_CASES
│   ├── INVESTIGATIONS
│   └── AUDIT_LOG
│
└── AI
    └── AI / Search / Semantic Assets
```

### Tasks

1. Create Snowflake database.
2. Create schemas.
3. Create tables.
4. Load synthetic data.
5. Validate relationships.
6. Run analytical queries.
7. Verify access from the backend.

---

# 13. Why Snowflake Matters

Snowflake should not be included merely as a database.

The final application should demonstrate Snowflake as the central intelligence platform.

Target architecture:

```text
                CLEARSET AI
                     │
              React Application
                     │
                 API Layer
                     │
             ┌───────┴────────┐
             │    Snowflake   │
             │                │
             │ Structured Data│
             │ Cortex Analyst │
             │ Cortex Search  │
             │ CoCo / Agents  │
             └────────────────┘
```

The important story is:

```text
Snowflake Data
      +
Cortex Intelligence
      +
Cortex Search
      +
CoCo Agentic Workflow
      ↓
Domain-Specific AI Copilot
```

---

# 14. Phase 3 — Snowflake Cortex Intelligence

**Status: PLANNED**

This phase introduces actual Snowflake AI capabilities.

It has two major components.

---

## 14.1 Cortex Analyst

Cortex Analyst will handle structured-data questions.

Example:

> Show me critical settlement exceptions approaching cutoff.

Target flow:

```text
Natural Language
       ↓
Cortex Analyst
       ↓
Semantic Model
       ↓
Snowflake Data
       ↓
Analysis
       ↓
Grounded Answer
```

The semantic model should understand:

- Trade value
- Settlement status
- Exception severity
- Cutoff urgency
- Counterparty failure rate
- Asset class
- Failed trades
- Exposure
- Resolution time

---

# 15. Cortex Search

Cortex Search will become the knowledge retrieval layer.

Potential documents:

- Settlement Exception SOP
- Settlement Cutoff Procedure
- Counterparty Escalation Policy
- SSI Repair Procedure
- Settlement Discipline guidance

Target flow:

```text
User Question
      ↓
ClearSet Copilot
      ↓
Cortex Search
      ↓
Relevant SOP / Policy
      ↓
Evidence
      ↓
Recommendation
```

The objective is for the AI recommendation to be grounded in actual operational documents.

---

# 16. Phase 4 — CoCo CLI / Agentic Workflow

**Status: PLANNED**

This phase is one of the most important hackathon components.

The current 10-step workflow will be connected to the actual Snowflake CoCo/agentic environment.

Target:

```text
User
 ↓
CoCo / Agent
 ↓
Identify Exception
 ↓
Query Snowflake
 ↓
Analyze Settlement
 ↓
Check SSI
 ↓
Analyze Counterparty
 ↓
Search Historical Cases
 ↓
Retrieve SOP
 ↓
Assess Risk
 ↓
Determine Root Cause
 ↓
Generate Recommendation
 ↓
Human Approval
```

The exact implementation will be adapted to the capabilities available in the dedicated hackathon account.

We must not claim CoCo is live until it is actually connected and tested.

---

# 17. Phase 5 — Secure Backend Integration

**Status: PLANNED**

The React application should not connect directly to Snowflake using privileged credentials.

Target architecture:

```text
React
  ↓
FastAPI Backend
  ↓
Snowflake
```

Preferred backend:

**Python + FastAPI**

Responsibilities:

- Authentication/session handling where required
- Snowflake connectivity
- Query execution
- Cortex integration
- Search integration
- Agent orchestration
- Case operations
- Audit operations

---

# 18. Phase 6 — End-to-End Snowflake AI Copilot

**Status: PLANNED**

This is where the local prototype becomes the actual Snowflake-powered product.

The target flow:

```text
User Question
      ↓
React Copilot
      ↓
Backend
      ↓
Snowflake / Cortex / CoCo
      ↓
Structured Data
      +
Historical Cases
      +
SOP Knowledge
      ↓
Investigation
      ↓
Evidence
      ↓
Root Cause
      ↓
Recommendation
      ↓
Human Approval
```

Example:

### User

> Why is TRD-92831 critical?

### System

Retrieves:

- Trade value
- SSI status
- Settlement cutoff
- Counterparty history
- Historical cases

Then calculates/returns the risk explanation.

---

# 19. Phase 7 — Enterprise Workflow & Auditability

**Status: PLANNED**

This phase focuses on trust and operational controls.

Capabilities:

- Human approval
- Rejection
- Escalation
- Case creation
- Investigation history
- Audit logs
- Recommendation history
- Resolution outcome
- Evidence traceability

Target:

```text
AI Decision
    ↓
Evidence
    ↓
Human Approval
    ↓
Action
    ↓
Audit Log
```

This is especially important for financial-domain applications.

---

# 20. Phase 8 — Demo & UX Optimization

**Status: PLANNED**

After the real Snowflake integration works, we will optimize the application specifically for the judges.

We will not try to demonstrate every feature.

Instead, we will build one strong story.

### Main demo

```text
Dashboard
    ↓
Critical Exception
    ↓
TRD-92831
    ↓
91/100 Risk
    ↓
Ask Copilot "Why?"
    ↓
Snowflake Evidence
    ↓
Historical Cases
    ↓
Cortex Search SOP
    ↓
CoCo Investigation
    ↓
Root Cause
    ↓
Recommendation
    ↓
Human Approval
    ↓
Audit Trail
```

---

# 21. Phase 9 — Hackathon Submission

**Status: PLANNED**

Final submission package:

- Working application
- GitHub repository
- README
- Architecture diagram
- Snowflake architecture
- Database schema
- AI workflow explanation
- Demo video
- Screenshots
- Problem statement explanation
- Business value
- Technical implementation
- Judging-rubric mapping

---

# 22. Phase 10 — Finale / Judge Demonstration

**Status: PLANNED**

The final presentation should focus on:

### Problem

Post-trade settlement exceptions require fragmented manual investigation.

### Solution

ClearSet AI brings data, history, SOPs and AI investigation into one workspace.

### Technology

```text
React
  +
FastAPI
  +
Snowflake
  +
Cortex Analyst
  +
Cortex Search
  +
CoCo / Agentic Workflow
```

### Outcome

An evidence-backed AI copilot that helps analysts investigate settlement exceptions faster and more consistently while keeping humans in control.

---

# 23. Service Architecture

Phase 1 already uses service abstractions.

Current:

```text
ISettlementService
       ↓
LocalSettlementService

IRiskService
       ↓
LocalRiskService

ICortexService
       ↓
LocalCortexService

IKnowledgeService
       ↓
LocalKnowledgeService
```

Future:

```text
ISettlementService
       ↓
SnowflakeSettlementService

IRiskService
       ↓
SnowflakeRiskService

ICortexService
       ↓
SnowflakeCortexService

IKnowledgeService
       ↓
CortexSearchService
```

This allows us to replace the implementation without rebuilding the entire UI.

---

# 24. Snowflake SQL Assets

The project already contains/should contain SQL preparation assets:

```text
snowflake/
├── 01_schema.sql
├── 02_seeds.sql
├── 03_semantic_views.sql
└── 04_cortex_search.sql
```

These will be reviewed against the actual Snowflake account before execution.

We should not assume every SQL statement will work unchanged until tested in the provisioned environment.

---

# 25. Data Strategy

All demonstration data should be synthetic.

Example:

```text
TRD-92831
CP-192
AAPL
$2.4M
```

These are fictional demonstration entities.

Do not use:

- Confidential company data
- Production trade data
- Internal DTCC data
- Customer information
- Credentials
- Private operational documents

The purpose is to demonstrate the architecture and business workflow safely.

---

# 26. What Makes ClearSet Different From a Generic AI Chatbot?

Generic chatbot:

```text
Question
   ↓
LLM
   ↓
Text Response
```

ClearSet:

```text
Question
   ↓
Domain-Specific Copilot
   ↓
Snowflake Structured Data
   ↓
Cortex Analyst
   ↓
Cortex Search
   ↓
Historical Cases
   ↓
CoCo Agentic Investigation
   ↓
Risk Analysis
   ↓
Evidence
   ↓
Recommendation
   ↓
Human Approval
   ↓
Auditable Case
```

The differentiator is the **end-to-end domain workflow**.

---

# 27. Business Value

Potential benefits:

- Faster exception triage
- Reduced investigation effort
- Earlier identification of high-risk settlements
- Consistent SOP application
- Better counterparty intelligence
- Reuse of historical operational knowledge
- Evidence-backed recommendations
- Improved auditability
- Better operational decision support

The hackathon prototype should demonstrate these benefits rather than claim production-level financial impact.

---

# 28. Demo Script

The final demo should follow this story.

### Step 1 — Dashboard

Show the settlement operations dashboard.

Say:

> "This is the post-trade operations control center. ClearSet continuously prioritizes settlement exceptions based on operational and financial risk."

### Step 2 — Critical Exception

Open TRD-92831.

Say:

> "This trade is worth $2.4 million and has a critical settlement exception."

### Step 3 — Risk

Show:

```text
91 / 100
CRITICAL
```

Explain the five factors.

### Step 4 — AI Investigation

Run the 10-step investigation.

### Step 5 — Evidence

Show:

- SSI issue
- Cutoff
- Counterparty history
- Historical cases
- SOP

### Step 6 — Copilot

Ask:

> "Why is TRD-92831 critical?"

Then:

> "What should I do according to the SOP?"

### Step 7 — Recommendation

Show the root cause and recommended action.

### Step 8 — Human Approval

Show:

```text
AI Recommendation
       ↓
Analyst Review
       ↓
Approve
```

### Step 9 — Case

Show the generated investigation case and audit trail.

### Step 10 — Snowflake Architecture

Explain that the final version uses Snowflake as the central data and AI layer.

---

# 29. What We Should NOT Do

Avoid unnecessary complexity.

Do not:

- Build unrelated features.
- Add random AI features.
- Build a generic chatbot.
- Use confidential financial data.
- Claim Snowflake integration before testing it.
- Claim CoCo execution when it is only simulated.
- Put Snowflake credentials in React.
- Add blockchain just because it sounds impressive.
- Add unnecessary microservices.
- Optimize for code volume instead of demonstration quality.

---

# 30. Current Status

## Phase 0

**COMPLETE**

Hackathon strategy and architecture defined.

## Phase 1

**COMPLETE**

Local application and complete product workflow built.

Verified:

```text
TypeScript: PASS
Vite Build: PASS
Risk Engine: PASS
TRD-92831: 91/100
```

## Phase 2

**WAITING FOR SNOWFLAKE ACCOUNT**

Do not begin serious integration until the dedicated account is available.

## Phase 3–10

**PLANNED**

These will be implemented progressively after the Snowflake environment is available.

---

# 31. Current Next Step

The immediate next step is:

## WAIT FOR THE DEDICATED SNOWFLAKE ACCOUNT

Once the account arrives:

```text
1. Verify account
2. Verify Snowflake edition/environment
3. Verify available Cortex features
4. Verify CoCo CLI access
5. Verify AI credits
6. Create database
7. Create schemas
8. Load synthetic data
9. Test queries
10. Start Phase 3
```

Do not make major architectural changes to Phase 1 while waiting.

---

# 32. How We Continue If This Chat Ends

If this conversation ends, open the project and provide this README in a new conversation.

Tell the new chat:

> "This is the ClearSet AI Snowflake CoCo Hackathon project. Phase 1 is complete. Continue from the current phase shown in README.md."

The next milestone is:

> **Phase 2 — Snowflake Data Foundation**

---

# 33. Final Product Vision

The final ClearSet AI architecture should look like:

```text
                         ┌──────────────────────┐
                         │     ClearSet AI      │
                         │   React Frontend     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     FastAPI API      │
                         └──────────┬───────────┘
                                    │
                                    ▼
              ┌────────────────────────────────────────┐
              │              SNOWFLAKE                  │
              │                                        │
              │  ┌─────────────┐  ┌─────────────────┐ │
              │  │ Financial   │  │ Cortex Analyst  │ │
              │  │ Data        │  │                 │ │
              │  └─────────────┘  └─────────────────┘ │
              │                                        │
              │  ┌─────────────┐  ┌─────────────────┐ │
              │  │ Historical  │  │ Cortex Search   │ │
              │  │ Cases       │  │ / SOPs          │ │
              │  └─────────────┘  └─────────────────┘ │
              │                                        │
              │  ┌──────────────────────────────────┐ │
              │  │ CoCo / Agentic Investigation     │ │
              │  └──────────────────────────────────┘ │
              └────────────────────┬───────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │ Evidence + Root Cause│
                         │ + Recommendation     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Human Approval       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Case + Audit Trail   │
                         └──────────────────────┘
```

---

# 34. One-Line Product Description

> **ClearSet AI is a Snowflake-native, evidence-backed AI copilot that investigates and helps resolve post-trade settlement exceptions through structured financial data, historical operational knowledge, Cortex intelligence, and CoCo-powered agentic workflows with human oversight.**

---

# 35. Final Objective

The goal is **not** simply to build a beautiful React application.

The goal is to demonstrate:

```text
Real Financial Problem
        +
Domain-Specific AI
        +
Real Snowflake Data
        +
Cortex Intelligence
        +
CoCo Agentic Workflow
        +
Evidence
        +
Human Oversight
        +
Complete End-to-End UX
```

That combination is what we will optimize the project around for the hackathon.
