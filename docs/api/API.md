# API Documentation

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3001/api` |
| Production | `https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app/api` |

## Authentication

All endpoints are protected by Snowflake OAuth. No API keys required - authentication is handled via Snowflake session.

## Endpoints

### Health Check

#### `GET /api/health`

Check service health and Snowflake connectivity.

**Response:**
```json
{
  "success": true,
  "mode": "snowflake",
  "snowflake": true,
  "session": {
    "ACCOUNT": "LHBBRSO-DZ87434",
    "USER": "MADHANKUMAR98",
    "ROLE": "ACCOUNTADMIN",
    "WAREHOUSE": "COMPUTE_WH",
    "DATABASE": "CLEARSET_DB",
    "SCHEMA": "CLEARSET_SCHEMA"
  }
}
```

---

### Exceptions

#### `GET /api/exceptions`

Retrieve all exceptions with enriched trade, counterparty, and security data.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | integer | Max results (default: 100) |
| `offset` | integer | Pagination offset |
| `severity` | string | Filter by severity (CRITICAL, HIGH, MEDIUM, LOW) |
| `status` | string | Filter by status (OPEN, INVESTIGATING, PENDING_APPROVAL, RESOLVED) |

**Response:**
```json
{
  "success": true,
  "mode": "snowflake",
  "data": [
    {
      "exceptionId": "EX-92831",
      "tradeId": "TRD-92831",
      "severity": "CRITICAL",
      "status": "OPEN",
      "exceptionType": "Missing Instruction",
      "riskScore": 91,
      "riskBreakdown": {
        "missing_instruction": 25,
        "cutoff_urgency": 25,
        "trade_value": 20,
        "cp_failures": 15,
        "historical_precedents": 6
      },
      "trade": {
        "tradeId": "TRD-92831",
        "ticker": "AAPL",
        "tradeValue": 2400000,
        "settlementDate": "2026-08-09",
        "cutoffTime": "2026-08-09T15:30:00.000Z"
      },
      "counterparty": {
        "cpId": "CP-192",
        "name": "Apex Prime Clearing Ltd.",
        "creditRating": "A",
        "priorFailures30d": 7
      }
    }
  ]
}
```

---

#### `GET /api/exceptions/:id`

Get single exception by ID.

---

### Trades

#### `GET /api/trades`

Retrieve all trades with enrichment.

**Response:**
```json
{
  "success": true,
  "mode": "snowflake",
  "data": [
    {
      "tradeId": "TRD-92831",
      "isin": "US0378331005",
      "ticker": "AAPL",
      "securityName": "Apple Inc. Common Stock",
      "assetClass": "Equities",
      "depository": "DTC",
      "cpId": "CP-192",
      "counterpartyName": "Apex Prime Clearing Ltd.",
      "tradeValue": 2400000,
      "settlementDate": "2026-08-09",
      "instructionStatus": "MISSING",
      "cutoffTime": "2026-08-09T15:30:00.000Z",
      "riskScore": 91
    }
  ]
}
```

---

### Counterparties

#### `GET /api/counterparties/:id`

Get counterparty details with failure statistics.

---

### Settlement Events

#### `GET /api/settlement-events/:tradeId`

Retrieve SWIFT event timeline for a trade.

---

### Cortex AI

#### `POST /api/cortex/search`

Search SOP knowledge base.

**Request:**
```json
{
  "query": "Missing instruction resolution procedure",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "available": true,
  "query": "Missing instruction resolution procedure",
  "generatedAt": "2026-09-27T10:30:00.000Z",
  "results": [
    {
      "docCode": "SOP-3.2",
      "policyName": "Settlement Exception SOP §3.2",
      "section": "Expedited SSI Repair",
      "excerpt": "When a Missing SSI exception is detected..."
    }
  ]
}
```

---

#### `POST /api/cortex/analyst`

Query Cortex Analyst with natural language.

**Request:**
```json
{
  "question": "Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type."
}
```

**Response:**
```json
{
  "success": true,
  "available": true,
  "question": "Show me trade TRD-92831...",
  "generatedAt": "2026-09-27T10:30:00.000Z",
  "interpretation": "TRD-92831 is a $2.4M AAPL trade...",
  "sqlExecuted": true,
  "rowCount": 1
}
```

---

### Cases

#### `GET /api/cases`

List all resolution cases.

#### `POST /api/cases`

Create a new resolution case.

**Request:**
```json
{
  "tradeId": "TRD-92831",
  "exceptionId": "EX-92831",
  "status": "PENDING_APPROVAL",
  "riskScore": 91,
  "rootCause": "Missing SSI for CP-192 at DTC",
  "recommendation": "Dispatch MT599 to Apex Prime...",
  "resolutionOutcome": "Awaiting approval"
}
```

---

#### `GET /api/cases/:caseId/report`

Generate audit-ready PDF report for a case.

**Response:** `application/pdf` with `Content-Disposition: inline; filename="ClearSet-Audit-{caseId}.pdf"`

---

### Metrics

#### `GET /api/metrics`

Get operational impact metrics.

**Response:**
```json
{
  "success": true,
  "mode": "snowflake",
  "data": {
    "generatedAt": "2026-09-27T10:30:00.000Z",
    "source": "snowflake",
    "openExceptionCount": 19,
    "openExceptionValueUSD": 74605000,
    "criticalOpenValueUSD": 25650000,
    "csdrExposurePerDayUSD": 18651.25,
    "casesApproved": 2,
    "avgApprovalTurnaroundMinutes": 420
  }
}
```

---

### Slack (Optional)

#### `GET /api/slack/status`

Check Slack integration status.

#### `POST /api/notify/critical-exception`

Send Slack notification for critical exception.

**Request:**
```json
{
  "tradeId": "TRD-92831",
  "exceptionType": "Missing Instruction",
  "severity": "CRITICAL",
  "riskScore": 91,
  "tradeValue": 2400000,
  "counterpartyName": "Apex Prime Clearing Ltd.",
  "rootCause": "Missing SSI",
  "recommendedResolution": "Dispatch MT599...",
  "provenance": "LIVE SNOWFLAKE",
  "dataMode": "snowflake"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request body/params |
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `NOT_FOUND` | Resource not found |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Provenance Labels

All data responses include provenance metadata:

| Label | Meaning |
|-------|---------|
| `LIVE SNOWFLAKE` | Real-time Snowflake query |
| `COMPUTED` | Client-side calculation |
| `LOCAL FALLBACK` | Mock data (Snowflake unavailable) |
| `DATA NOT AVAILABLE` | Source inaccessible |
| `ESTIMATE` | Calculated with assumptions |

---

*API Version: 1.0 | Last Updated: 2026-09-27*