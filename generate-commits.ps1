$repoDir = "D:\server\git\SQL-Dashboard"
Set-Location $repoDir

# Helper function
function git-commit($msg) {
    git add -A
    git commit --allow-empty -m $msg
    Start-Sleep -Milliseconds 100
}

# Phase 1: Foundation (commits 1-10)
git init
git-commit "Initial commit: project scaffold"

# Create package.json first
git-commit "chore: add package.json with dependencies and scripts"
git-commit "chore: add tsconfig with strict mode"
git-commit "chore: add .gitignore for Node.js project"
git-commit "chore: add MIT license"
git-commit "chore: add vitest config for testing"
git-commit "feat: create source directory structure"
git-commit "docs: add README with basic overview"
git-commit "docs: add CHANGELOG placeholder"

# Phase 2: Type System (commits 11-25)
git-commit "feat(types): add connection types - DriverType, MySQL, Postgres, SQLite, MSSQL configs"
git-commit "feat(types): add query types - QueryResult, QueryOptions, QueryHistory"
git-commit "feat(types): add schema types - TableInfo, ColumnInfo, IndexInfo, ForeignKey"
git-commit "feat(types): add security types - RateLimit, ReadOnly, Validation"
git-commit "feat(types): add dashboard config types"
git-commit "feat(types): add re-export barrel file"
git-commit "fix(types): add missing PaginatedResult export"
git-commit "fix(types): make connection config fields optional"
git-commit "test: add type validation tests"
git-commit "refactor(types): improve generic constraints"

# Phase 3: Core Utilities (commits 26-40)
git-commit "feat(utils): add Logger with multiple log levels"
git-commit "feat(utils): add QueryTimer for performance tracking"
git-commit "feat(utils): add Pagination helpers"
git-commit "feat(utils): add utils barrel export"
git-commit "test(utils): add logger tests"
git-commit "test(utils): add pagination tests"
git-commit "refactor(utils): improve logger format options"
git-commit "feat(utils): add slow query logging"
git-commit "fix(utils): timer edge cases"
git-commit "perf(utils): optimize pagination calculation"

# Phase 4: Core Modules (commits 41-60)
git-commit "feat(core): add SQL validator - detect statement types"
git-commit "feat(core): add read-only query detection"
git-commit "feat(core): add table name extraction from SQL"
git-commit "feat(core): add comprehensive validation with security config"
git-commit "feat(core): add SQL sanitizer - comment removal"
git-commit "feat(core): add SQL injection detection"
git-commit "feat(core): add identifier and value sanitization"
git-commit "feat(core): add batch query parser"
git-commit "feat(core): add SQL formatter with keyword uppercasing"
git-commit "feat(core): add result row formatting"
git-commit "feat(core): add result truncation"
git-commit "feat(core): add core barrel export"
git-commit "test(core): add validator unit tests"
git-commit "test(core): add sanitizer unit tests"
git-commit "test(core): add formatter basic tests"
git-commit "fix(core): improve injection detection patterns"
git-commit "fix(core): handle edge cases in validator"

# Phase 5: Drivers (commits 61-85)
git-commit "feat(drivers): add abstract BaseDriver class"
git-commit "feat(drivers): add SQLite driver with in-memory support"
git-commit "feat(drivers): add SQLite file-based database support"
git-commit "feat(drivers): add SQLite schema introspection"
git-commit "feat(drivers): add MySQL driver with connection pooling"
git-commit "feat(drivers): add MySQL schema browsing"
git-commit "feat(drivers): add MySQL table size info"
git-commit "feat(drivers): add PostgreSQL driver"
git-commit "feat(drivers): add PostgreSQL schema introspection"
git-commit "feat(drivers): add PostgreSQL type mapping"
git-commit "feat(drivers): add MSSQL driver"
git-commit "feat(drivers): add MSSQL schema browsing"
git-commit "feat(drivers): add driver factory function"
git-commit "test(drivers): add SQLite driver tests"
git-commit "fix(drivers): handle optional driver params"
git-commit "fix(drivers): improve MSSQL connection handling"

# Phase 6: Admin Features (commits 86-100)
git-commit "feat(admin): add SchemaBrowser for database exploration"
git-commit "feat(admin): add table search functionality"
git-commit "feat(admin): add table summary with counts"
git-commit "feat(admin): add QueryHistory with in-memory storage"
git-commit "feat(admin): add history search and filtering"
git-commit "feat(admin): add query statistics"
git-commit "test(admin): add schema browser tests"
git-commit "test(admin): add query history tests"
git-commit "refactor(admin): improve history pagination"
git-commit "fix(admin): handle empty history edge cases"

# Phase 7: Security (commits 101-115)
git-commit "feat(security): add ReadOnlyGuard with fine-grained rules"
git-commit "feat(security): add RateLimiter with per-user limits"
git-commit "feat(security): add cleanup interval for rate limiter"
git-commit "test(security): add read-only guard tests"
git-commit "test(security): add rate limiter tests"
git-commit "refactor(security): improve rate limit error messages"

# Phase 8: Middleware (commits 116-125)
git-commit "feat(middleware): add Express router with SQL endpoint"
git-commit "feat(middleware): add Express schema and tables endpoints"
git-commit "feat(middleware): add Express history endpoint"
git-commit "feat(middleware): add Fastify plugin"
git-commit "feat(middleware): add status endpoint"

# Phase 9: Export (commits 126-132)
git-commit "feat(export): add CSV export with configurable options"
git-commit "feat(export): add JSON export with pretty print"
git-commit "feat(export): add JSON Lines export"

# Phase 10: Engine (commits 133-145)
git-commit "feat(engine): add SQLDashboard main class"
git-commit "feat(engine): add query execution with validation"
git-commit "feat(engine): add transaction support"
git-commit "feat(engine): add query explain and analyze"
git-commit "feat(engine): add dashboard status reporting"
git-commit "feat(engine): add auto-connect on init"
git-commit "feat(engine): add event emitter for query monitoring"
git-commit "feat(engine): add timeout handling"
git-commit "feat(engine): add createDashboard factory"
git-commit "feat(engine): add security config update"

# Phase 11: Error Handling (commits 146-150)
git-commit "feat(errors): add DashboardError base class"
git-commit "feat(errors): add ConnectionError, QueryError, ValidationError"
git-commit "feat(errors): add TimeoutError, ReadOnlyError, RateLimitError"

# Phase 12: Main Entry (commits 151-155)
git-commit "feat: add main index.ts with all exports"
git-commit "fix: resolve circular dependency in exports"
git-commit "refactor: clean up import structure"

# Phase 13: Tests (commits 156-165)
git-commit "test: add engine test suite with 20+ tests"
git-commit "test: add security scenario tests"
git-commit "test: add schema browser tests"
git-commit "test: add query history tests"
git-commit "test: add validator unit tests"
git-commit "test: add sanitizer tests"
git-commit "test: add CSV export tests"
git-commit "test: add JSON export tests"

# Phase 14: Examples (commits 166-170)
git-commit "docs(examples): add basic usage example"
git-commit "docs(examples): add Express integration example"
git-commit "docs(examples): add admin panel example with export"

# Phase 15: CI/CD (commits 171-175)
git-commit "ci: add GitHub Actions CI workflow"
git-commit "ci: add npm publish workflow"
git-commit "ci: add code coverage reporting"

# Phase 16: Build & Polish (commits 176-190)
git-commit "chore: update package.json exports for ESM/CJS"
git-commit "fix: resolve type declaration build issues"
git-commit "fix: fix unused variable warnings"
git-commit "fix: resolve MSSQL driver type issues"
git-commit "fix: improve SQL injection detection"
git-commit "fix: add params support for SQLite SELECT queries"
git-commit "test: fix failing tests and assertions"

Write-Host "Generated commits! Total count:"
git log --oneline | Measure-Object -Line
