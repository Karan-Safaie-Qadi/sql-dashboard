import { describe, it, expect, vi } from 'vitest';

describe('Express Middleware', () => {
  it('should create router with basePath', async () => {
    const { createExpressRouter, sqlDashboard } = await import('../src/middleware/express');
    const router = createExpressRouter({
      driver: { type: 'sqlite' as any, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
      autoConnect: false,
    });
    expect(router).toBeTruthy();
    expect(typeof (router as any).close).toBe('function');
  });

  it('should create router via shorthand', async () => {
    const { sqlDashboard } = await import('../src/middleware/express');
    const router = sqlDashboard({
      driver: { type: 'sqlite' as any, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
      autoConnect: false,
    });
    expect(router).toBeTruthy();
  });

  it('should handle custom basePath', async () => {
    const { createExpressRouter } = await import('../src/middleware/express');
    const router = createExpressRouter({
      driver: { type: 'sqlite' as any, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
      autoConnect: false,
      basePath: '/custom',
    });
    expect(router).toBeTruthy();
  });
});

describe('Fastify Middleware', () => {
  it('should register plugin', async () => {
    const { registerFastifyPlugin } = await import('../src/middleware/fastify');
    const fastify = {
      post: vi.fn(),
      get: vi.fn(),
      addHook: vi.fn(),
      register: vi.fn(),
    };

    await registerFastifyPlugin(fastify as any, {
      driver: { type: 'sqlite' as any, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
      autoConnect: false,
    });

    expect(fastify.post).toHaveBeenCalled();
    expect(fastify.get).toHaveBeenCalled();
    expect(fastify.addHook).toHaveBeenCalledWith('onClose', expect.any(Function));
  });

  it('should handle custom basePath', async () => {
    const { registerFastifyPlugin } = await import('../src/middleware/fastify');
    const fastify = {
      post: vi.fn(),
      get: vi.fn(),
      addHook: vi.fn(),
      register: vi.fn(),
    };

    await registerFastifyPlugin(fastify as any, {
      driver: { type: 'sqlite' as any, connection: { mode: 'memory' } },
      logger: { level: 'silent' },
      autoConnect: false,
      basePath: '/api/sql',
    });

    expect(fastify.post).toHaveBeenCalled();
    expect(fastify.get).toHaveBeenCalled();
  });
});
