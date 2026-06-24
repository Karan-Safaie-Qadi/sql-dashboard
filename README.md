# SQL Dashboard

<div align="center">

[![npm version](https://img.shields.io/npm/v/sql-dashboard.svg)](https://www.npmjs.com/package/sql-dashboard)
[![npm downloads](https://img.shields.io/npm/dm/sql-dashboard.svg)](https://www.npmjs.com/package/sql-dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![CI](https://github.com/Karan-Safaie-Qadi/sql-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Karan-Safaie-Qadi/sql-dashboard/actions/workflows/ci.yml)

**SQL Dashboard** - A professional, feature-rich SQL management library for Node.js admin panels.

Execute queries, browse schemas, manage databases, and build powerful admin interfaces with ease.

[Installation](#installation) •
[Quick Start](#quick-start) •
[Features](#features) •
[API Reference](#api-reference) •
[Examples](#examples) •
[Security](#security)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🚀 Multi-Database** | SQLite (built-in), MySQL, PostgreSQL, MSSQL |
| **⚡ Query Execution** | Run SQL, batch queries, transactions, prepared statements |
| **📊 Schema Browser** | Browse tables, columns, indexes, foreign keys, views |
| **🔒 Security** | Read-only mode, rate limiting, SQL injection detection, query validation |
| **📝 Query History** | Auto-recorded history with search, stats, and pagination |
| **📦 Export** | CSV, JSON, JSON Lines export utilities |
| **🔌 Express Plugin** | Mount a full SQL admin REST API in one line |
| **⚡ Fastify Plugin** | Native Fastify plugin support |
| **📐 TypeScript** | Full type definitions, strict mode |
| **📋 Query Formatting** | Built-in SQL formatter |
| **⏱ Performance** | Query timing, slow query logging, connection pooling |
| **🌐 Zero Config** | Works out of the box with SQLite (in-memory or file-based) |

---

## 📦 Installation

```bash
npm install sql-dashboard
```

### Optional Drivers

```bash
# For MySQL support
npm install mysql2

# For PostgreSQL support
npm install pg

# For MSSQL support
npm install tedious

# For Express middleware
npm install express

# For Fastify plugin
npm install fastify
```

---

## 🚀 Quick Start

### Basic Usage (30 seconds)

```typescript
import { SQLDashboard } from 'sql-dashboard';
import { DriverType } from 'sql-dashboard';

// 1 line initialization
const db = new SQLDashboard({
  driver: {
    type: DriverType.SQLITE,
    connection: { mode: 'memory' }, // or { path: './data.db' }
  },
});

// Run queries
const result = await db.query('SELECT * FROM users WHERE age > ?', {
  params: [18],
});

console.log(result.rows);    // Array of rows
console.log(result.columns); // Column names
console.log(result.duration); // Execution time (ms)
```

### With Express (10 seconds)

```typescript
import express from 'express';
import { sqlDashboard } from 'sql-dashboard/express';

const app = express();
app.use(express.json());

// Mount full SQL dashboard API in one line
app.use(sqlDashboard({
  driver: { type: 'sqlite', connection: { path: './data.db' } },
  basePath: '/admin/sql',
}));

app.listen(3000);
```

**Now you have a full SQL admin REST API:**

```
POST /admin/sql/query   - Execute SQL
GET  /admin/sql/schema   - Browse schema
GET  /admin/sql/tables   - List tables
GET  /admin/sql/status   - Dashboard status
```

---

## 📚 API Reference

### `SQLDashboard`

The main class for all database operations.

```typescript
import { SQLDashboard, DriverType } from 'sql-dashboard';

const db = new SQLDashboard(options: DashboardOptions);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `driver` | `DriverConfig` | required | Database connection config |
| `security` | `SecurityConfig` | `{}` | Security settings |
| `logger` | `LoggerConfig` | `{ level: 'info' }` | Logger configuration |
| `autoConnect` | `boolean` | `true` | Auto-connect on instantiation |

#### Methods

```typescript
// Execute a query
const result: QueryResult = await db.query(sql, options?);

// Execute with separate params
const result = await db.query('SELECT * FROM users WHERE id = ?', { params: [1] });

// Batch execution
const results: QueryResult[] = await db.batch(['INSERT INTO ...', 'UPDATE ...']);

// Transaction
const result = await db.transaction(async (query) => {
  const r1 = await query('INSERT INTO ...');
  const r2 = await query('UPDATE ...');
  return r2;
});

// Explain query plan
const plan = await db.explain('SELECT * FROM users');

// Database status
const status = await db.status();

// Validate without executing
const validation = db.validate('SELECT * FROM users');

// Schema browsing
const schema = await db.schema.getSchema();
const tables = await db.schema.getTables();
const columns = await db.schema.getColumns('users');
const indexes = await db.schema.getIndexes('users');

// Query history
const history = db.history.list({ page: 1, pageSize: 50 });
const stats = db.history.getStats();

// Export
import { toCSV, toJSON } from 'sql-dashboard/export';
const csv = toCSV(result);
const json = toJSON(result);

// Cleanup
db.destroy();
```

#### `QueryResult`

```typescript
interface QueryResult {
  id: string;           // Unique query ID
  status: 'success' | 'error';
  rows: Record<string, unknown>[];  // Result rows
  columns: string[];               // Column names
  rowCount: number;                // Number of rows
  affectedRows?: number;           // For INSERT/UPDATE/DELETE
  duration: number;                // Execution time (ms)
  query: string;                   // Original query
  error?: string;                  // Error message if failed
  insertedId?: string | number;    // Last inserted ID
}
```

---

## 🔐 Security

SQL Dashboard comes with enterprise-grade security features:

```typescript
const db = new SQLDashboard({
  driver: { type: 'sqlite', connection: { mode: 'memory' } },
  security: {
    // Read-only mode: blocks all write operations
    readOnly: true,

    // Or with fine-grained control
    readOnly: {
      allowSelect: true,
      allowShow: true,
      bypassUsers: ['admin'],
    },

    // Rate limiting: prevent abuse
    rateLimit: {
      enabled: true,
      windowMs: 60000,        // 1 minute
      maxQueries: 100,        // Max 100 queries per minute
    },

    // Banned statements
    bannedStatements: ['DROP', 'TRUNCATE', 'GRANT'],

    // Require WHERE clause for UPDATE/DELETE (prevents accidents)
    requireWhere: true,

    // Maximum query length
    maxQueryLength: 10000,

    // Maximum rows returned
    maxRows: 1000,

    // Query timeout (ms)
    queryTimeout: 30000,
  },
});
```

### SQL Injection Protection

All queries are automatically scanned for SQL injection patterns.

---

## 🗄 Database Drivers

### SQLite (built-in, no dependencies)

```typescript
const db = new SQLDashboard({
  driver: {
    type: 'sqlite',
    connection: { mode: 'memory' },  // In-memory database
    // or
    connection: { path: './data/database.db' },  // File-based
  },
});
```

### MySQL

```typescript
// npm install mysql2
const db = new SQLDashboard({
  driver: {
    type: 'mysql',
    connection: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: 'myapp',
    },
  },
});
```

### PostgreSQL

```typescript
// npm install pg
const db = new SQLDashboard({
  driver: {
    type: 'postgres',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'myapp',
      schema: 'public',
    },
  },
});
```

### MSSQL

```typescript
// npm install tedious
const db = new SQLDashboard({
  driver: {
    type: 'mssql',
    connection: {
      server: 'localhost',
      port: 1433,
      user: 'sa',
      password: 'password',
      database: 'myapp',
    },
  },
});
```

---

## 📊 Schema Browser

Explore your entire database structure programmatically:

```typescript
// Get complete schema
const schema = await db.schema.getSchema();

// List all tables
const tables = await db.schema.getTables();

// Get detailed table info
const table = await db.schema.getTable('users');
// table.columns    - Column definitions
// table.indexes    - Index information
// table.foreignKeys - Foreign key relationships
// table.rowCount   - Approximate row count

// Get specific details
const columns = await db.schema.getColumns('users');
const indexes = await db.schema.getIndexes('users');
const foreignKeys = await db.schema.getForeignKeys('users');
const views = await db.schema.getViews();

// Get table summary
const summary = await db.schema.getTableSummary('users');
// { name, columnCount, indexCount, foreignKeyCount, rowCount, size }

// Search tables
const results = await db.schema.searchTables('user');
```

---

## 📝 Query History

Every query is automatically recorded:

```typescript
// List history with pagination
const history = db.history.list({
  page: 1,
  pageSize: 50,
  database: 'myapp',
  status: 'success',
  search: 'SELECT',
});

// Get recent queries
const recent = db.history.getRecent(10);

// Get statistics
const stats = db.history.getStats();
// { totalQueries, successfulQueries, failedQueries, avgDuration }

// Clear history
db.history.clear();
```

---

## 💾 Export

```typescript
import { toCSV, toJSON, toJSONLines } from 'sql-dashboard/export';

const result = await db.query('SELECT * FROM users');

// CSV export
const csv = toCSV(result, { delimiter: ',', includeHeader: true });
fs.writeFileSync('users.csv', csv);

// JSON export
const json = toJSON(result, { pretty: true, includeMeta: false });

// JSON Lines (one JSON object per line)
const jsonl = toJSONLines(result);
```

---

## 🎯 Use Cases

### Admin Panel Backend
Mount the Express middleware and get a complete SQL management REST API.

### Development Tools
Quick database inspection, query debugging, schema exploration.

### Data Migration
Batch queries, transactions, export/import utilities.

### Monitoring
Query history, slow query logging, performance stats.

### Custom Admin Interfaces
Build your own admin panel on top of the robust API.

---

## 📖 Examples

Check out the [examples](./examples) directory:

- **basic.ts** - Quick start with all core features
- **express.ts** - Express middleware integration
- **admin-panel.ts** - Full admin panel example

---

## 🛠 Development

```bash
# Clone
git clone https://github.com/Karan-Safaie-Qadi/sql-dashboard.git

# Install dependencies
npm install

# Build
npm run build:all

# Test
npm test

# Watch mode
npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Support

- [GitHub Issues](https://github.com/Karan-Safaie-Qadi/sql-dashboard/issues)
- [Documentation](https://github.com/Karan-Safaie-Qadi/sql-dashboard/wiki)

---

<div align="center">
Made with ❤️ for the open source community
</div>
