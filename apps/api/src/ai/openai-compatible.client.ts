import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as z from "zod/v4";
import type { ExtractRequest, LlmProvider } from "./llm";

/** Groq: free tier without a credit card (rate-limited), OpenAI-compatible API. */
export const DEFAULT_LLM_BASE_URL = "https://api.groq.com/openai/v1";
/** Supports strict JSON-schema outputs on Groq (constrained decoding). */
export const DEFAULT_LLM_MODEL = "openai/gpt-oss-120b";

interface ChatCompletion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

/**
 * Any OpenAI-compatible `/chat/completions` endpoint (Groq by default, also
 * Gemini, OpenRouter, Cerebras…). Asks for a strict JSON schema, falls back to
 * plain JSON mode when the endpoint/model rejects it, and always re-validates
 * the answer with zod.
 */
@Injectable()
export class OpenAiCompatibleClient implements LlmProvider {
  private readonly logger = new Logger(OpenAiCompatibleClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  readonly model: string;
  /** Endpoints that refused `json_schema` once: don't ask again. */
  private schemaUnsupported = false;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("LLM_API_KEY")?.trim() || undefined;
    this.baseUrl = (config.get<string>("LLM_BASE_URL")?.trim() || DEFAULT_LLM_BASE_URL).replace(/\/$/, "");
    this.model = config.get<string>("LLM_MODEL")?.trim() || DEFAULT_LLM_MODEL;
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  get label(): string {
    return `openai-compatible:${this.model}`;
  }

  async extract<T>({ system, user, schema, maxTokens = 2048 }: ExtractRequest<T>): Promise<T> {
    if (!this.apiKey) throw new ServiceUnavailableException("LLM_API_KEY manquante côté API");
    const jsonSchema = toStrictJsonSchema(schema);

    let content: string;
    if (this.schemaUnsupported) {
      content = await this.complete(system, user, jsonSchema, maxTokens, "json_object");
    } else {
      try {
        content = await this.complete(system, user, jsonSchema, maxTokens, "json_schema");
      } catch (error) {
        if (!(error instanceof SchemaRejected)) throw error;
        this.logger.warn(`${this.label}: json_schema refusé, repli sur le mode JSON simple`);
        this.schemaUnsupported = true;
        content = await this.complete(system, user, jsonSchema, maxTokens, "json_object");
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadGatewayException("Réponse de l'IA inexploitable (JSON invalide)");
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(`${this.label}: réponse hors schéma: ${result.error.message}`);
      throw new BadGatewayException("Réponse de l'IA inexploitable");
    }
    return result.data;
  }

  private async complete(
    system: string,
    user: string,
    jsonSchema: Record<string, unknown>,
    maxTokens: number,
    mode: "json_schema" | "json_object",
  ): Promise<string> {
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      // Reasoning models (gpt-oss): little reasoning is needed to extract criteria.
      ...(this.model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      response_format:
        mode === "json_schema"
          ? { type: "json_schema", json_schema: { name: "criteria", strict: true, schema: jsonSchema } }
          : { type: "json_object" },
      messages: [
        {
          role: "system",
          // JSON mode needs the shape spelled out; harmless with a strict schema.
          content: `${system}\n\nAnswer with a single JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
        },
        { role: "user", content: user },
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new ServiceUnavailableException("IA injoignable");
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 400 && mode === "json_schema" && /schema|response_format/i.test(detail)) {
        throw new SchemaRejected();
      }
      throw this.toHttpError(response.status, detail);
    }
    const completion = (await response.json()) as ChatCompletion;
    const choice = completion.choices?.[0];
    if (!choice?.message?.content || choice.finish_reason === "length") {
      throw new BadGatewayException("Réponse de l'IA inexploitable");
    }
    return choice.message.content;
  }

  private toHttpError(status: number, detail: string): HttpException {
    if (status === 429) return new HttpException("IA momentanément saturée", HttpStatus.TOO_MANY_REQUESTS);
    if (status === 401 || status === 403) {
      this.logger.error(`${this.label}: clé invalide ou sans accès au modèle`);
      return new ServiceUnavailableException("IA mal configurée");
    }
    this.logger.warn(`${this.label}: erreur ${status}: ${detail.slice(0, 300)}`);
    return new BadGatewayException("Erreur de l'IA");
  }
}

class SchemaRejected extends Error {}

/** zod → JSON Schema accepted by strict structured outputs (no $schema, no numeric bounds). */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node)
          .filter(([key]) => !["$schema", "minimum", "maximum"].includes(key))
          .map(([key, value]) => [key, strip(value)]),
      );
    }
    return node;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}
