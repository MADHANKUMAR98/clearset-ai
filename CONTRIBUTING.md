# Contributing to ClearSet AI

Thank you for your interest in contributing to ClearSet AI! This document outlines the process for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 22+
- Snowflake account with appropriate permissions
- Docker (for containerization)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clearset-ai
   ```

2. **Install dependencies**
   ```bash
   make install
   ```

3. **Configure environment**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your Snowflake credentials
   ```

4. **Start development**
   ```bash
   make dev
   ```

## Development Workflow

### Branch Naming
- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation updates
- `refactor/<description>` - Code refactoring
- `test/<description>` - Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(exceptions): add risk score breakdown tooltip
fix(dashboard): correct cutoff time calculation
docs(architecture): update Cortex Analyst section
```

### Pull Request Process

1. **Create feature branch** from `main`
2. **Make changes** with tests
3. **Run verification**: `make verify`
4. **Push branch** and open PR
5. **PR Requirements**:
   - All checks pass (lint, typecheck, test)
   - Description explains changes
   - Screenshots for UI changes
   - Related issue linked

### Code Standards

#### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` or proper types)
- Explicit return types for public functions
- Use `const` by default, `let` when reassignment needed

#### React
- Functional components with hooks
- Custom hooks for reusable logic
- Memoization where appropriate (`React.memo`, `useMemo`, `useCallback`)
- Props destructuring with defaults

#### Backend
- Express with async/await
- Parameterized SQL queries only
- Proper error handling with status codes
- Input validation with Zod/Joi

#### Testing
- Unit tests for pure functions and services (`node:test`, no network)
- Keep new tests inside `server/test/` and wire them into the `server:test` script
- Target: >80% coverage for critical paths (approval gate, risk scoring, metrics)

#### Linting & Formatting
- `make lint` - Oxlint (fast, modern)
- `make typecheck` - TypeScript strict mode
- `make format` - Prettier (auto-format on save)

## Testing Guidelines

### Where the tests live

| Suite | Location | Runner | Command |
|---|---|---|---|
| Backend unit tests (42) | `server/test/*.test.mjs` | `node:test` | `npm run server:test` (or `make test`) |
| Frontend type safety | `src/**` | `tsc -b --noEmit` | `make typecheck` |
| Lint | repo-wide | oxlint | `make lint` |

The backend suite is **pure unit tests with no network access** — no Snowflake
connection is opened, so it runs offline, in CI, and in a hurry. Services are
exercised through their injected dependencies.

Integration behaviour that genuinely needs Snowflake (Cortex Search, Cortex
Analyst, SPCS health) is covered by documented manual gates instead of a flaky
CI job:

- `docs/api/API.md` — the verified-response table
- `scripts/test/test-spcs.py` — post-deploy smoke test
- `snowflake/05_validation.sql`, `snowflake/06_cortex_search_validation.sql`

### Before you open a PR

```bash
make verify      # lint + typecheck + test — must be clean
```

Prefer the npm entry points if you don't have `make`:

```bash
npm run lint && npx tsc -b --noEmit && npm run server:test
```

## Documentation

- Update `README.md` for user-facing changes
- Update `docs/README.md` if you add, rename, or retire a document
- Update `docs/architecture/ARCHITECTURE.md` for architectural changes
- Update `docs/api/API.md` for API changes
- Update `docs/deployment/` for deployment changes
- Add a `CHANGELOG.md` entry for anything a judge could observe
- JSDoc for public APIs

## Release Process

1. Version bump in `package.json` (semver)
2. Update `CHANGELOG.md`
3. Tag release: `git tag v<version>`
4. GitHub Actions builds and deploys

## Questions?

- Open a [Discussion](https://github.com/MADHANKUMAR98/clearset-ai/discussions)
- Check existing [Issues](https://github.com/MADHANKUMAR98/clearset-ai/issues)
- Review [Architecture Docs](docs/architecture/ARCHITECTURE.md)

---

**Thank you for contributing to ClearSet AI!** 🚀