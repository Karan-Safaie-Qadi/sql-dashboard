import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { SQLDashboard } from '../engine';
import type { DashboardOptions } from '../types';

interface FastifyPluginConfig extends FastifyPluginOptions, DashboardOptions {
  basePath?: string;
}

export async function registerFastifyPlugin(
  fastify: FastifyInstance,
  options: FastifyPluginConfig
): Promise<void> {
  const db = new SQLDashboard(options);
  const basePath = options.basePath || '/sql-dashboard';

  fastify.post(`${basePath}/query`, async (request, reply) => {
    const { sql, params } = request.body as { sql: string; params?: unknown[] };
    if (!sql) {
      return reply.status(400).send({ error: 'SQL query is required' });
    }
    const result = await db.query(sql, { params });
    return reply.send(result);
  });

  fastify.get(`${basePath}/schema`, async (_request, reply) => {
    const schema = await db.schema.getSchema();
    return reply.send(schema);
  });

  fastify.get(`${basePath}/tables`, async (_request, reply) => {
    const tables = await db.schema.getTables();
    return reply.send(tables);
  });

  fastify.get(`${basePath}/tables/:tableName`, async (request, reply) => {
    const { tableName } = request.params as { tableName: string };
    const table = await db.schema.getTable(tableName);
    return reply.send(table);
  });

  fastify.get(`${basePath}/history`, async (request, reply) => {
    const { page, pageSize, search } = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const history = db.history.list({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
      search,
    });
    return reply.send(history);
  });

  fastify.get(`${basePath}/status`, async (_request, reply) => {
    const status = await db.status();
    return reply.send(status);
  });

  fastify.addHook('onClose', async () => {
    db.destroy();
  });
}

export default registerFastifyPlugin;
