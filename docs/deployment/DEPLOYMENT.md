# Deployment Guide

## Overview

ClearSet AI deploys to **Snowflake Park Container Services (SPCS)** for production, with local development via Docker Compose.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. BUILD          2. TEST           3. PUSH            4. DEPLOY│
│  ┌─────────┐      ┌─────────┐       ┌─────────┐      ┌─────────┐│
│  │ npm run │      │ make    │       │ snow    │      │ snow    ││
│  │ build   │ ───► │ verify  │ ───►  │ spcs    │ ───► │ spcs    ││
│  │         │      │         │       │ image-  │      │ service ││
│  └─────────┘      └─────────┘       │ registry│      │ create/ ││
│                                    │ login   │      │ upgrade ││
│                                    │         │      └─────────┘│
│                                    │         │                 │
│                                    ▼         ▼                 │
│                              ┌─────────────────────┐           │
│                              │  SNOWFLAKE REGISTRY │           │
│                              │  ebgexcw-ly21740... │           │
│                              └─────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Snowflake account with SPCS enabled
- `snow` CLI installed and configured
- Docker installed
- `snow` connection configured: `clearset-prod`

## Build & Push

```bash
# 1. Build production artifacts
make build

# 2. Build Docker image
make docker-build

# 3. Login to Snowflake registry
snow spcs image-registry login --connection clearset-prod

# 4. Push image
make docker-push
```

## Deploy to SPCS

### First-time Deployment (Create)

```bash
# Create compute pool (one-time)
snow sql -q "CREATE COMPUTE POOL CLEARSET_POOL MIN_NODES=1 MAX_NODES=1 INSTANCE_FAMILY=CPU_X64_S AUTO_SUSPEND_SECS=300 AUTO_RESUME=TRUE" --connection clearset-prod

# Wait for pool to be ACTIVE/IDLE
snow sql -q "DESCRIBE COMPUTE POOL CLEARSET_POOL" --connection clearset-prod

# Create service
snow spcs service create CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
  --spec-path service-spec.yaml \
  --compute-pool CLEARSET_POOL \
  --connection clearset-prod
```

### Subsequent Deployments (Upgrade)

```bash
snow spcs service upgrade CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
  --spec-path service-spec.yaml \
  --connection clearset-prod
```

## Verification

### Check Service Status

```bash
snow spcs service describe CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI --connection clearset-prod
```

Look for:
- `status`: RUNNING
- `is_upgrading`: false
- `container.status`: READY
- `container.restartCount`: 0
- `image` digest matches pushed digest

### Health Check

```bash
# Get public URL from service describe output (ingress_url)
curl https://<ingress_url>/api/health
```

Expected response:
```json
{
  "success": true,
  "mode": "snowflake",
  "snowflake": true
}
```

### Full Smoke Test

```bash
# Health
curl -s https://<ingress_url>/api/health

# Core endpoints
curl -s <url>/api/exceptions | jq '.success'
curl -s <url>/api/trades | jq '.success'
curl -s <url>/api/cases | jq '.success'
curl -s <url>/api/metrics | jq '.success'

# CoCo CLI
npm run coco:investigate -- TRD-92831
```

## Judge Access

### Judge Credentials
| Field | Value |
|-------|-------|
| URL | `https://eafhmc-ebgexcw-ly21740.snowflakecomputing.app` |
| Username | `CLEARSET_JUDGE` |
| Password | `JudgeDemo26` |
| Expires | 2026-10-31 |
| Role | Read-only |

### Grant Access (After Deployment)

```bash
snow sql -q "GRANT SERVICE ROLE CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI!ALL_ENDPOINTS_USAGE TO ROLE CLEARSET_JUDGE_ROLE;" --connection clearset-prod
```

## Local Development

### With Docker Compose

```bash
# Start all services
make up

# View logs
make logs

# Stop
make down
```

### Manual (Without Docker)

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Configuration

### Service Spec (`service-spec.yaml`)

Key configuration points:
- **Image**: Points to Snowflake registry
- **Port**: 8080 (internal), mapped to ingress
- **Env vars**: Injected by SPCS (SNOWFLAKE_HOST, OAuth token)
- **Readiness Probe**: `/api/health` on port 8080
- **Resources**: 0.5-1 CPU, 512M-1G memory

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `PORT` | Spec (8080) | Internal port |
| `SNOWFLAKE_DATABASE` | Spec | CLEARSET_DB |
| `SNOWFLAKE_SCHEMA` | Spec | CLEARSET_SCHEMA |
| `SNOWFLAKE_WAREHOUSE` | Spec | COMPUTE_WH |
| `SNOWFLAKE_ROLE` | Spec | ACCOUNTADMIN |
| `SNOWFLAKE_HOST` | SPCS Runtime | Auto-injected |
| `SNOWFLAKE_ACCOUNT` | SPCS Runtime | Auto-injected |
| OAuth Token | SPCS Runtime | `/snowflake/session/token` |

## Troubleshooting

### Service Stuck in PENDING
```bash
# Check compute pool status
snow sql -q "DESCRIBE COMPUTE POOL CLEARSET_POOL" --connection clearset-prod

# Check service logs
snow spcs service logs CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI --connection clearset-prod
```

### Image Pull Errors
```bash
# Re-login to registry
snow spcs image-registry login --connection clearset-prod

# Verify image exists
snow sql -q "SHOW IMAGES IN IMAGE REPOSITORY CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_REPO" --connection clearset-prod
```

### OAuth Issues
- Check service logs for `authentication successful using: OAUTH`
- Verify no `password is provided` in logs
- Ensure no EAI configured (Cortex uses internal network)

### Compute Pool Not Ready
```bash
# Check pool state
snow sql -q "SHOW COMPUTE POOLS LIKE 'CLEARSET_POOL'" --connection clearset-prod

# Wait for ACTIVE/IDLE state before deploying service
```

## Rollback

```bash
# If new deployment has issues, rollback by re-deploying previous image
snow spcs service upgrade CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
  --spec-path service-spec.yaml \
  --connection clearset-prod

# Or manually specify previous image digest in service-spec.yaml
```

## Security Checklist

- [ ] No `.env` files in Docker image
- [ ] No PAT/passwords in image
- [ ] OAuth only in runtime (no credentials in image)
- [ ] Parameterized SQL only
- [ ] Service role granted to judge role
- [ ] Judge user expires after evaluation period
- [ ] No EAI configured (Cortex uses internal network)

## Monitoring

### Key Metrics
- Service uptime (target: 99.9%)
- API latency (target: <500ms p95)
- Error rate (target: <0.1%)
- Container restart count (target: 0)

### Logs
```bash
# View service logs
snow spcs service logs CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI --connection clearset-prod

# Follow logs
snow spcs service logs CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI --connection clearset-prod --follow
```