import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CatalogModule } from "../catalog/catalog.module";
import { MemberGuard } from "../household/member.guard";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ClaudeClient } from "./claude.client";
import { LLM_PROVIDER, type LlmProvider } from "./llm";
import { OpenAiCompatibleClient } from "./openai-compatible.client";

/**
 * LLM_PROVIDER=anthropic | openai-compatible, or automatic: Claude when
 * ANTHROPIC_API_KEY is set, otherwise the OpenAI-compatible endpoint (Groq,
 * free tier) when LLM_API_KEY is set. Without any key the AI routes answer 503.
 */
export function selectLlmProvider(config: ConfigService, claude: ClaudeClient, compatible: OpenAiCompatibleClient) {
  const wanted = config.get<string>("LLM_PROVIDER")?.trim();
  const provider: LlmProvider =
    wanted === "anthropic"
      ? claude
      : wanted === "openai-compatible"
        ? compatible
        : claude.enabled
          ? claude
          : compatible;
  new Logger("AiModule").log(`IA : ${provider.label}${provider.enabled ? "" : " (désactivée : clé manquante)"}`);
  return provider;
}

@Module({
  imports: [CatalogModule],
  controllers: [AiController],
  providers: [
    AiService,
    ClaudeClient,
    OpenAiCompatibleClient,
    MemberGuard,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, ClaudeClient, OpenAiCompatibleClient],
      useFactory: selectLlmProvider,
    },
  ],
})
export class AiModule {}
