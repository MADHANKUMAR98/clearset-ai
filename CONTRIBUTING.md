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
- Unit tests for pure functions
- Integration tests for API endpoints
- E2E tests for critical user flows
- Target: >80% coverage for critical paths

#### Linting & Formatting
- `make lint` - Oxlint (fast, modern)
- `make typecheck` - TypeScript strict mode
- `make format` - Prettier (auto-format on save)

## Testing Guidelines

### Unit Tests
- Location: `tests/unit/`
- Naming: `*.test.ts` or `*.test.tsx`
- Run: `make test-unit`

### Integration Tests
- Location: `tests/integration/`
- Test API endpoints with real Snowflake (or mocked)
- Run: `make test-integration`

### E2E Tests
- Location: `tests/e2e/`
- Playwright/Cypress for browser automation
- Run: `make test-e2e`

## Documentation

- Update `README.md` for user-facing changes
- Update `docs/architecture/ARCHITECTURE.md` for architectural changes
- Update `docs/api/` for API changes
- Update `docs/deployment/` for deployment changes
- JSDoc for public APIs

## Release Process

1. Version bump in `package.json` (semver)
2. Update `CHANGELOG.md`
3. Tag release: `git tag v<version>`
4. GitHub Actions builds and deploys

## Questions?

- Open a [Discussion](https://github.com/your-org/clearset-ai/discussions)
- Check existing [Issues](https://github.com/your-org/clearset-ai/issues)
- Review [Architecture Docs](docs/architecture/ARCHITECTURE.md)

---

**Thank you for contributing to ClearSet AI!** 🚀