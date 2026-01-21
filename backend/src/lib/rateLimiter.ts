type Task<T> = {
  fn: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: any) => void;
};

class RateLimiterQueue {
  private queue: Task<any>[] = [];
  private running = false;
  private lastRun = 0;
  private readonly interval: number;

  constructor(intervalMs: number) {
    this.interval = Math.max(0, intervalMs);
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.schedule();
    });
  }

  private schedule() {
    if (this.running) return;
    const now = Date.now();
    const wait = Math.max(0, this.interval - (now - this.lastRun));
    setTimeout(() => this.runNext(), wait);
    this.running = true;
  }

  private async runNext() {
    const task = this.queue.shift();
    if (!task) {
      this.running = false;
      return;
    }
    try {
      this.lastRun = Date.now();
      const res = await task.fn();
      task.resolve(res);
    } catch (e) {
      task.reject(e);
    } finally {
      this.running = false;
      if (this.queue.length > 0) this.schedule();
    }
  }
}

const rps = Number(process.env.TIENDANUBE_RPS || '2');
const intervalMs = Math.floor(1000 / Math.max(1, rps));
export const tnQueue = new RateLimiterQueue(intervalMs);

