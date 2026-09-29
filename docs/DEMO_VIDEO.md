# Demo Video Script — ClearSet AI (≤ 5 minutes)

Target: **3:30–4:30**. One continuous screen recording, voice-over or just
terminal audio. No credentials, no PATs, no Snowsight tokens on screen.

## Pre-flight (run this, then record — do not record the setup)

```bash
# 1. backend + frontend up
npm run server:start          # terminal 1  → http://localhost:3001
npm run dev                   # terminal 2  → http://localhost:5173

# 2. wow features ON (local .env)
#    VITE_PREDICTIVE_ENGINE=true
#    VITE_SETTLEMENT_CHAIN_VIZ=true
#    VITE_COCO_CLI_REPLAY=true

# 3. data fresh + checks green
npm run server:test           # 45 passing
curl http://localhost:3001/api/health     # {"mode":"snowflake","snowflake":true}

# 4. CoCo investigation BEFORE recording (needs CoCo credits enabled)
npm run coco:investigate -- TRD-92831     # writes public/coco-replay.json
```

## Shot list

| Time | Screen | What to show | Say (short) |
|------|--------|--------------|-------------|
| 0:00–0:25 | Title / Dashboard | Hero numbers: 19 open, $74.6M exposure, cutoff clock | "Settlement breaks cost millions a day. ClearSet predicts them, traces them, and never lets an AI approve anything." |
| 0:25–0:55 | Dashboard | **Predictive Failure Prevention** panel: TRD-92831 80%+, risk drivers, recommended actions; **Impact Metrics** tile with provenance tags | "Live model output from Snowflake data — every card says where its number came from." |
| 0:55–1:35 | Exceptions queue | Open **TRD-92831** ($2.4M AAPL, Missing Instruction, 91), click **Why?** → deterministic factor math | "Explainability first: this is arithmetic, not a vibe." |
| 1:35–2:05 | Dashboard | **Settlement Chain Trace**: hop-by-hop (BOOKED → SSI lookup → SSI_NOT_FOUND → cutoff warning → flagged), red break point, "+2h13m" latency, minutes-to-cutoff badge | "Here is exactly where in the SWIFT/depository chain it broke." |
| 2:05–2:55 | Terminal | `npm run coco:investigate -- TRD-92831` — real `cortex exec`, registered skill, provenance labels `[LIVE SNOWFLAKE] [CORTEX SEARCH] [CORTEX ANALYST]`, ends `AWAITING ANALYST AUTHORISATION` | "This is the CoCo CLI running a registered skill against live Snowflake — read-only, and it stops for a human." |
| 2:55–3:20 | Dashboard | **CoCo Replay** panel: same run replayed step-by-step with the re-run command | "Every investigation is archived and replayable in-app." |
| 3:20–3:55 | Prediction → expand → **Draft prevention MT599** | SWIFT draft with `DRAFT — AWAITING HUMAN APPROVAL` banner, then Approve → **Cases ledger** → **Audit PDF** | "AI drafts, humans approve, and the approval is evidence-grade." |
| 3:55–4:20 | Copilot | Paste the TRD-81232 question → Cortex Analyst answer with source label | "Ask anything; if the governed model can't answer, it declines instead of inventing." |
| 4:20–4:40 | Flags + tests | Set `VITE_PREDICTIVE_ENGINE=false`, refresh → panel gone, `/api/predict` 404; then `npm run server:test` → 45 passing | "Every wow feature is flag-gated: rollback is an env var, not a redeploy." |

## Closing line

"Two months of work: a governed settlement control tower on Snowflake — Cortex
AI for retrieval, CoCo CLI for investigation, and a human approval gate that no
model can cross."

## Recording notes

- Record the CoCo terminal shot **after** credits are enabled — if it prints
  `Cortex Code is not enabled…`, the wrapper shows remediation text; do not
  include that in the video.
- Zoom/1080p, dark theme, keep the browser chrome visible (proves it is live).
- Never show `connections.toml`, `server/.env`, Snowsight tokens, or PATs.
- Keep the hero trade **TRD-92831** and **TRD-81232** — they are protected demo
  anchors (never rewritten by the date-refresh script).
