import { SQLDashboard } from '../../engine';
import { toCSV, toJSON, toJSONLines, toJSONArray } from '../../export';

export async function demoExports(db: SQLDashboard): Promise<void> {
  const users = await db.query('SELECT id, name, email, role, active FROM users LIMIT 3');

  console.log(`  CSV:\n    ${toCSV(users).split('\n').slice(0, 3).join('\n    ')}`);
  console.log(`  JSON pretty:\n    ${toJSON(users).substring(0, 150)}...`);
  console.log(`  JSON Lines:\n    ${toJSONLines(users).split('\n')[0]}`);
  console.log(`  JSON Array:\n    ${toJSONArray(users).substring(0, 100)}...`);

  const csvTab = toCSV(users, { delimiter: '\t', nullValue: '<null>' });
  console.log(`  CSV (tab): ${csvTab.split('\n')[0]}`);

  const jsonMeta = toJSON(users, { includeMeta: true });
  const parsed = JSON.parse(jsonMeta);
  console.log(`  JSON+meta: ${parsed.meta.rowCount} rows, ${parsed.meta.columns.join(', ')}`);
}
