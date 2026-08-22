# ClearSet AI — Least-Privilege Role Preparation

## Current State
The application currently runs with `ACCOUNTADMIN` role (as seen in `/api/health` response showing `ROLE: ACCOUNTADMIN`). This is a security risk for production deployment.

## Required Snowflake Objects Accessed

Based on code inspection, the application accesses the following objects in `CLEARSET_DB.CLEARSET_SCHEMA`:

### Tables (SELECT)
| Table | Purpose | Access Pattern |
|-------|---------|----------------|
| `COUNTERPARTIES` | Counterparty master data | `SELECT` via `/api/counterparties/:id` |
| `SECURITIES` | Security master data | `SELECT` via `/api/trades` (joined) |
| `TRADES` | Trade master data | `SELECT` via `/api/trades`, `/api/exceptions` |
| `SETTLEMENT_INSTRUCTIONS` | SSI data | `SELECT` via `/api/settlement-events` (joined) |
| `SETTLEMENT_EVENTS` | SWIFT/depository events | `SELECT` via `/api/settlement-events/:tradeId` |
| `EXCEPTIONS` | Exception queue | `SELECT` via `/api/exceptions` |
| `INVESTIGATIONS` | Existing case data | Referenced in schema, may be used |
| `HISTORICAL_CASES` | Historical precedents | Referenced in schema, not yet used |
| `POLICY_CHUNKS` | SOP knowledge base | `SELECT` via Cortex Search (indirect) |
| `RESOLUTION_CASES` | New: approved cases | `SELECT`, `INSERT` via `/api/cases` |

### Views (SELECT)
| View | Purpose |
|------|---------|
| `V_EXCEPTIONS_ENRICHED` | Enriched exception data for `/api/exceptions` |
| `V_TRADE_ENRICHED` | Enriched trade data for `/api/trades` |
| `V_SETTLEMENT_EVENTS` | Settlement events view for `/api/settlement-events` |

### Cortex Services
| Service | Purpose | Required Privilege |
|---------|---------|-------------------|
| `CLEARSET_POLICY_SEARCH_SERVICE` | Cortex Search for SOPs | `USAGE` on service |
| `CLEARSET_ANALYTICS` | Cortex Analyst semantic view | `USAGE` on semantic view |

### Warehouse
| Warehouse | Purpose |
|-----------|---------|
| `COMPUTE_WH` | Query execution for all SELECT/INSERT operations |

## Recommended Role: `CLEARSET_APP_ROLE`

### Creation
```sql
-- Create the application role
CREATE ROLE CLEARSET_APP_ROLE;

-- Grant warehouse usage
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE CLEARSET_APP_ROLE;

-- Grant database/schema usage
GRANT USAGE ON DATABASE CLEARSET_DB TO ROLE CLEARSET_APP_ROLE;
GRANT USAGE ON SCHEMA CLEARSET_DB.CLEARSET_SCHEMA TO ROLE CLEARSET_APP_ROLE;

-- Grant SELECT on all required tables
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.TRADES TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_INSTRUCTIONS TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_EVENTS TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.INVESTIGATIONS TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.HISTORICAL_CASES TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.POLICY_CHUNKS TO ROLE CLEARSET_APP_ROLE;

-- Grant SELECT + INSERT on new table
GRANT SELECT, INSERT ON TABLE CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES TO ROLE CLEARSET_APP_ROLE;

-- Grant SELECT on views
GRANT SELECT ON VIEW CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON VIEW CLEARSET_DB.CLEARSET_SCHEMA.V_TRADE_ENRICHED TO ROLE CLEARSET_APP_ROLE;
GRANT SELECT ON VIEW CLEARSET_DB.CLEARSET_SCHEMA.V_SETTLEMENT_EVENTS TO ROLE CLEARSET_APP_ROLE;

-- Grant Cortex Search service usage
GRANT USAGE ON SERVICE CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE TO ROLE CLEARSET_APP_ROLE;

-- Grant Cortex Analyst semantic view usage
GRANT USAGE ON SEMANTIC VIEW CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_ANALYTICS TO ROLE CLEARSET_APP_ROLE;
```

### Assign to Service User
```sql
-- Grant the role to the service user (replace with actual service user)
GRANT ROLE CLEARSET_APP_ROLE TO USER CLEARSET_SERVICE_USER;

-- Set as default role for the service user
ALTER USER CLEARSET_SERVICE_USER SET DEFAULT_ROLE = CLEARSET_APP_ROLE;
```

## Testing Checklist

Before switching production SPCS service to the new role:

- [ ] Create role and grants in Snowflake
- [ ] Create service user (or use existing)
- [ ] Assign role to service user
- [ ] Update `server/.env` with service user credentials and `SNOWFLAKE_ROLE=CLEARSET_APP_ROLE`
- [ ] Test locally with new role:
  - [ ] `/api/health` returns `snowflake: true`
  - [ ] `/api/exceptions` returns data
  - [ ] `/api/trades` returns data
  - [ ] `/api/counterparties/CP-192` returns data
  - [ ] `/api/settlement-events/TRD-92831` returns data
  - [ ] `POST /api/cortex/search` returns results
  - [ ] `POST /api/cortex/analyst` returns results
  - [ ] `POST /api/cases` successfully inserts
  - [ ] `GET /api/cases` returns persisted cases
- [ ] Verify no `ACCOUNTADMIN` operations are needed
- [ ] Deploy to SPCS with new credentials
- [ ] Run smoke tests against deployed SPCS service

## Notes

- Do NOT remove `ACCOUNTADMIN` from the current deployment until the new role is fully tested
- The current SPCS service uses OAuth token injection at runtime — ensure the service user has appropriate network policies if required
- `RESOLUTION_CASES` requires `INSERT` privilege for the new approval persistence feature
- Cortex Search and Cortex Analyst require `USAGE` privileges on their respective services/views
- All SQL uses parameter binding (`?` placeholders) — no dynamic SQL injection risk