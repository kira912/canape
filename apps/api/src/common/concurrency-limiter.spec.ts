import { ConcurrencyLimiter } from "./concurrency-limiter";

describe("ConcurrencyLimiter", () => {
  it("never runs more than `max` tasks at once and runs them all", async () => {
    const limiter = new ConcurrencyLimiter(3);
    let running = 0;
    let peak = 0;
    const task = async (i: number) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return i;
    };

    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => limiter.run(() => task(i))));

    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("frees the slot of a failed task", async () => {
    const limiter = new ConcurrencyLimiter(1);

    await expect(limiter.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limiter.run(async () => "ok")).resolves.toBe("ok");
  });
});
