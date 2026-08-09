---
name: escalate_exception
description: Initiate priority operational escalation to Settlement Operations desk leads and counterparty relationship managers.
---

# Skill: `escalate_exception`

## Execution Steps
1. Verify escalation criteria: Trade value > $1M or Cutoff < 120m or Counterparty fails >= 5.
2. Generate structured escalation brief with risk score, root cause, and historical resolution precedents.
3. Log escalation event to Snowflake `INVESTIGATIONS` and `SETTLEMENT_EVENTS` audit ledger.
4. Notify assigned operational supervisor.
