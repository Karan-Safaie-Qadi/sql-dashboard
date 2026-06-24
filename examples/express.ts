import express from 'express';
import { sqlDashboard } from 'sql-dashboard/express';
import { DriverType } from 'sql-dashboard';

const app = express();
app.use(express.json());

// ========== MOUNT THE FULL SQL DASHBOARD API ==========
app.use(
  sqlDashboard({
    driver: {
      type: DriverType.SQLITE,
      connection: { path: './examples/admin.db' },
    },
    security: {
      readOnly: false,
      maxQueryLength: 5000,
      rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxQueries: 60,
      },
    },
    logger: {
      level: 'info',
      queries: true,
    },
    basePath: '/admin/database',
  })
);

// Your other routes...
app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to the Admin Panel!' });
});

app.listen(3000, () => {
  console.log('✨ Admin panel running at http://localhost:3000');
  console.log('📊 SQL Dashboard at http://localhost:3000/admin/database');
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /admin/database/query     - Execute SQL');
  console.log('  GET  /admin/database/schema     - Get schema');
  console.log('  GET  /admin/database/tables     - List tables');
  console.log('  GET  /admin/database/status     - Dashboard status');
  console.log('');
  console.log('Example:');
  console.log('  curl -X POST http://localhost:3000/admin/database/query \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"sql": "SELECT * FROM users"}\'');
});
