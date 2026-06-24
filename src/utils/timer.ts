export class QueryTimer {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  get elapsed(): number {
    return performance.now() - this.startTime;
  }

  reset(): void {
    this.startTime = performance.now();
  }

  stop(): { duration: number; startTime: Date; endTime: Date } {
    const endTime = new Date();
    return {
      duration: this.elapsed,
      startTime: new Date(Date.now() - this.elapsed),
      endTime,
    };
  }

  static async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    return { result, duration: performance.now() - start };
  }
}
