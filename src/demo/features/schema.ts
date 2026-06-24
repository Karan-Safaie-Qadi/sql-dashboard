import { SQLDashboard } from '../../engine';

export async function demoSchema(db: SQLDashboard): Promise<void> {
  const tables = await db.schema.getTables();
  for (const t of tables) {
    console.log(`  Table: ${t.name} (${t.columns.length} cols, ${t.rowCount} rows)`);
    for (const c of t.columns) {
      const meta = `${c.primaryKey ? 'PK ' : ''}${c.nullable ? '' : 'NOT NULL '}${c.defaultValue ? `DEFAULT ${c.defaultValue}` : ''}`;
      console.log(`    ${c.name}: ${c.type} ${meta}`);
    }
  }

  const indexes = await db.schema.getIndexes('users');
  for (const idx of indexes) {
    console.log(`  Index: ${idx.name} on ${idx.columns.join(', ')} (${idx.type})`);
  }

  const fks = await db.schema.getForeignKeys('comments');
  for (const fk of fks) {
    console.log(`  FK: ${fk.column} -> ${fk.referencedTable}(${fk.referencedColumn})`);
  }

  const summary = await db.schema.getTableSummary('users');
  console.log(`  Summary: ${summary.name} | cols=${summary.columnCount} idx=${summary.indexCount} rows=${summary.rowCount}`);

  await db.query(`CREATE VIEW user_post_counts AS SELECT u.id, u.name, u.email, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON p.user_id = u.id GROUP BY u.id`);
  const views = await db.schema.getViews();
  for (const v of views) {
    console.log(`  View: ${v.name}`);
  }

  const schema = await db.schema.getSchema();
  console.log(`  Schema: ${schema.name} (${schema.tables.length} tables, ${schema.views.length} views)`);
}
