/**
 * Runs at most `max` tasks at once, the others wait in FIFO order. Keeps a
 * burst (a long favorites list, a cold instance) from opening dozens of
 * upstream connections at the same time.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.max) this.active++;
    else await new Promise<void>((resolve) => this.waiting.push(resolve)); // the slot is handed over below
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
