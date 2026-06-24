import { SQLDashboard } from '../../engine';
import { DriverType } from '../../types/connection';
import type { DashboardOptions } from '../../types';

export async function demoBasicSetup(): Promise<SQLDashboard> {
  const options: DashboardOptions = {
    driver: { type: DriverType.SQLITE, connection: { mode: 'memory' } },
    logger: { level: 'silent' },
    autoConnect: false,
    security: { requireWhere: true, bannedStatements: ['TRUNCATE'], maxRows: 100, queryTimeout: 5000 },
  };

  const db = new SQLDashboard(options);
  await db.connect();

  const status = await db.status();
  console.log('  [OK] Connected to SQLite database');
  console.log(`  Dashboard Version: ${status.version}`);
  console.log(`  Driver: ${status.driver}`);
  console.log(`  Connected: ${status.connected}`);

  return db;
}
