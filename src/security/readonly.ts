import type { ReadOnlyRule } from '../types';

export class ReadOnlyGuard {
  private rule: ReadOnlyRule;

  constructor(rule: ReadOnlyRule = {}) {
    this.rule = {
      enabled: true,
      allowSelect: true,
      allowShow: true,
      allowDescribe: true,
      allowExplain: true,
      bypassUsers: [],
      ...rule,
    };
  }

  isAllowed(sql: string, user?: string): boolean {
    if (!this.rule.enabled) return true;
    if (user && this.rule.bypassUsers?.includes(user)) return true;

    const trimmed = sql.trim().toUpperCase();

    if (this.rule.allowSelect && trimmed.startsWith('SELECT')) return true;
    if (this.rule.allowShow && trimmed.startsWith('SHOW')) return true;
    if (this.rule.allowDescribe && trimmed.startsWith('DESCRIBE')) return true;
    if (this.rule.allowExplain && trimmed.startsWith('EXPLAIN')) return true;
    if (trimmed.startsWith('WITH')) return true;
    if (trimmed.startsWith('PRAGMA')) return true;

    return false;
  }

  checkReadOnly(sql: string, user?: string): { allowed: boolean; reason?: string } {
    if (this.isAllowed(sql, user)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Database is in read-only mode. Write operations are not permitted.',
    };
  }

  updateRule(rule: Partial<ReadOnlyRule>): void {
    this.rule = { ...this.rule, ...rule };
  }
}
