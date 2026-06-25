import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createDashboard, DriverType, formatSQL } from '../dist/index.mjs';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(_dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
import { toCSV, toJSON, toJSONLines } from '../dist/export/index.mjs';
import type { DriverConfig } from '../dist/index.mjs';

function buildDriverConfig(): DriverConfig {
  const type = (process.env.DB_TYPE || 'sqlite').toLowerCase();

  switch (type) {
    case 'mysql':
      return {
        type: DriverType.MYSQL,
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || process.env.DB_DATABASE || 'test',
        },
      } as DriverConfig;

    case 'postgres':
      return {
        type: DriverType.POSTGRES,
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || process.env.DB_DATABASE || 'postgres',
          schema: process.env.DB_SCHEMA || 'public',
        },
      } as DriverConfig;

    case 'mssql':
      return {
        type: DriverType.MSSQL,
        connection: {
          server: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '1433'),
          user: process.env.DB_USER || process.env.DB_USERNAME || 'sa',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || process.env.DB_DATABASE || 'master',
        },
      } as DriverConfig;

    default:
      return {
        type: DriverType.SQLITE,
        connection: {
          mode: (process.env.DB_MODE as 'memory' | 'file') || 'memory',
          path: process.env.DB_PATH || './dashboard.db',
        },
      } as DriverConfig;
  }
}

const driverConfig = buildDriverConfig();
const isMemorySqlite = driverConfig.type === DriverType.SQLITE &&
  (driverConfig as any).connection?.mode === 'memory';

const db = createDashboard({
  driver: driverConfig,
  logger: { level: process.env.LOG_LEVEL || 'silent' },
  autoConnect: true,
});

async function seedSampleData() {
  if (!isMemorySqlite) return;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const c = await db.query('SELECT COUNT(*) as c FROM users');
    if (c.rows[0].c === 0) {
      for (const u of [
        ['Alice Johnson', 'alice@example.com', 'admin'],
        ['Bob Smith', 'bob@example.com', 'editor'],
        ['Charlie Brown', 'charlie@example.com', 'user'],
        ['Diana Prince', 'diana@example.com', 'user'],
        ['Eve Wilson', 'eve@example.com', 'editor'],
      ]) {
        await db.query('INSERT INTO users (name, email, role) VALUES (?, ?, ?)', { params: u });
      }
      await db.query(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        title TEXT NOT NULL, body TEXT, published INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
      await db.query("INSERT INTO posts (user_id, title) VALUES (1, 'Getting Started with SQL')");
      await db.query("INSERT INTO posts (user_id, title) VALUES (1, 'Advanced Queries')");
      await db.query("INSERT INTO posts (user_id, title) VALUES (2, 'Database Design Tips')");
      await db.query("INSERT INTO posts (user_id, title, published) VALUES (2, 'Performance Tuning', 1)");
      await db.query("INSERT INTO posts (user_id, title, published) VALUES (3, 'Hello World', 1)");
    }
  } catch (err) {
    console.error('Seed error:', (err as Error).message);
  }
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(_dirname, 'public')));

app.get('/api/config', (_req, res) => {
  const safe = { ...driverConfig, connection: { ...driverConfig.connection } };
  if ((safe as any).connection?.password) (safe as any).connection.password = '***';
  res.json(safe);
});

app.post('/api/query', async (req, res) => {
  try {
    const { sql, readOnly, timeout, maxRows } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    const result = await db.query(sql, { readOnly, timeout, maxRows });
    res.json(result);
  } catch (err) {
    res.json({ status: 'error', error: (err as Error).message, id: '', rows: [], columns: [], rowCount: 0, duration: 0, query: req.body.sql || '' });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    res.json(await db.explain(sql));
  } catch (err) {
    res.json({ status: 'error', error: (err as Error).message, id: '', rows: [], columns: [], rowCount: 0, duration: 0, query: req.body.sql || '' });
  }
});

app.post('/api/validate', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    res.json(db.validate(sql));
  } catch {
    res.json({ valid: false, errors: [{ message: 'Validation failed' }] });
  }
});

app.post('/api/format', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    res.json({ formatted: formatSQL(sql) });
  } catch {
    res.json({ formatted: req.body.sql });
  }
});

app.get('/api/schema', async (_req, res) => {
  try {
    res.json(await db.schema.getSchema());
  } catch (err) {
    res.json({ error: (err as Error).message, tables: [], views: [] });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    res.json(db.history.list({
      page, pageSize,
      search: req.query.search as string,
      status: req.query.dbstatus as string,
    }));
  } catch (err) {
    res.json({ error: (err as Error).message, data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
});

app.delete('/api/history', (_req, res) => {
  db.history.clear();
  res.json({ ok: true });
});

app.get('/api/status', async (_req, res) => {
  try {
    const status = await db.status();
    const databases = await db.getDatabases();
    res.json({ ...status, databases, driverConfig });
  } catch (err) {
    res.json({ connected: false, driver: 'unknown', version: '1.2.0', uptime: 0, history: { total: 0, successful: 0, failed: 0 }, databaseVersion: undefined, databases: [] });
  }
});

app.post('/api/security', (req, res) => {
  try {
    db.updateSecurity(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/export/csv', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'text/csv').send(toCSV(req.body.result, req.body.options));
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

app.post('/api/export/json', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'application/json').send(toJSON(req.body.result, req.body.options));
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

app.post('/api/export/jsonl', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'application/jsonl').send(toJSONLines(req.body.result));
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

const PORT = parseInt(process.env.PORT || '3000');
const init = isMemorySqlite ? seedSampleData() : Promise.resolve();
init.then(() => {
  const conn = driverConfig.type === DriverType.SQLITE
    ? `${(driverConfig as any).connection?.mode || 'memory'}`
    : `${(driverConfig as any).connection?.host || '?'}:${(driverConfig as any).connection?.port || '?'}/${(driverConfig as any).connection?.database || '?'}`;
  app.listen(PORT, () => console.log(`\n  SQL-Dashboard Web UI\n  Database: ${driverConfig.type} (${conn})\n  URL:      http://localhost:${PORT}\n`));
});
