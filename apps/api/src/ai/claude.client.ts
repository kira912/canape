import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ExtractRequest, LlmProvider } from "./llm";

/** Override with ANTHROPIC_MODEL (e.g. "claude-haiku-4-5" for lower cost). */
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

/**
 * Structured extraction with Claude: the answer is constrained to a zod schema
 * (structured outputs) and parsed by the SDK. Kept small on purpose — the AI
 * features only turn free text into criteria; titles always come from TMDB.
 */
@Injectable()
export class ClaudeClient implements LlmProvider {
  private readonly logger = new Logger(ClaudeClient.name);
  protected anthropic: Anthropic | null;
  readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("ANTHROPIC_API_KEY")?.trim();
    // Short timeout + one retry: this sits behind an interactive search box.
    this.anthropic = apiKey ? new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 }) : null;
    this.model = config.get<string>("ANTHROPIC_MODEL")?.trim() || DEFAULT_CLAUDE_MODEL;
  }

  get enabled(): boolean {
    return this.anthropic !== null;
  }

  get label(): string {
    return `anthropic:${this.model}`;
  }

  async extract<T>({ system, user, schema, maxTokens = 2048 }: ExtractRequest<T>): Promise<T> {
    if (!this.anthropic) throw new ServiceUnavailableException("ANTHROPIC_API_KEY manquante côté API");

    // Haiku 4.5 supports neither `effort` nor server-side fallbacks.
    const isHaiku = this.model.startsWith("claude-haiku");
    let response;
    try {
      response = await this.anthropic.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        ...(isHaiku
          ? {}
          : {
              // A request declined by the model's safety classifiers is re-run
              // server-side on Anthropic's recommended fallback model.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default" as const,
            }),
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
        output_config: {
          format: betaZodOutputFormat(schema),
          // Turning a sentence into criteria needs little reasoning.
          ...(isHaiku ? {} : { effort: "low" as const }),
        },
      });
    } catch (error) {
      throw this.toHttpError(error);
    }

    if (response.stop_reason === "refusal") {
      throw new UnprocessableEntityException("Demande refusée par le modèle");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      this.logger.warn(`Réponse inexploitable (stop_reason=${response.stop_reason})`);
      throw new BadGatewayException("Réponse de l'IA inexploitable");
    }
    return response.parsed_output as T;
  }

  /** Most specific first: rate limits and configuration problems are surfaced distinctly. */
  private toHttpError(error: unknown): HttpException {
    if (error instanceof Anthropic.RateLimitError) {
      return new HttpException("IA momentanément saturée", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      this.logger.error("Clé Anthropic invalide ou sans accès au modèle");
      return new ServiceUnavailableException("IA mal configurée");
    }
    if (error instanceof Anthropic.BadRequestError) {
      this.logger.error(`Requête IA invalide: ${error.message}`);
      return new BadGatewayException("Requête IA invalide");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new ServiceUnavailableException("IA injoignable");
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.warn(`Erreur IA ${error.status}: ${error.message}`);
      return new BadGatewayException("Erreur de l'IA");
    }
    this.logger.error(`Erreur IA inattendue: ${String(error)}`);
    return new BadGatewayException("Erreur de l'IA");
  }
}
