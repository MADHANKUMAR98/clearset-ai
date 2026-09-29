# CoCo CLI Investigation — Runbook

ClearSet AI's settlement investigation is executed by the **Snowflake Cortex Code
CLI (CoCo)** through the registered skill
`investigate-settlement-exception`. The ClearSet Express backend remains the
single source of truth for Snowflake/Cortex operations; CoCo orchestrates and
narrates, it never mutates anything.

## Prerequisites

1. CoCo CLI available as `cortex` (verified with `cortex --version`, v1.1.66).
2. Skill registered (already done in this repo):
   ```
   cortex skill list
   # → [EXTERNAL] investigate-settlement-exception
   ```
3. ClearSet backend running with live Snowflake:
   ```
   npm run server:start        # http://localhost:3001
   ```
4. Snowflake connection configured (`clearset-hack` → account `LHBBRSO-DZ87434`),
   selected for CoCo and pinned for the app:
   ```
   cortex connections set clearset-hack
   # ~/.snowflake/cortex/settings.json → sqlConnectionName = "clearset-hack"
   ```
5. CoCo entitlement active on that account (Snowflake-side; see Troubleshooting).

## Run an investigation for ANY trade

```
npm run coco:investigate -- TRD-92831
npm run coco:investigate -- TRD-81232
node scripts/coco_investigate.mjs <ANY_TRADE_ID>
```

The trade ID is passed straight into the CoCo prompt — nothing is hardcoded.
The wrapper:

- validates the ID format (`^[A-Za-z0-9][A-Za-z0-9-]{0,49}$`),
- preflights `/api/health` and warns if the backend is in local-fallback mode,
- launches `cortex exec --file <prompt> --allowed Bash --max-turns 60 --no-history`,
- streams CoCo's real output verbatim (no synthetic streaming),
- propagates the CLI exit code.

## What CoCo actually executes

1. Auto-selects the `investigate-settlement-exception` skill.
2. Steps 1–5: calls the backend REST endpoints (`/api/health`, `/api/exceptions`,
   `/api/trades`, `/api/settlement-events/<id>`, `/api/counterparties/<cp>`)
   which read live Snowflake tables/views.
3. Step 6: Cortex Search SOP retrieval via the backend.
4. Step 7: Cortex Analyst NL→SQL confirmation via the semantic view.
5. Steps 8–10: deterministic scoring, root cause, recommendation — ending in a
   block marked **AWAITING ANALYST AUTHORISATION**.

Every evidence line is labeled at runtime with its true provenance:
`[COCO CLI] [LIVE SNOWFLAKE] [CORTEX ANALYST] [CORTEX SEARCH] [COMPUTED] [LOCAL FALLBACK]`.

## Safety envelope

- `--allowed Bash` only: CoCo can call HTTP endpoints; it cannot edit files or
  run raw SQL against Snowflake.
- The skill text itself forbids creating cases, dispatching SWIFT, or approving.
- Approval happens exclusively in the ClearSet application (human-in-the-loop);
  RESOLUTION_CASES write-back and audit PDFs remain app-side.

## In-app replay (feature-flagged)

Every successful run is parsed by the wrapper and written to
`public/coco-replay.json` (steps, provenance labels, deterministic score, root
cause, recommendation, full transcript). With `VITE_COCO_CLI_REPLAY=true` the
dashboard renders it as a step-by-step replay panel that also shows the exact
re-run command — so judges see the investigation even without a live terminal.

```
# .env
VITE_COCO_CLI_REPLAY=true
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `backend is not reachable` | Start `npm run server:start` first |
| Tools blocked message from CoCo | Ensure wrapper used (it passes `--allowed Bash`) |
| Output stops before Step 10 | Re-run; the prompt demands steps 8–10 in the final message |
| `Cortex Code is not enabled or the usage limit has been reached` | Snowflake-side entitlement: standard trials ship with AI features off. Enable CoCo credits (Snowflake team), add a payment method in Snowsight > Billing, or use a CoCo CLI trial account — then re-run |
| `Programmatic access token is expired` | Re-auth the connection: `cortex connections set clearset-hack` |
| Replay panel shows "No recorded investigation yet" | Run a successful investigation first; the wrapper writes `public/coco-replay.json` automatically |
