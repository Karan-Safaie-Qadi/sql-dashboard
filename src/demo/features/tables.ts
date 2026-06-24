import { SQLDashboard } from '../../engine';

export async function demoTableCreation(db: SQLDashboard): Promise<void> {
  await db.query(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'user', active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.query(`CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, published INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
  await db.query(`CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id))`);

  const users = [
    { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { name: 'Bob Smith', email: 'bob@example.com', role: 'editor' },
    { name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
    { name: 'Diana Prince', email: 'diana@example.com', role: 'user' },
    { name: 'Eve Wilson', email: 'eve@example.com', role: 'editor' },
  ];
  for (const u of users) {
    await db.query('INSERT INTO users (name, email, role) VALUES (?, ?, ?)', { params: [u.name, u.email, u.role] });
  }

  await db.query('INSERT INTO posts (user_id, title, body) VALUES (1, \'Getting Started with SQL\', \'SQL is powerful...\')');
  await db.query('INSERT INTO posts (user_id, title, body) VALUES (1, \'Advanced Queries\', \'Joins and subqueries...\')');
  await db.query('INSERT INTO posts (user_id, title, body) VALUES (2, \'Database Design Tips\', \'Normalization...\')');
  await db.query('INSERT INTO posts (user_id, title, body, published) VALUES (2, \'Performance Tuning\', \'Optimize queries...\', 1)');
  await db.query('INSERT INTO posts (user_id, title, body, published) VALUES (3, \'Hello World\', \'My first post!\', 1)');
  await db.query('INSERT INTO comments (post_id, user_id, content) VALUES (1, 2, \'Great article!\')');
  await db.query('INSERT INTO comments (post_id, user_id, content) VALUES (1, 3, \'Very helpful!\')');
  await db.query('INSERT INTO comments (post_id, user_id, content) VALUES (2, 4, \'Explain joins more?\')');
  await db.query('INSERT INTO comments (post_id, user_id, content) VALUES (3, 1, \'Nice tips!\')');

  console.log('  [OK] 3 tables created with sample data');
}
