import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDashboard, DriverType, formatSQL } from '../dist/index.mjs';
import { toCSV, toJSON, toJSONLines } from '../dist/export/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = createDashboard({
  driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
  logger: { level: 'silent' },
  autoConnect: true,
});

async function initSampleData() {
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
      await db.query("INSERT INTO users (name, email, role) VALUES ('Alice Johnson', 'alice@example.com', 'admin')");
      await db.query("INSERT INTO users (name, email, role) VALUES ('Bob Smith', 'bob@example.com', 'editor')");
      await db.query("INSERT INTO users (name, email, role) VALUES ('Charlie Brown', 'charlie@example.com', 'user')");
      await db.query("INSERT INTO users (name, email, role) VALUES ('Diana Prince', 'diana@example.com', 'user')");
      await db.query("INSERT INTO users (name, email, role) VALUES ('Eve Wilson', 'eve@example.com', 'editor')");

      await db.query(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        published INTEGER DEFAULT 0,
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
    console.error('Init error:', err.message);
  }
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/query', async (req, res) => {
  try {
    const { sql, readOnly, timeout, maxRows } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    const result = await db.query(sql, { readOnly, timeout, maxRows });
    res.json(result);
  } catch (err) {
    res.json({ status: 'error', error: err.message, id: '', rows: [], columns: [], rowCount: 0, duration: 0, query: req.body.sql || '' });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    res.json(await db.explain(sql));
  } catch (err) {
    res.json({ status: 'error', error: err.message, id: '', rows: [], columns: [], rowCount: 0, duration: 0, query: req.body.sql || '' });
  }
});

app.post('/api/format', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL is required' });
    res.json({ formatted: formatSQL(sql) });
  } catch (err) {
    res.json({ formatted: req.body.sql });
  }
});

app.get('/api/schema', async (_req, res) => {
  try {
    res.json(await db.schema.getSchema());
  } catch (err) {
    res.json({ error: err.message, tables: [], views: [] });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    res.json(db.history.list({ page, pageSize, search: req.query.search, status: req.query.dbstatus }));
  } catch (err) {
    res.json({ error: err.message, data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
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
    res.json({ ...status, databases });
  } catch (err) {
    res.json({ connected: false, driver: 'unknown', version: '1.0.1', uptime: 0, history: { total: 0, successful: 0, failed: 0 }, databaseVersion: undefined, databases: [] });
  }
});

app.post('/api/security', (req, res) => {
  try {
    db.updateSecurity(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/export/csv', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'text/csv').send(toCSV(req.body.result, req.body.options));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/export/json', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'application/json').send(toJSON(req.body.result, req.body.options));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/export/jsonl', (req, res) => {
  try {
    if (!req.body.result) return res.status(400).json({ error: 'No result data' });
    res.set('Content-Type', 'application/jsonl').send(toJSONLines(req.body.result));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3000;
initSampleData().then(() => {
  app.listen(PORT, () => console.log(`\n  SQL-Dashboard Web UI at http://localhost:${PORT}\n`));
});
