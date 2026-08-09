---
name: assess_settlement_risk
description: Deterministic point-based calculation of settlement failure risk and CSDR regulatory penalty exposure.
---

# Skill: `assess_settlement_risk`

## Scoring Dimensions
Calculate risk score (0 - 100) deterministically:
- **Instruction Status**: Missing SSI (+25), Mismatched SSI (+18), Pending Affirmation (+10).
- **Cutoff Proximity**: < 120 minutes (+25), < 240 minutes (+15), < 480 minutes (+8).
- **Transaction Exposure**: > $2.0M (+20), > $1.0M (+15), > $500k (+10).
- **Counterparty Track Record**: > 5 prior fails in 30 days (+15), > 2 fails (+10).
- **Historical Failure Pattern**: Precedents with high failure rates (+6).

Severity Tiers:
- `CRITICAL`: Score >= 80
- `HIGH`: Score 60 - 79
- `MEDIUM`: Score 40 - 59
- `LOW`: Score < 40
