---
name: retrieve_procedure
description: Search operational SOPs, escalation policies, and regulatory guidelines via Snowflake Cortex Search.
---

# Skill: `retrieve_procedure`

## Execution Steps
1. Generate natural language semantic search query for the specific failure mode (e.g. "missing SSI close to cutoff").
2. Query Cortex Search service over internal policy knowledge base.
3. Extract matching document code, section number, title, mandatory actions, and escalation thresholds.
4. Format citations for human analyst review in the Evidence panel.
