import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

interface RequestContext {
  /** Upstream calls made while serving this request (TMDB fan-out is the main cost driver). */
  tmdbCalls: number;
}

const context = new AsyncLocalStorage<RequestContext>();

/** Counts a TMDB call against the request being served, if any. */
export function countTmdbCall() {
  const current = context.getStore();
  if (current) current.tmdbCalls++;
}

/** One JSON line per log event: searchable in Vercel's log view (`"msg":"request"`, `"status":5…`). */
export function logEvent(fields: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...fields })}\n`);
}

/**
 * Express middleware for /api: a request id (Vercel's own when present, echoed
 * as X-Request-Id for bug reports) and a log line once the response is sent.
 * The query string is left out: it holds what people search for.
 */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-vercel-id"] as string | undefined) ?? randomUUID();
  const started = performance.now();
  const ctx: RequestContext = { tmdbCalls: 0 };
  res.setHeader("X-Request-Id", id);
  res.on("finish", () => {
    logEvent({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      msg: "request",
      id,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      ms: Math.round(performance.now() - started),
      tmdbCalls: ctx.tmdbCalls,
    });
  });
  context.run(ctx, next);
}
