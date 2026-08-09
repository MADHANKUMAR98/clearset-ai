---
name: find_similar_cases
description: Query historical investigations repository for institutional operational memory and resolution playbooks.
---

# Skill: `find_similar_cases`

## Execution Steps
1. Extract trade parameters: Asset Class, Depository, Counterparty, Exception Type.
2. Query `HISTORICAL_CASES` table in Snowflake.
3. Compute resolution statistics:
   - Corrected Instruction Rate (%)
   - Escalation Rate (%)
   - Failure Rate (%)
   - Average Resolution Time (Hours)
4. Highlight top matching case precedents with highest similarity scores.
