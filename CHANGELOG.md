# Changelog

## [1.2.0] - 2026-06-25

### Added
- Subpath exports for `./admin`, `./security`, `./core`, `./utils`
- `POST /explain`, `POST /validate`, `GET /health` endpoints in Express/Fastify middleware
- Driver-level `explain()`/`analyze()` overrides for MSSQL
- `insertedId` support for SQLite, Postgres, MSSQL drivers
- SSL config forwarding in MySQL and Postgres drivers
- `bannedDatabases`/`allowedDatabases` enforcement in query validation
- Health check endpoint (`GET /health`) in middleware
- CORS support, `.env` loading, views display for dashboard web UI
- Loading states and view rendering in dashboard
- Comprehensive test suite for all drivers, export, security, and schema modules

### Fixed
- `CHANGELOG.md` missing from `files` array in package.json
- `crypto.randomUUID()` replaced with `uuid` package for Node 16.0-16.16 compatibility
- `basePath` not applied in Express middleware routes
- MSSQL `executeBatch` missing transaction support
- `maxQueriesPerUser` falsy lookup bug (`0 || default`)
- Missing `destroy()`/`close()` cleanup in Express/Fastify middleware
- `build:subpaths` excluding SQLite driver
- Missing `types` field in `./demo` export
- `detectInjection` false positives with legitimate SQL containing OR/AND
- `formatSQL` not handling string literals with embedded keywords
- View columns always empty across all drivers
- Procedure params/definitions always empty

### Changed
- Version bumped from 1.0.1 to 1.2.0
- `maxRows` now pushes `LIMIT` at database level instead of post-fetch truncation
- In-memory SQLite save-on-disconnect optimization (tracks dirty state)
- `ReadOnlyGuard` no longer unconditionally allows `WITH` and `PRAGMA`

## [1.0.1] - 2026-06-24

### Fixed
- Bug in `validator.ts`: `trimmedSql` changed from `const` to `let` so missing-semicolon append works correctly

### Added
- CLI demo with 11 sections showcasing all features
- Web dashboard with 6 tabs (Query, Schema, History, Export, Security, Status)
- All-database support via environment variables
- Bilingual README (Persian + English)
- `release:publish` script for automated npm + GitHub release

## [1.0.0] - 2026-06-23

### Added
- Initial release of sql-dashboard
- SQLite, MySQL, PostgreSQL, MSSQL drivers
- Query execution with parameterized queries
- Schema browsing (tables, columns, indexes, foreign keys, views)
- Query validation and security (read-only mode, rate limiting, injection detection)
- Query history with pagination
- Export to CSV, JSON, JSON Lines
- Express and Fastify middleware
- SQL formatter
- Transaction support
- Batch query execution
