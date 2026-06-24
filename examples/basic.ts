import { SQLDashboard } from 'sql-dashboard';
import { DriverType } from 'sql-dashboard';

async function main() {
  // ========== SIMPLE SETUP (1 line) ==========
  const db = new SQLDashboard({
    driver: {
      type: DriverType.SQLITE,
      connection: { mode: 'memory' },
    },
  });

  // Wait for connection
  await db.connect();

  // ========== CREATE TABLE & INSERT ==========
  await db.query(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0
    )
  `);

  await db.query(`INSERT INTO products VALUES (1, 'Laptop', 999.99, 10)`);
  await db.query(`INSERT INTO products VALUES (2, 'Mouse', 29.99, 50)`);
  await db.query(`INSERT INTO products VALUES (3, 'Keyboard', 79.99, 30)`);

  // ========== QUERY WITH RESULTS ==========
  const result = await db.query('SELECT * FROM products WHERE price > ?', {
    params: [50],
  });

  console.log('=== Products over $50 ===');
  console.log(`Found ${result.rowCount} products in ${result.duration.toFixed(2)}ms`);
  console.table(result.rows);

  // ========== TRANSACTION ==========
  await db.transaction(async (query) => {
    const { rowCount } = await query(
      'SELECT COUNT(*) as count FROM products'
    );
    console.log(`\nTotal products: ${JSON.stringify(rowCount)}`);
  });

  // ========== SCHEMA BROWSING ==========
  const tables = await db.schema.getTables();
  console.log('\n=== Database Tables ===');
  for (const table of tables) {
    console.log(`📊 ${table.name} (${table.columns.length} columns, ~${table.rowCount} rows)`);
  }

  // ========== EXPLAIN QUERY ==========
  const explanation = await db.explain('SELECT * FROM products WHERE price > 50');
  console.log('\n=== Query Plan ===');
  console.table(explanation.rows);

  // ========== STATUS ==========
  const status = await db.status();
  console.log('\n=== Dashboard Status ===');
  console.log(`Connected: ${status.connected}`);
  console.log(`Driver: ${status.driver}`);
  console.log(`Version: ${status.version}`);
  console.log(`Queries executed: ${status.history.total}`);

  // Cleanup
  db.destroy();
}

main().catch(console.error);
