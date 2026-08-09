import type { PolicyDocument } from '../types';

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'POL-01',
    code: 'SOP-OPS-032',
    title: 'Settlement Exception Standard Operating Procedure',
    category: 'SOP',
    version: '4.8 (Updated 2026)',
    lastReviewed: '2026-07-15',
    sections: [
      {
        sectionNumber: '3.2',
        sectionTitle: 'Missing Settlement Instructions & Expedited SSI Repair',
        content: `When a trade is booked without matched Standing Settlement Instructions (SSI) and the settlement cutoff is within 120 minutes:
1. Operational analysts must immediately initiate an automated SWIFT MT599 / ISO 20022 repair notification to the counterparty's primary clearing desk.
2. For high-value transactions (> $1,000,000 USD), an immediate escalation must be flagged in the ClearSet Operations workspace.
3. The analyst must verify if historical successful settlement templates exist in the institutional repository for the counterparty's legal entity identifier (LEI).
4. If the counterparty has more than 3 prior settlement failures in the preceding 30 days, phone verification or direct desk chime ping is mandatory before cutoff - 60 minutes.`,
        mandatoryActions: [
          'Request corrected settlement instruction via SWIFT/ISO 20022 message.',
          'Escalate to Settlement Operations desk lead.',
          'Monitor trade status until confirmation is received at DTC/Depository.',
          'Reassess settlement risk score immediately upon receipt of updated SSI.',
        ],
        escalationThresholds: [
          'Trade Value > $1,000,000 USD: Mandatory supervisor notification.',
          'Time to Cutoff < 120 minutes: Tier 1 Escalation.',
          'Time to Cutoff < 45 minutes: Tier 2 Senior Management Escalation with Buy-in alert.',
        ],
      },
      {
        sectionNumber: '2.4',
        sectionTitle: 'Cash Variance Reconciliation & Tolerance Thresholds',
        content: `For fixed income and equity trades experiencing cash settlement variance:
- Variance <= $5,000 USD: Auto-adjustment authorized under Ops Discretionary Account.
- Variance between $5,001 and $25,000 USD: Requires Analyst review and one-click desk approval.
- Variance > $25,000 USD: Trade must be placed on temporary hold and referred to executing broker.`,
        mandatoryActions: [
          'Compare ticket gross accrued interest vs. clearing house calculation.',
          'Apply automated ledger variance adjustment if within tolerance.',
        ],
        escalationThresholds: [
          'Variance > $25,000 USD requires Booking Desk Trader sign-off.',
        ],
      },
      {
        sectionNumber: '4.1',
        sectionTitle: 'Post-Cutoff Fail Logging & Depository Claim Filing',
        content: `In the event that an instruction is not received prior to market cutoff, the exception transitions to FAILED status. Analysts must log the failure within 15 minutes of cutoff and calculate potential CSDR/DTC late claims.`,
        mandatoryActions: [
          'Generate Fail Notice to counterparty compliance.',
          'Calculate estimated daily penalty exposure.',
        ],
        escalationThresholds: [
          'Overnight fail on trades > $5M requires CRO notification.',
        ],
      },
    ],
  },
  {
    id: 'POL-02',
    code: 'SOP-OPS-014',
    title: 'Settlement Cutoff Timelines & Depository Deadlines',
    category: 'SOP',
    version: '3.2',
    lastReviewed: '2026-06-01',
    sections: [
      {
        sectionNumber: '1.1',
        sectionTitle: 'Depository Cutoff Schedule (EST/EDT)',
        content: `Standard market settlement cutoffs for same-day and T+1 value dates:
- DTC Equities DVP Intraday Match: 15:30 EST
- DTC Final Net Settlement: 16:45 EST
- Fedwire Funds & Securities: 15:00 EST (Tier 1) / 15:30 EST (Final)
- Euroclear / Clearstream Cross-Border: 13:00 EST (Bridge Cutoff)
Exceptions flagged within 120 minutes of these cutoff times are elevated to CRITICAL operational risk.`,
        mandatoryActions: [
          'Prioritize queue by proximity to nearest depository cutoff.',
          'Trigger agentic expedited resolution sequence for trades within 2h window.',
        ],
        escalationThresholds: [
          'Cutoff < 90 minutes: Automated agent priority queue bump.',
        ],
      },
    ],
  },
  {
    id: 'POL-03',
    code: 'POL-RSK-008',
    title: 'Counterparty Escalation Policy & Chronic Failure Protocol',
    category: 'ESCALATION',
    version: '2.1',
    lastReviewed: '2026-05-20',
    sections: [
      {
        sectionNumber: '2.1',
        sectionTitle: 'Chronic Failure Counterparty Escalation Matrix',
        content: `Counterparties exhibiting >= 5 settlement failures within a rolling 30-day window are designated Tier-A Operational Risk.
For any new exception involving a Tier-A counterparty:
- ClearSet agent must automatically aggregate recent failure root causes.
- Direct operational contact details must be highlighted in the investigation workspace.
- Pre-approved historical resolution playbooks should be presented to the analyst for immediate authorization.`,
        mandatoryActions: [
          'Attach counterparty 30-day fail audit to investigation case file.',
          'Notify Institutional Relationship Manager if fail rate exceeds 5.0%.',
        ],
        escalationThresholds: [
          '> 5 failures in 30 days: Tier-A Risk classification.',
        ],
      },
    ],
  },
  {
    id: 'POL-04',
    code: 'REG-EU-909',
    title: 'CSDR Settlement Discipline & Daily Penalty Regime',
    category: 'REGULATORY',
    version: '5.0',
    lastReviewed: '2026-08-01',
    sections: [
      {
        sectionNumber: '1.4',
        sectionTitle: 'Cash Penalty Calculation Formula & Avoidance Rules',
        content: `Under CSDR Article 7 and global settlement discipline frameworks:
- Equity Fails: Daily penalty = Trade Value * (ECB/Fed Base Rate + 1.00%) / 360
- Fixed Income Fails: Daily penalty = Trade Value * 0.10 bps / day.
For trade TRD-92831 ($2.4M AAPL), an uncorrected fail generates approximately $366.67/day in regulatory cash penalties plus collateral borrowing charges (~$1,200/day).`,
        mandatoryActions: [
          'Display calculated daily penalty exposure on critical exceptions.',
          'Log avoided penalty value upon successful human approval and resolution.',
        ],
        escalationThresholds: [
          'Potential daily penalty > $1,000 USD triggers priority prompt.',
        ],
      },
    ],
  },
];
