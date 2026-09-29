# ClearSet AI — Makefile for Common Operations
# Usage: make <target>

.PHONY: help install dev build test test-server lint typecheck clean verify deploy-local docker-build docker-push deploy-spcs migrate seed smoke-test

# Default target
help:
	@echo "ClearSet AI — Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install          Install all dependencies (root + server)"
	@echo "  make dev              Start development servers (frontend + backend)"
	@echo "  make dev-frontend     Start Vite dev server only"
	@echo "  make dev-backend      Start backend server only"
	@echo ""
	@echo "Building:"
	@echo "  make build            Build production (frontend + backend)"
	@echo "  make build-frontend   Build frontend only"
	@echo "  make build-backend    Build backend only"
	@echo "  make docker-build     Build Docker image"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run backend test suite (45 tests, node:test)"
	@echo "  make test-server      Alias of make test"
	@echo "  make lint             Run linter (oxlint)"
	@echo "  make typecheck        Run TypeScript type checking"
	@echo "  make verify           lint + typecheck + test (full gate)"
	@echo ""
	@echo "Database/Migrations:"
	@echo "  make migrate          Run all SQL migrations on Snowflake"
	@echo "  make migrate-refresh  Refresh demo dates"
	@echo "  make seed             Seed demo data"
	@echo ""
	@echo "Docker/Deployment:"
	@echo "  make docker-build     Build Docker image"
	@echo "  make docker-push      Push Docker image to Snowflake registry"
	@echo "  make deploy-spcs      Deploy to Snowflake SPCS"
	@echo "  make deploy-local     Deploy locally with docker-compose"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean            Clean build artifacts and caches"
	@echo "  make lint-fix         Auto-fix linting issues"
	@echo "  make format           Format code with Prettier"
	@echo "  make verify           Run full verification (lint + typecheck + test)"

# Install dependencies
install:
	npm install
	cd server && npm install

# Development servers
dev:
	concurrently "npm run dev" "cd server && npm run dev"

dev-frontend:
	npm run dev

dev-backend:
	cd server && npm run dev

# Building
build:
	npm run build
	cd server && npm run build

build-frontend:
	npm run build

build-backend:
	cd server && npm run build

# Docker
docker-build:
	docker build -t lhbbrso-dz87434.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest .

docker-push:
	snow spcs image-registry login --connection clearset-hack
	docker push lhbbrso-dz87434.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest

# Snowflake SPCS Deployment
deploy-spcs:
	snow spcs service create CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
		--spec-path service-spec.yaml \
		--compute-pool CLEARSET_POOL \
		--connection clearset-hack

deploy-spcs-upgrade:
	snow spcs service upgrade CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI \
		--spec-path service-spec.yaml \
		--connection clearset-hack

# Local deployment with docker-compose
deploy-local:
	docker-compose -f docker-compose.yml up -d

# Testing (backend suite: server/test/*.test.mjs)
test:
	npm run server:test

test-server:
	npm run server:test

# Linting & Type Checking
lint:
	npx oxlint .

lint-fix:
	npx oxlint . --fix

typecheck:
	npx tsc -b --noEmit

# Code formatting
format:
	npx prettier --write .

# Verification pipeline
verify: lint typecheck test
	@echo "✅ All verification checks passed!"

# Database/Migrations
migrate:
	python scripts/migrate/migrate_all.py

migrate-refresh:
	snow sql -f "snowflake/10_refresh_demo_dates.sql" --connection clearset-hack

seed:
	python scripts/migrate/migrate_all.py

# Snowflake operations
snow-test:
	snow sql -q "SELECT CURRENT_ACCOUNT(), CURRENT_USER(), CURRENT_ROLE()" --connection clearset-hack

snow-shell:
	snow sql --connection clearset-hack

# Local development with docker-compose
up:
	docker-compose -f docker-compose.yml up -d

down:
	docker-compose -f docker-compose.yml down

logs:
	docker-compose -f docker-compose.yml logs -f

# Cleanup
clean:
	rm -rf dist/ server/dist/ coverage/ .nyc_output/ *.tsbuildinfo
	docker system prune -f

# Health checks
health:
	curl -s http://localhost:3001/api/health | jq .

health-prod:
	curl -s https://eabwoc-lhbbrso-dz87434.snowflakecomputing.app/api/health | jq .

# CoCo CLI investigation
coco-investigate:
	npm run coco:investigate -- TRD-92831

coco-investigate-2:
	npm run coco:investigate -- TRD-81232

# Default target
default: help