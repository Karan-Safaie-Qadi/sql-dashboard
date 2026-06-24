import { demoBasicSetup } from './features/setup';
import { demoTableCreation } from './features/tables';
import { demoQueries } from './features/queries';
import { demoTransactions, demoBatchQueries } from './features/transactions';
import { demoSchema } from './features/schema';
import { demoExports } from './features/exports';
import { demoValidation } from './features/validation';
import { demoSecurity, demoUtilities } from './features/security';
import { demoHistory, demoEvents, demoErrors, demoExplain, demoStatus, demoFactory } from './features/admin';

const DIVIDER = '='.repeat(60);

function section(num: string, title: string): void {
  console.log(`\n${DIVIDER}\n  ${num}. ${title}\n${DIVIDER}`);
}

async function main(): Promise<void> {
  console.log(`\n  SQL-Dashboard v1.0.1 - Feature Demo\n  ${DIVIDER}`);

  const db = await demoBasicSetup();

  section('1', 'Table Creation'); await demoTableCreation(db);
  section('2', 'Query Execution'); await demoQueries(db);
  section('3', 'Transactions & Batch'); await demoTransactions(db); await demoBatchQueries(db);
  section('4', 'Schema Browser'); await demoSchema(db);
  section('5', 'Exports'); await demoExports(db);
  section('6', 'Validation & Formatting'); await demoValidation(db);
  section('7', 'Security & Utilities'); await demoSecurity(); await demoUtilities();
  section('8', 'Query History'); await demoHistory(db);
  section('9', 'Events & Errors'); await demoEvents(db); await demoErrors(db);
  section('10', 'Explain & Status'); await demoExplain(db); await demoStatus(db);
  section('11', 'Factory'); await demoFactory();

  console.log(`\n${DIVIDER}\n  All features demonstrated successfully\n${DIVIDER}\n`);
  db.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });
