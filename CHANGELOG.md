# Changelog

All notable changes to ClearSet AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete repository restructuring with professional organization
- Makefile for common operations
- Docker Compose for local development
- GitHub Actions CI/CD pipeline
- Architecture documentation
- API documentation
- Deployment guide
- Contributing guidelines
- Code of Conduct
- MIT License

### Changed
- Updated production URL to new SPCS deployment
- Updated image digest references
- Improved README with judge access table

## [2.0.0] - 2026-09-27

### Added
- **Impact Metrics Panel** (`/api/metrics`): Operational impact metrics including open fail exposure, critical exposure, CSDR accrual estimates, and approval throughput
- **CoCo CLI Integration**: Genuine `cortex exec` investigations via registered skill `investigate-settlement-exception`
- **Audit-Ready PDF Reports**: Evidence-grade resolution reports from `RESOLUTION_CASES` with deterministic factors, Cortex evidence, and SWIFT event history
- **Cortex Search Service**: 5 SOP policy chunks with search attributes
- **Cortex Analyst Semantic Model**: `CLEARSET_ANALYTICS` with 6 tables and full relationships
- **Demo Data Expansion**: 35 trades, 21 exceptions, 13 exception types across 13 counterparties
- **Judge Access**: `CLEARSET_JUDGE` user with read-only role, auto-expiring credentials

### Changed
- Migrated from account `CVSCEVX-CK13255` to `EBGEXCW-LY21740`
- Updated production URL to `https://eafhmc-ebgexcw-ly21740.snowflakecomputing.app`
- New Docker image digest: `sha256:d84844965c145dce7d47400f7e46e0961b827fcd7f535ce9bbacf84d6ff620ee`
- New compute pool: `CLEARSET_POOL` (CPU_X64_S)
- New image registry: `ebgexcw-ly21740.registry.snowflakecomputing.com`

### Security
- New PAT generated for production account
- Judge user with read-only grants and 36-day expiry
- Service role granted for SPCS ingress access
- No credentials baked into Docker image

### Fixed
- Cortex Search service creation on trial account (graceful fallback)
- PARSE_JSON in VALUES clause (replaced with SELECT/UNION ALL)
- Docker registry authentication flow

## [1.5.0] - 2026-08-23

### Added
- **Audit-Ready Resolution Reports**: PDF generation from `RESOLUTION_CASES` with deterministic factors, SWIFT events, and Cortex evidence
- **Cortex Analyst Integration**: Natural language queries via semantic model
- **Cortex Search Integration**: SOP retrieval with 5 policy chunks
- **Resolution Cases Table**: `RESOLUTION_CASES` audit ledger with approval workflow
- **Cases View**: Full case management UI with audit PDF generation

### Changed
- Migrated to SPCS production deployment
- OAuth-only runtime authentication
- Health check endpoint for SPCS readiness probe

## [1.0.0] - 2026-08-15

### Added
- Initial ClearSet AI release
- React 19 frontend with Vite
- Express/TypeScript backend
- Snowflake integration with dual auth (password local / OAuth SPCS)
- Deterministic risk scoring (0-100)
- 10-step investigation workflow
- Exception queue with risk scoring
- Dashboard with risk tiles and charts
- CoCo CLI skills (7 registered)
- Snowflake schema with 10 tables
- Demo data: 5 trades, 5 counterparties, 5 securities

---

## Version History Summary

| Version | Date | Key Milestone |
|---------|------|---------------|
| 2.0.0 | 2026-09-27 | Hackathon submission: Metrics, CoCo CLI, Audit PDF, Judge Access |
| 1.5.0 | 2026-08-23 | SPCS Production, Audit Reports, Cortex AI |
| 1.0.0 | 2026-08-15 | Initial Release |

---

*Generated with [Keep a Changelog](https://keepachangelog.com/)*