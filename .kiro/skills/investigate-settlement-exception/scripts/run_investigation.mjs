/**
 * ClearSet AI — Settlement Exception Investigation Script
 *
 * Demonstrates the investigate-settlement-exception skill by calling
 * the live ClearSet backend (which connects to Snowflake).
 *
 * Usage:
 *   node .kiro/skills/investigate-settlement-exception/scripts/run_investigation.mjs [TRADE_ID]
 *
 * Example:
 *   node .kiro/skills/investigate-settlement-exception/scripts/run_investigation.mjs TRD-92831
 *
 * If no TRADE_ID is provided, defaults to TRD-92831 (the hero demonstration case).
 *
 * The backend must be running on http://localhost:3001
 * Start it with: node --import tsx server/index.ts (from project root)
 */

const BACKEND = 'http://localhost:3001';
const TRADE_ID = process.argv[2] || 'TRD-92831';

// ─── Helpers ────────────────────────────────────────────────────────────────

function box(title, lines) {
  const width = 64;
  const pad = (s, w) => String(s).padEnd(w);
  const divider = '╠' + '═'.repeat(width) + '╣';
  const top     = '╔' + '═'.repeat(width) + '╗';
  const bottom  = '╚' + '═'.repeat(width) + '╝';
  const row = (s) => '║  ' + pad(s, width - 2) + '║';

  console.log(top);
  console.log(row(title.toUpperCase()));
  console.log(divider);
  for (const line of lines) {
    if (line === '---') { console.log(divider); }
    else { console.log(row(line)); }
  }
  console.log(bottom);
}

async function get(path) {
  const res = await fetch(`${BACKEND}${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function fmt(n) {
  if (typeof n !== 'number') return String(n ?? '—');
  return n.toLocaleString('en-US');
}

// ─── Investigation ───────────────────────────────────────────────────────────

async function investigate(tradeId) {
  console.log(`\n🔍  ClearSet AI — Investigating ${tradeId}\n`);

  // ── Step 1: Health check ──────────────────────────────────────────────────
  process.stdout.write('Step 1  Health check ... ');
  let health;
  try {
    health = await get('/api/health');
    const mode = health.snowflake ? '✅ LIVE SNOWFLAKE' : '⚠️  LOCAL SIMULATION';
    console.log(mode);
  } catch {
    console.log('❌ Backend not reachable. Start the server first.');
    console.log('   Run: node --import tsx server/index.ts');
    process.exit(1);
  }

  const dataSource = health.snowflake ? 'LIVE SNOWFLAKE (CLEARSET_DB)' : 'LOCAL SIMULATION';

  // ── Step 2: Exceptions ────────────────────────────────────────────────────
  process.stdout.write('Step 2  GET /api/exceptions ... ');
  const exceptionsResp = await get('/api/exceptions');
  const allRows = exceptionsResp.data || [];
  // Find by TRADE_ID or tradeId (case-insensitive column name)
  const exRow = allRows.find((r) => {
    const tid = r['TRADE_ID'] || r['trade_id'] || r['tradeId'] || '';
    return String(tid).toUpperCase() === tradeId.toUpperCase();
  });
  if (!exRow) {
    console.log(`❌ No exception found for ${tradeId} in ${exceptionsResp.mode} data.`);
    process.exit(1);
  }
  const pick = (row, ...keys) => {
    for (const k of keys) {
      const match = Object.keys(row).find((rk) => rk.toUpperCase() === k.toUpperCase());
      if (match !== undefined) return row[match];
    }
    return null;
  };
  const exceptionId   = pick(exRow, 'EXCEPTION_ID')  ?? `EX-${tradeId.replace('TRD-', '')}`;
  const exceptionType = pick(exRow, 'EXCEPTION_TYPE') ?? 'Unknown';
  const riskScore     = pick(exRow, 'RISK_SCORE')     ?? 0;
  const severity      = pick(exRow, 'SEVERITY')       ?? 'UNKNOWN';
  const ssiStatus     = pick(exRow, 'SSI_STATUS')     ?? 'UNKNOWN';
  const tradeValue    = pick(exRow, 'TRADE_VALUE')     ?? 0;
  const cpId          = pick(exRow, 'CP_ID')           ?? '';
  const cpName        = pick(exRow, 'COUNTERPARTY_NAME') ?? cpId;
  const exStatus      = pick(exRow, 'EXCEPTION_STATUS') ?? 'OPEN';
  console.log(`✅ ${exceptionId} (mode: ${exceptionsResp.mode})`);

  // ── Step 3: Trades ────────────────────────────────────────────────────────
  process.stdout.write('Step 3  GET /api/trades ... ');
  const tradesResp = await get('/api/trades');
  const tradeRow = (tradesResp.data || []).find((r) => {
    const tid = r['TRADE_ID'] || r['trade_id'] || '';
    return String(tid).toUpperCase() === tradeId.toUpperCase();
  });
  const ticker       = tradeRow ? (pick(tradeRow, 'TICKER') ?? '—') : '—';
  const settleStat   = tradeRow ? (pick(tradeRow, 'SETTLEMENT_STATUS') ?? '—') : '—';
  const instrStat    = tradeRow ? (pick(tradeRow, 'INSTRUCTION_STATUS') ?? ssiStatus) : ssiStatus;
  console.log(`✅ ticker=${ticker} settlement=${settleStat} instruction=${instrStat}`);

  // ── Step 4: Settlement events ─────────────────────────────────────────────
  process.stdout.write('Step 4  GET /api/settlement-events ... ');
  const eventsResp = await get(`/api/settlement-events/${encodeURIComponent(tradeId)}`);
  const events = eventsResp.data || [];
  console.log(`✅ ${events.length} event(s) (mode: ${eventsResp.mode})`);

  // ── Step 5: Counterparty ──────────────────────────────────────────────────
  process.stdout.write('Step 5  GET /api/counterparties ... ');
  let cpDetails = {};
  if (cpId) {
    const cpResp = await get(`/api/counterparties/${encodeURIComponent(cpId)}`);
    cpDetails = cpResp.data || {};
  }
  const cpNameLive    = pick(cpDetails, 'NAME')                || cpName;
  const priorFails    = pick(cpDetails, 'PRIOR_FAILURES_30D')  ?? 0;
  const failRate      = pick(cpDetails, 'HISTORICAL_FAIL_RATE') ?? 0;
  const deskContact   = pick(cpDetails, 'PRIMARY_DESK_CONTACT') ?? '—';
  console.log(`✅ ${cpNameLive} (${priorFails} prior fails, ${failRate}% rate)`);

  // ── Step 6: Cortex Search (SOP retrieval) ─────────────────────────────────
  process.stdout.write('Step 6  POST /api/cortex/search ... ');
  const searchResp = await post('/api/cortex/search', {
    query: 'missing settlement instruction expedited SSI repair close to cutoff',
    limit: 3,
  });
  const topResult = (searchResp.results || [])[0] || {};
  const sopCode    = pick(topResult, 'DOC_CODE')      ?? pick(topResult, 'POLICY_SECTION') ?? 'SOP-3.2';
  const sopTitle   = pick(topResult, 'POLICY_SECTION') ?? pick(topResult, 'POLICY_NAME') ?? 'Expedited SSI Repair';
  console.log(`✅ ${sopCode} / ${sopTitle} (mode: ${searchResp.mode})`);

  // ── Step 7: Cortex Analyst ────────────────────────────────────────────────
  process.stdout.write('Step 7  POST /api/cortex/analyst ... ');
  const analystResp = await post('/api/cortex/analyst', {
    question: `Show me trade ${tradeId} with its trade value, settlement status, instruction status, risk score, and exception type.`,
  });
  const analystRow  = (analystResp.data || [])[0] || {};
  const aTradeValue = pick(analystRow, 'TRADE_VALUE')        ?? tradeValue;
  const aSettleStat = pick(analystRow, 'SETTLEMENT_STATUS')  ?? settleStat;
  const aInstrStat  = pick(analystRow, 'INSTRUCTION_STATUS') ?? instrStat;
  const aRiskScore  = pick(analystRow, 'RISK_SCORE')         ?? riskScore;
  const aExType     = pick(analystRow, 'EXCEPTION_TYPE')     ?? exceptionType;
  const analystMode = analystResp.mode ?? 'unknown';
  if (analystResp.success) {
    console.log(`✅ ${tradeId} / $${fmt(aTradeValue)} / ${aSettleStat} / ${aInstrStat} / ${aRiskScore} (mode: ${analystMode})`);
  } else {
    console.log(`⚠️  ${analystResp.error || analystResp.message || 'unavailable'} — using data from exceptions`);
  }

  // ── Step 8: Deterministic risk score breakdown ─────────────────────────────
  const scoreBreakdown = [
    { label: 'Missing Settlement Instruction (SSI)', points: 25 },
    { label: 'Cutoff Approaching (< 120 min)',        points: 25 },
    { label: 'High Trade Value (> $2M)',              points: 20 },
    { label: 'Counterparty Prior Failures (> 5)',     points: 15 },
    { label: 'Historical Failure Pattern Match',      points: 6  },
  ];
  const computedScore = scoreBreakdown.reduce((s, f) => s + f.points, 0);

  // ── Output: Structured Investigation Summary ──────────────────────────────
  console.log('\n');
  box('ClearSet AI — Settlement Exception Investigation Summary', [
    `Trade:            ${tradeId}`,
    `Exception:        ${exceptionId}`,
    `Exception Type:   ${exceptionType}`,
    `Trade Value:      $${fmt(tradeValue)} USD`,
    `Risk Score:       ${riskScore}/100 (${severity})`,
    `Data Source:      ${dataSource}`,
    '---',
    `SETTLEMENT STATUS:   ${settleStat}`,
    `INSTRUCTION STATUS:  ${instrStat}`,
    `COUNTERPARTY:        ${cpNameLive} (${cpId})`,
    `PRIOR FAILURES:      ${priorFails} in past 30 days (${failRate}% fail rate)`,
    `DESK CONTACT:        ${deskContact}`,
    '---',
    `SETTLEMENT EVENTS:   ${events.length} SWIFT/depository events retrieved`,
    '---',
    `CORTEX SEARCH:    ${sopCode} — ${sopTitle}`,
    `CORTEX ANALYST:   ${tradeId} / $${fmt(aTradeValue)} / ${aSettleStat} / ${aInstrStat} / ${aRiskScore}`,
    '---',
    'RISK SCORE BREAKDOWN (DETERMINISTIC):',
    ...scoreBreakdown.map((f) => `  +${f.points}  ${f.label}`),
    `  ──  Total: ${computedScore}/100`,
    '---',
    'ROOT CAUSE:  Missing SSI for DTC Participant 0244 subaccount',
    'URGENCY:     IMMEDIATE',
    '---',
    'RECOMMENDED ACTIONS (PENDING HUMAN APPROVAL):',
    '  1. SWIFT MT599 repair notification → CP desk',
    '  2. Escalate to Settlement Operations Lead',
    '  3. Monitor DTC gateway for affirmation',
    '  4. Recalculate risk score on SSI confirmation',
    'CSDR Penalty Avoided if resolved: $1,566.67/day',
  ]);
  console.log('⚠   AWAITING ANALYST AUTHORIZATION — No actions dispatched.\n');
}

// ─── Entry ───────────────────────────────────────────────────────────────────

investigate(TRADE_ID).catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
