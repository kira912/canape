import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { RATE_LIMITS, RateLimitService, type RateLimitName } from "./rate-limit.service";

const RATE_LIMIT_KEY = "rateLimit";

/** Limits a route (or every route of a controller) per client IP, across all API instances. */
export const RateLimit = (name: RateLimitName) => SetMetadata(RATE_LIMIT_KEY, name);

/** Routes that don't need the database otherwise: an unavailable limiter lets them through. */
const FAIL_OPEN: ReadonlySet<RateLimitName> = new Set(["catalog", "title"]);

/**
 * Client IP. On Vercel the platform sets these headers itself (a client-sent
 * value is overwritten); elsewhere Express resolves `req.ip` from the socket,
 * trusting X-Forwarded-For only from a local proxy (see app-setup.ts).
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL) {
    const forwarded = request.headers["x-vercel-forwarded-for"] ?? request.headers["x-real-ip"];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (value) return value.split(",")[0].trim();
  }
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const name = this.reflector.getAllAndOverride<RateLimitName | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!name) return true;
    // Hashed: the counters table never holds raw IP addresses.
    const subject = createHash("sha256").update(clientIp(context.switchToHttp().getRequest<Request>())).digest("hex");
    const key = `${name}:${subject.slice(0, 32)}`;
    if (FAIL_OPEN.has(name)) await this.rateLimits.consumeOrAllow(key, RATE_LIMITS[name]);
    else await this.rateLimits.consume(key, RATE_LIMITS[name]);
    return true;
  }
}
