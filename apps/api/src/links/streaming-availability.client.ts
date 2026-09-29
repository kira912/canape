import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MediaType } from "@canape/shared";
import { z } from "zod";
import { HOUR, TtlCache } from "../common/ttl-cache";

const HOST = "streaming-availability.p.rapidapi.com";

const streamingOptionSchema = z.object({
  service: z.object({ id: z.string() }).passthrough(),
  type: z.string(),
  link: z.string().url(),
});

const showSchema = z.object({
  streamingOptions: z.record(z.array(z.unknown())).optional(),
});

export interface StreamingOption {
  serviceId: string;
  /** subscription | free | addon | rent | buy */
  type: string;
  link: string;
}

/**
 * Streaming Availability API (RapidAPI) — the only source we use for direct
 * per-platform title links (TMDB doesn't expose them). Strictly best effort:
 * missing key, quota exhausted or unexpected payload all resolve to `[]` so
 * the detail page falls back to search links.
 */
@Injectable()
export class StreamingAvailabilityClient {
  private readonly logger = new Logger(StreamingAvailabilityClient.name);
  private readonly apiKey: string | undefined;
  private readonly cache = new TtlCache(2_000);

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("STREAMING_AVAILABILITY_API_KEY")?.trim() || undefined;
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  getOptions(mediaType: MediaType, tmdbId: number, country: string): Promise<StreamingOption[]> {
    if (!this.apiKey) return Promise.resolve([]);
    const countryCode = country.toLowerCase();
    return this.cache
      .getOrLoad(`${mediaType}/${tmdbId}/${countryCode}`, 12 * HOUR, () => this.fetchOptions(mediaType, tmdbId, countryCode))
      .catch((error: unknown) => {
        this.logger.warn(`Streaming Availability ${mediaType}/${tmdbId}: ${String(error)}`);
        return [];
      });
  }

  private async fetchOptions(mediaType: MediaType, tmdbId: number, country: string): Promise<StreamingOption[]> {
    const response = await fetch(
      `https://${HOST}/shows/${mediaType}/${tmdbId}?country=${country}&output_language=fr`,
      { headers: { "X-RapidAPI-Key": this.apiKey!, "X-RapidAPI-Host": HOST } },
    );
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const show = showSchema.parse(await response.json());
    const options: StreamingOption[] = [];
    for (const raw of show.streamingOptions?.[country] ?? []) {
      const parsed = streamingOptionSchema.safeParse(raw);
      if (parsed.success) {
        options.push({ serviceId: parsed.data.service.id, type: parsed.data.type, link: parsed.data.link });
      }
    }
    return options;
  }
}
