import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConcurrencyLimiter } from "../common/concurrency-limiter";
import { countTmdbCall } from "../common/request-log";
import { MINUTE } from "../common/ttl-cache";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
/** Well under the function's maxDuration (30 s): a slow TMDB fails fast instead of holding the request. */
const TIMEOUT_MS = 6_000;
/** Concurrent TMDB requests per API instance (TMDB allows ~50 req/s per IP). */
const MAX_CONCURRENT = 16;
/** A 429 is retried once, only if TMDB asks for a short wait. */
const MAX_RETRY_AFTER_MS = 2_000;
/** Unknown ids are remembered for a while, so repeating them doesn't reach TMDB every time. */
const NOT_FOUND_TTL_MS = 10 * MINUTE;
const NOT_FOUND_MAX_ENTRIES = 2_000;

type QueryValue = string | number | boolean | undefined;

/**
 * Thin fetch wrapper around TMDB v3. Accepts either a v3 "API Key" (sent as
 * `api_key`) or a v4 "API Read Access Token" (a JWT, sent as Bearer).
 */
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly credential: string | undefined;
  private readonly limiter = new ConcurrencyLimiter(MAX_CONCURRENT);
  private readonly notFound = new Map<string, number>();

  constructor(config: ConfigService) {
    this.credential = config.get<string>("TMDB_API_KEY")?.trim() || undefined;
  }

  async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    if (!this.credential) {
      throw new ServiceUnavailableException("TMDB_API_KEY manquante côté API (voir apps/api/.env.example)");
    }
    const isBearer = this.credential.startsWith("eyJ");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const cacheKey = `${path}?${params.toString()}`;
    if ((this.notFound.get(cacheKey) ?? 0) > Date.now()) throw titleNotFound();
    if (!isBearer) params.set("api_key", this.credential);
    const url = `${TMDB_BASE_URL}${path}?${params.toString()}`;
    const headers = { Accept: "application/json", ...(isBearer ? { Authorization: `Bearer ${this.credential}` } : {}) };

    let response = await this.fetch(url, headers, path);
    const retryAfterMs = Number(response.headers.get("retry-after") ?? "1") * 1000;
    if (response.status === 429 && retryAfterMs <= MAX_RETRY_AFTER_MS) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      response = await this.fetch(url, headers, path);
    }

    if (response.status === 404) {
      this.rememberNotFound(cacheKey);
      throw titleNotFound();
    }
    if (response.status === 429) {
      this.logger.warn(`TMDB ${path} → 429`);
      throw new ServiceUnavailableException("TMDB saturé, réessayez dans un instant");
    }
    if (!response.ok) {
      this.logger.warn(`TMDB ${path} → ${response.status}`);
      throw new BadGatewayException(`TMDB a répondu ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private fetch(url: string, headers: Record<string, string>, path: string): Promise<Response> {
    countTmdbCall();
    return this.limiter.run(async () => {
      try {
        return await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (error) {
        this.logger.warn(`TMDB ${path} injoignable: ${String(error)}`);
        throw new ServiceUnavailableException("TMDB ne répond pas");
      }
    });
  }

  private rememberNotFound(key: string) {
    if (this.notFound.size >= NOT_FOUND_MAX_ENTRIES) {
      const oldest = this.notFound.keys().next().value;
      if (oldest !== undefined) this.notFound.delete(oldest);
    }
    this.notFound.set(key, Date.now() + NOT_FOUND_TTL_MS);
  }
}

function titleNotFound() {
  return new NotFoundException("Titre introuvable sur TMDB");
}
