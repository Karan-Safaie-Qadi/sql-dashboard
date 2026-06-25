import type { Request, Response, Router } from 'express';
import { SQLDashboard } from '../engine';
import type { DashboardOptions } from '../types';

interface ExpressMiddlewareOptions extends DashboardOptions {
  basePath?: string;
}

export function createExpressRouter(options: ExpressMiddlewareOptions): Router {
  const { Router } = require('express');
  const router = Router();
  const db = new SQLDashboard(options);
  const basePath = options.basePath || '/sql-dashboard';

  const handleQuery = async (req: Request, res: Response) => {
    try {
      const { sql, params } = req.body;
      if (!sql) {
        return res.status(400).json({ error: 'SQL query is required' });
      }
      const result = await db.query(sql, { params });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleSchema = async (_req: Request, res: Response) => {
    try {
      const schema = await db.schema.getSchema();
      res.json(schema);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleTables = async (_req: Request, res: Response) => {
    try {
      const tables = await db.schema.getTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleTableDetail = async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const table = await db.schema.getTable(tableName);
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleHistory = async (req: Request, res: Response) => {
    try {
      const { page, pageSize, search } = req.query;
      const history = db.history.list({
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        search: search as string | undefined,
      });
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleStatus = async (_req: Request, res: Response) => {
    try {
      const status = await db.status();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleExplain = async (req: Request, res: Response) => {
    try {
      const { sql } = req.body;
      if (!sql) return res.status(400).json({ error: 'SQL is required' });
      const result = await db.explain(sql);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleValidate = async (req: Request, res: Response) => {
    try {
      const { sql } = req.body;
      if (!sql) return res.status(400).json({ error: 'SQL is required' });
      const result = db.validate(sql);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  const handleHealth = async (_req: Request, res: Response) => {
    try {
      const status = await db.status();
      res.json({ status: 'ok', connected: status.connected, driver: status.driver, version: status.version });
    } catch (error) {
      res.status(503).json({ status: 'error', error: (error as Error).message });
    }
  };

  router.post(`${basePath}/query`, handleQuery);
  router.post(`${basePath}/explain`, handleExplain);
  router.post(`${basePath}/validate`, handleValidate);
  router.get(`${basePath}/health`, handleHealth);
  router.get(`${basePath}/schema`, handleSchema);
  router.get(`${basePath}/tables`, handleTables);
  router.get(`${basePath}/tables/:tableName`, handleTableDetail);
  router.get(`${basePath}/history`, handleHistory);
  router.get(`${basePath}/status`, handleStatus);

  (router as any).close = async () => {
    db.destroy();
  };

  return router;
}

export function sqlDashboard(options: ExpressMiddlewareOptions): Router {
  return createExpressRouter(options);
}
