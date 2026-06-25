import { describe, it, expect } from 'vitest';
import { ReadOnlyGuard } from '../src/security/readonly';
import { RateLimiter } from '../src/security/ratelimit';

describe('ReadOnlyGuard', () => {
  it('should allow SELECT by default', () => {
    const guard = new ReadOnlyGuard();
    const result = guard.checkReadOnly('SELECT * FROM users');
    expect(result.allowed).toBe(true);
  });

  it('should block INSERT in read-only mode', () => {
    const guard = new ReadOnlyGuard();
    const result = guard.checkReadOnly('INSERT INTO users VALUES (1)');
    expect(result.allowed).toBe(false);
  });

  it('should block DROP in read-only mode', () => {
    const guard = new ReadOnlyGuard();
    const result = guard.checkReadOnly('DROP TABLE users');
    expect(result.allowed).toBe(false);
  });

  it('should allow when disabled', () => {
    const guard = new ReadOnlyGuard({ enabled: false });
    const result = guard.checkReadOnly('DROP TABLE users');
    expect(result.allowed).toBe(true);
  });

  it('should bypass users', () => {
    const guard = new ReadOnlyGuard({ bypassUsers: ['admin'] });
    const result = guard.checkReadOnly('DROP TABLE users', 'admin');
    expect(result.allowed).toBe(true);
  });

  it('should not bypass non-admin users', () => {
    const guard = new ReadOnlyGuard({ bypassUsers: ['admin'] });
    const result = guard.checkReadOnly('DROP TABLE users', 'guest');
    expect(result.allowed).toBe(false);
  });

  it('should allow SHOW when configured', () => {
    const guard = new ReadOnlyGuard({ allowShow: true });
    const result = guard.checkReadOnly('SHOW TABLES');
    expect(result.allowed).toBe(true);
  });

  it('should block SHOW when disabled', () => {
    const guard = new ReadOnlyGuard({ allowShow: false });
    const result = guard.checkReadOnly('SHOW TABLES');
    expect(result.allowed).toBe(false);
  });

  it('should update rule dynamically', () => {
    const guard = new ReadOnlyGuard();
    expect(guard.checkReadOnly('INSERT INTO t VALUES (1)').allowed).toBe(false);
    guard.updateRule({ enabled: false });
    expect(guard.checkReadOnly('INSERT INTO t VALUES (1)').allowed).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('should allow queries within limit', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 10 });
    const result = limiter.check('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    limiter.destroy();
  });

  it('should block queries exceeding limit', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 2 });
    limiter.check('user2');
    limiter.check('user2');
    const result = limiter.check('user2');
    expect(result.allowed).toBe(false);
    limiter.destroy();
  });

  it('should have per-user limits', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxQueries: 10,
      maxQueriesPerUser: { power: 2 },
    });
    limiter.check('power');
    limiter.check('power');
    const result = limiter.check('power');
    expect(result.allowed).toBe(false);
    limiter.destroy();
  });

  it('should handle maxQueriesPerUser with value 0', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxQueries: 10,
      maxQueriesPerUser: { limited: 0 },
    });
    const result = limiter.check('limited');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    limiter.destroy();
  });

  it('should return remaining count', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 5 });
    expect(limiter.getRemaining('user3')).toBe(5);
    limiter.check('user3');
    expect(limiter.getRemaining('user3')).toBe(4);
    limiter.destroy();
  });

  it('should allow when disabled', () => {
    const limiter = new RateLimiter({ enabled: false });
    const result = limiter.check('anyone');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
    limiter.destroy();
  });

  it('should reset for specific user', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 1 });
    limiter.check('user4');
    expect(limiter.getRemaining('user4')).toBe(0);
    limiter.reset('user4');
    expect(limiter.getRemaining('user4')).toBe(1);
    limiter.destroy();
  });

  it('should reset all users', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxQueries: 1 });
    limiter.check('a');
    limiter.check('b');
    limiter.reset();
    expect(limiter.getRemaining('a')).toBe(1);
    expect(limiter.getRemaining('b')).toBe(1);
    limiter.destroy();
  });
});
