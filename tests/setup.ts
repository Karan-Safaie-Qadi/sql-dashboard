import { SQLDashboard } from '../src';
import { DriverType } from '../src/types';
import { defineVitestConfig } from 'vitest/config';

export function createTestDashboard(): SQLDashboard {
  return new SQLDashboard({
    driver: {
      type: DriverType.SQLITE,
      connection: {
        mode: 'memory',
      },
    },
    logger: {
      level: 'silent',
    },
    autoConnect: true,
  });
}

export async function withTestDashboard<T>(
  fn: (db: SQLDashboard) => Promise<T>
): Promise<T> {
  const db = createTestDashboard();
  try {
    await db.connect();
    return await fn(db);
  } finally {
    db.destroy();
  }
}
