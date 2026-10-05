import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { clientIp, RateLimitGuard } from "./rate-limit.guard";
import type { RateLimitService } from "./rate-limit.service";

function context(request: Partial<Request>, name?: string) {
  const handler = () => undefined;
  if (name) Reflect.defineMetadata("rateLimit", name, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("RateLimitGuard", () => {
  const request = { ip: "203.0.113.7", headers: {}, socket: {} } as unknown as Request;

  it("ignores routes without a policy", async () => {
    const rateLimits = { consume: jest.fn(), consumeOrAllow: jest.fn() };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as unknown as RateLimitService);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(rateLimits.consume).not.toHaveBeenCalled();
  });

  it("counts per policy and hashed IP, never the raw address", async () => {
    const rateLimits = { consume: jest.fn(async () => undefined), consumeOrAllow: jest.fn() };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as unknown as RateLimitService);

    await guard.canActivate(context(request, "householdJoin"));

    const [key, policy] = rateLimits.consume.mock.calls[0] as unknown as [string, { limit: number }];
    expect(key).toMatch(/^householdJoin:[0-9a-f]{32}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(policy.limit).toBe(10);
  });

  it("propagates a 429", async () => {
    const rateLimits = {
      consume: jest.fn(async () => {
        throw new HttpException("trop", 429);
      }),
    };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as unknown as RateLimitService);

    await expect(guard.canActivate(context(request, "recover"))).rejects.toMatchObject({ status: 429 });
  });

  it("lets catalog routes through the fail-open path", async () => {
    const rateLimits = { consume: jest.fn(), consumeOrAllow: jest.fn(async () => undefined) };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as unknown as RateLimitService);

    await guard.canActivate(context(request, "catalog"));

    expect(rateLimits.consumeOrAllow).toHaveBeenCalled();
    expect(rateLimits.consume).not.toHaveBeenCalled();
  });
});

describe("clientIp", () => {
  const original = process.env.VERCEL;
  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original;
  });

  it("uses Express' resolution outside Vercel (forwarded headers ignored)", () => {
    delete process.env.VERCEL;
    const request = { ip: "10.0.0.2", headers: { "x-vercel-forwarded-for": "1.2.3.4" }, socket: {} } as unknown as Request;
    expect(clientIp(request)).toBe("10.0.0.2");
  });

  it("uses the header set by Vercel's proxy on Vercel", () => {
    process.env.VERCEL = "1";
    const request = { ip: "10.0.0.2", headers: { "x-vercel-forwarded-for": "1.2.3.4" }, socket: {} } as unknown as Request;
    expect(clientIp(request)).toBe("1.2.3.4");
  });
});
