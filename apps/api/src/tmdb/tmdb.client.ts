import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

type QueryValue = string | number | boolean | undefined;

/**
 * Thin fetch wrapper around TMDB v3. Accepts either a v3 "API Key" (sent as
 * `api_key`) or a v4 "API Read Access Token" (a JWT, sent as Bearer).
 */
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly credential: string | undefined;

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
    if (!isBearer) params.set("api_key", this.credential);

    const response = await fetch(`${TMDB_BASE_URL}${path}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        ...(isBearer ? { Authorization: `Bearer ${this.credential}` } : {}),
      },
    });
    if (response.status === 404) throw new NotFoundException("Titre introuvable sur TMDB");
    if (!response.ok) {
      this.logger.warn(`TMDB ${path} → ${response.status}`);
      throw new BadGatewayException(`TMDB a répondu ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
