---
name: investigate_exception
description: Complete 10-step procedural workflow for investigating financial post-trade settlement exceptions.
---

# Investigation Skill: `investigate_exception`

## Procedural Workflow
When an exception is selected for investigation, execute the following sequential steps:

1. **Identify Trade**: Query Snowflake `TRADES` and `SECURITIES` to verify trade value, asset class, ISIN, ticker, and booking desk.
2. **Check Settlement State**: Inspect `SETTLEMENT_EVENTS` and depository matching status (e.g. SWIFT MT541/MT548).
3. **Check Instructions**: Validate Standing Settlement Instructions (SSI) against depository participant directories.
4. **Analyze Counterparty**: Query `COUNTERPARTIES` via Cortex Analyst for 30-day failure rates and average resolution delays.
5. **Find Similar Cases**: Perform vector search across `HISTORICAL_CASES` for matching historical resolution patterns.
6. **Retrieve Applicable Procedure**: Execute Cortex Search over SOP knowledge base to locate binding operating standards.
7. **Assess Settlement Risk**: Calculate explainable deterministic risk points across all 5 risk dimensions.
8. **Determine Root Cause**: Synthesize structured and unstructured findings into primary cause and contributing factors.
9. **Generate Recommendation**: Formulate multi-step actionable resolution protocol with clear evidence references.
10. **Request Human Approval**: Present complete evidence dossier to operations analyst for authorization.
