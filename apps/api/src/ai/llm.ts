import type * as z from "zod/v4";

export interface ExtractRequest<T> {
  /** Stable per language: cacheable prompt prefix. */
  system: string;
  /** Volatile part (the user's text, current year…). */
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/**
 * Turns free text into a structured object. The AI features only need this:
 * titles always come from TMDB, never from the model.
 */
export interface LlmProvider {
  /** For logs / diagnostics ("anthropic:claude-opus-5-5", "openai-compatible:openai/gpt-oss-120b"). */
  readonly label: string;
  readonly enabled: boolean;
  extract<T>(request: ExtractRequest<T>): Promise<T>;
}

export const LLM_PROVIDER = Symbol("LLM_PROVIDER");
