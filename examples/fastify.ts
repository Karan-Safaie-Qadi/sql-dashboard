import Fastify from 'fastify';
import { registerFastifyPlugin } from '../dist/index.mjs';

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(registerFastifyPlugin, {
    driver: {
      type: 'sqlite' as any,
      connection: { mode: 'memory' },
    },
    logger: { level: 'info' },
    basePath: '/sql-dashboard',
  });

  fastify.get('/', async () => ({ status: 'SQL-Dashboard Fastify example running' }));

  try {
    await fastify.listen({ port: 3000 });
    console.log('Fastify server running at http://localhost:3000');
    console.log('POST /sql-dashboard/query with { "sql": "SELECT 1" }');
    console.log('GET  /sql-dashboard/schema');
    console.log('GET  /sql-dashboard/status');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
