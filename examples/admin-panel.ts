import { SQLDashboard } from 'sql-dashboard';
import { DriverType } from 'sql-dashboard';
import { toCSV, toJSON } from 'sql-dashboard/export';
import * as fs from 'fs';

async function main() {
  const db = new SQLDashboard({
    driver: {
      type: DriverType.SQLITE,
      connection: { path: './examples/shop.db' },
    },
    security: {
      readOnly: false,
      requireWhere: true,
      bannedStatements: ['DROP', 'TRUNCATE'],
    },
    logger: {
      level: 'info',
      queries: true,
      slowQueryThreshold: 100,
    },
  });

  await db.connect();

  // Setup sample data
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER,
      total REAL,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // Insert sample data
  await db.query("INSERT INTO customers VALUES (1, 'John Doe', 'john@example.com', '2024-01-01')");
  await db.query("INSERT INTO customers VALUES (2, 'Jane Smith', 'jane@example.com', '2024-01-15')");
  await db.query("INSERT INTO orders VALUES (1, 1, 150.00, 'completed', '2024-01-10')");
  await db.query("INSERT INTO orders VALUES (2, 1, 75.50, 'pending', '2024-02-01')");
  await db.query("INSERT INTO orders VALUES (3, 2, 299.99, 'completed', '2024-02-15')");

  // ========== 1. RUN QUERIES ==========
  const customers = await db.query('SELECT * FROM customers');
  console.log('=== Customers ===');
  console.table(customers.rows);

  // ========== 2. EXPORT TO CSV ==========
  const csv = toCSV(customers);
  fs.writeFileSync('./examples/customers_export.csv', csv);
  console.log('✅ Exported customers to CSV');

  // ========== 3. EXPORT TO JSON ==========
  const json = toJSON(customers);
  fs.writeFileSync('./examples/customers_export.json', json);
  console.log('✅ Exported customers to JSON');

  // ========== 4. SCHEMA BROWSING ==========
  const tables = await db.schema.getTables();
  for (const table of tables) {
    console.log(`\n📊 Table: ${table.name}`);
    console.log(`   Columns: ${table.columns.map((c) => `${c.name} (${c.type})`).join(', ')}`);
    console.log(`   Indexes: ${table.indexes.map((i) => i.name).join(', ') || 'none'}`);
    console.log(`   Rows: ${table.rowCount}`);

    if (table.foreignKeys.length > 0) {
      console.log(`   Foreign Keys:`);
      for (const fk of table.foreignKeys) {
        console.log(`     ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`);
      }
    }
  }

  // ========== 5. QUERY HISTORY ==========
  console.log('\n=== Query History ===');
  const history = db.history.list({ pageSize: 5 });
  for (const entry of history.data) {
    const icon = entry.status === 'success' ? '✅' : '❌';
    console.log(`  ${icon} [${entry.duration.toFixed(1)}ms] ${entry.query.substring(0, 60)}...`);
  }

  // ========== 6. DASHBOARD STATS ==========
  const stats = db.history.getStats();
  console.log('\n=== Dashboard Statistics ===');
  console.log(`  Total Queries: ${stats.totalQueries}`);
  console.log(`  Successful: ${stats.successfulQueries}`);
  console.log(`  Failed: ${stats.failedQueries}`);
  console.log(`  Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);

  db.destroy();
}

main().catch(console.error);
