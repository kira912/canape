import Anthropic from "@anthropic-ai/sdk";
import { HttpStatus, type HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import * as z from "zod/v4";
import { ClaudeClient, DEFAULT_CLAUDE_MODEL } from "./claude.client";

const config = (env: Record<string, string>) => ({ get: (key: string) => env[key] }) as unknown as ConfigService;
const schema = z.object({ ok: z.boolean() });
type Params = Record<string, any>;
const answer = (value: object) => jest.fn(async (_params: Params) => value);

function clientWith(parse: jest.Mock, model?: string) {
  const client = new ClaudeClient(
    config({ ANTHROPIC_API_KEY: "test-key", ...(model ? { ANTHROPIC_MODEL: model } : {}) }),
  );
  (client as unknown as { anthropic: unknown }).anthropic = { beta: { messages: { parse } } };
  return client;
}

describe("ClaudeClient", () => {
  it("is disabled without an API key", async () => {
    const client = new ClaudeClient(config({}));
    expect(client.enabled).toBe(false);
    await expect(client.extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 503 });
  });

  it("sends a cached system prompt, low effort and server-side fallbacks by default", async () => {
    const parse = answer({ stop_reason: "end_turn", parsed_output: { ok: true } });
    const client = clientWith(parse);

    expect(await client.extract({ system: "system", user: "user", schema })).toEqual({ ok: true });

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe(DEFAULT_CLAUDE_MODEL);
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.output_config.effort).toBe("low");
    expect(params.system[0]).toMatchObject({ text: "system", cache_control: { type: "ephemeral" } });
  });

  it("omits effort and fallbacks for Haiku", async () => {
    const parse = answer({ stop_reason: "end_turn", parsed_output: { ok: true } });
    await clientWith(parse, "claude-haiku-4-5").extract({ system: "s", user: "u", schema });

    const params = parse.mock.calls[0][0];
    expect(params.fallbacks).toBeUndefined();
    expect(params.output_config.effort).toBeUndefined();
  });

  it("turns refusals and truncated answers into HTTP errors", async () => {
    const refusal = clientWith(answer({ stop_reason: "refusal", parsed_output: null }));
    await expect(refusal.extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 422 });

    const truncated = clientWith(answer({ stop_reason: "max_tokens", parsed_output: null }));
    await expect(truncated.extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 502 });
  });

  it("maps rate limits to 429", async () => {
    const rateLimited = new Anthropic.RateLimitError(429, { type: "error" }, "slow down", new Headers());
    const client = clientWith(jest.fn(async (_params: Params) => Promise.reject(rateLimited)));

    const error = (await client.extract({ system: "s", user: "u", schema }).catch((e) => e)) as HttpException;
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
