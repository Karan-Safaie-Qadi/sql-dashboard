<div align="center" dir="rtl">

# SQL Dashboard

[![npm version](https://img.shields.io/npm/v/sql-dashboard.svg)](https://www.npmjs.com/package/sql-dashboard)
[![npm downloads](https://img.shields.io/npm/dm/sql-dashboard.svg)](https://www.npmjs.com/package/sql-dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/Karan-Safaie-Qadi/sql-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Karan-Safaie-Qadi/sql-dashboard/actions/workflows/ci.yml)

**کتابخانه‌ای حرفه‌ای و غنی از امکانات برای مدیریت SQL در پنل‌های مدیریتی Node.js**

</div>

---

<details>
<summary><b>فارسی - توضیحات کامل</b></summary>
<div dir="rtl">

# SQL Dashboard

یک کتابخانه قدرتمند و همه‌کاره برای مدیریت پایگاه داده‌های SQL در برنامه‌های Node.js. با SQL Dashboard می‌توانید کوئری اجرا کنید، ساختار دیتابیس را مرور کنید، امنیت را اعمال کنید و یک API مدیریتی کامل بسازید.

## ویژگی‌ها

| ویژگی | توضیحات |
|--------|---------|
| **پایگاه‌های داده چندگانه** | SQLite (داخلی)، MySQL، PostgreSQL، MSSQL |
| **اجرای کوئری** | SQL، دسته‌ای، تراکنش، پارامتری |
| **مرور ساختار** | جداول، ستون‌ها، ایندکس‌ها، کلیدهای خارجی، ویوها |
| **امنیت** | حالت فقط-خواندنی، محدودیت نرخ، تشخیص SQL injection |
| **تاریخچه کوئری** | ثبت خودکار با جستجو، آمار، صفحه‌بندی |
| **خروجی** | CSV، JSON، JSON Lines |
| **پشتیبانی از Express** | API مدیریتی کامل با یک خط کد |
| **پشتیبانی از Fastify** | پلاگین بومی برای Fastify |
| **TypeScript** | تایپ‌های کامل، حالت strict |
| **فرمت‌دهی SQL** | فرمت‌دهی خودکار کوئری‌ها |
| **کارایی** | زمان‌سنجی، ثبت کوئری‌های کند، connection pooling |

## نصب

```bash
npm install sql-dashboard
```

### درایورهای اختیاری

```bash
npm install mysql2   # برای MySQL
npm install pg       # برای PostgreSQL
npm install tedious  # برای MSSQL
npm install express  # برای Express middleware
npm install fastify  # برای Fastify plugin
```

## شروع سریع

```typescript
import { SQLDashboard, DriverType } from 'sql-dashboard';

const db = new SQLDashboard({
  driver: {
    type: DriverType.SQLITE,
    connection: { mode: 'memory' },
  },
});

const result = await db.query('SELECT * FROM users WHERE age > ?', {
  params: [18],
});

console.log(result.rows);
```

## راه‌اندازی نسخه جدید

```bash
npm run release:publish
```

این دستور خودکار:
1. نسخه را افزایش می‌دهد (`npm version`)
2. پروژه را می‌سازد و تست می‌کند
3. به npm منتشر می‌کند
4. در GitHub Release ثبت می‌کند

## دمو

```bash
npx sql-dashboard/demo
```

یک دموی جامع که تمام قابلیت‌های کتابخانه را نمایش می‌دهد.

## مستندات کامل

مستندات کامل API به زبان انگلیسی در ادامه آمده است.

</div>
</details>

---

<div align="center" dir="ltr">

# SQL Dashboard

**A professional, feature-rich SQL management library for Node.js admin panels.**

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
| **Multi-Database** | SQLite (built-in), MySQL, PostgreSQL, MSSQL |
| **Query Execution** | Run SQL, batch queries, transactions, prepared statements |
| **Schema Browser** | Browse tables, columns, indexes, foreign keys, views |
| **Security** | Read-only mode, rate limiting, SQL injection detection, query validation |
| **Query History** | Auto-recorded history with search, stats, and pagination |
| **Export** | CSV, JSON, JSON Lines export utilities |
| **Express Plugin** | Mount a full SQL admin REST API in one line |
| **Fastify Plugin** | Native Fastify plugin support |
| **TypeScript** | Full type definitions, strict mode |
| **Query Formatting** | Built-in SQL formatter |
| **Performance** | Query timing, slow query logging, connection pooling |
| **Zero Config** | Works out of the box with SQLite (in-memory or file-based) |

| Feature Demo | |
|--------------|--|
| Run the demo | `npx sql-dashboard/demo` |

---

## 📦 Installation

```bash
npm install sql-dashboard
```

### Optional Drivers

```bash
npm install mysql2     # For MySQL support
npm install pg         # For PostgreSQL support
npm install tedious    # For MSSQL support
npm install express    # For Express middleware
npm install fastify    # For Fastify plugin
```

---

## 🚀 Quick Start

### Basic Usage (30 seconds)

```typescript
import { SQLDashboard } from 'sql-dashboard';
import { DriverType } from 'sql-dashboard';

const db = new SQLDashboard({
  driver: {
    type: DriverType.SQLITE,
    connection: { mode: 'memory' },
  },
});

const result = await db.query('SELECT * FROM users WHERE age > ?', {
  params: [18],
});

console.log(result.rows);
console.log(result.columns);
console.log(result.duration);
```

### With Express (10 seconds)

```typescript
import express from 'express';
import { sqlDashboard } from 'sql-dashboard/express';

const app = express();
app.use(express.json());

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
const result = await db.query(sql, options?);
const result = await db.query('SELECT * FROM users WHERE id = ?', { params: [1] });
const results = await db.batch(['INSERT INTO ...', 'UPDATE ...']);

const result = await db.transaction(async (query) => {
  const r1 = await query('INSERT INTO ...');
  const r2 = await query('UPDATE ...');
  return r2;
});

const plan = await db.explain('SELECT * FROM users');
const status = await db.status();
const validation = db.validate('SELECT * FROM users');

const schema = await db.schema.getSchema();
const tables = await db.schema.getTables();
const columns = await db.schema.getColumns('users');
const indexes = await db.schema.getIndexes('users');

const history = db.history.list({ page: 1, pageSize: 50 });
const stats = db.history.getStats();

import { toCSV, toJSON } from 'sql-dashboard/export';
const csv = toCSV(result);
const json = toJSON(result);

db.destroy();
```

#### `QueryResult`

```typescript
interface QueryResult {
  id: string;
  status: 'success' | 'error';
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  affectedRows?: number;
  duration: number;
  query: string;
  error?: string;
  insertedId?: string | number;
}
```

---

## 🔐 Security

```typescript
const db = new SQLDashboard({
  driver: { type: 'sqlite', connection: { mode: 'memory' } },
  security: {
    readOnly: true,
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxQueries: 100,
    },
    bannedStatements: ['DROP', 'TRUNCATE'],
    requireWhere: true,
    maxQueryLength: 10000,
    maxRows: 1000,
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
    connection: { mode: 'memory' },
    // or
    connection: { path: './data/database.db' },
  },
});
```

### MySQL

```typescript
const db = new SQLDashboard({
  driver: {
    type: 'mysql',
    connection: { host: 'localhost', port: 3306, user: 'root', password: '...', database: 'myapp' },
  },
});
```

### PostgreSQL

```typescript
const db = new SQLDashboard({
  driver: {
    type: 'postgres',
    connection: { host: 'localhost', port: 5432, user: 'postgres', password: '...', database: 'myapp', schema: 'public' },
  },
});
```

### MSSQL

```typescript
const db = new SQLDashboard({
  driver: {
    type: 'mssql',
    connection: { server: 'localhost', port: 1433, user: 'sa', password: '...', database: 'myapp' },
  },
});
```

---

## 📊 Schema Browser

```typescript
const schema = await db.schema.getSchema();
const tables = await db.schema.getTables();
const table = await db.schema.getTable('users');
const columns = await db.schema.getColumns('users');
const indexes = await db.schema.getIndexes('users');
const foreignKeys = await db.schema.getForeignKeys('users');
const views = await db.schema.getViews();
const summary = await db.schema.getTableSummary('users');
const results = await db.schema.searchTables('user');
```

---

## 📝 Query History

```typescript
const history = db.history.list({ page: 1, pageSize: 50, status: 'success', search: 'SELECT' });
const recent = db.history.getRecent(10);
const stats = db.history.getStats();
db.history.clear();
```

---

## 💾 Export

```typescript
import { toCSV, toJSON, toJSONLines } from 'sql-dashboard/export';

const result = await db.query('SELECT * FROM users');

const csv = toCSV(result, { delimiter: ',', includeHeader: true });
const json = toJSON(result, { pretty: true, includeMeta: false });
const jsonl = toJSONLines(result);
```

---

## 🎯 Use Cases

- **Admin Panel Backend** — Mount the Express middleware for a complete SQL management REST API
- **Development Tools** — Quick database inspection, query debugging, schema exploration
- **Data Migration** — Batch queries, transactions, export/import utilities
- **Monitoring** — Query history, slow query logging, performance stats
- **Custom Admin Interfaces** — Build your own admin panel on the robust API

---

## 📖 Examples

Check out the [examples](./examples) directory:
- **basic.ts** — Quick start with all core features
- **express.ts** — Express middleware integration
- **admin-panel.ts** — Full admin panel example

Run demo: `npx sql-dashboard/demo`

---

## 🛠 Development

```bash
git clone https://github.com/Karan-Safaie-Qadi/sql-dashboard.git
npm install
npm run build:all
npm test
```

---

## 📦 Publishing

To publish a new version:

```bash
npm run release:publish
```

This automatically:
1. Bumps the version (`npm version`)
2. Builds and tests the project
3. Publishes to npm
4. Creates a GitHub Release

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Support

- [GitHub Issues](https://github.com/Karan-Safaie-Qadi/sql-dashboard/issues)
- [npm](https://www.npmjs.com/package/sql-dashboard)

---

<div align="center">
Made with ❤️ for the open source community
</div>
