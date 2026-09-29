import type { ConfigService } from "@nestjs/config";
import * as z from "zod/v4";
import type { ClaudeClient } from "./claude.client";
import { selectLlmProvider } from "./ai.module";
import { DEFAULT_LLM_MODEL, OpenAiCompatibleClient, toStrictJsonSchema } from "./openai-compatible.client";

const config = (env: Record<string, string>) => ({ get: (key: string) => env[key] }) as unknown as ConfigService;
const schema = z.object({ mediaType: z.enum(["movie", "tv"]).nullable(), genreIds: z.array(z.number().int()) });

const reply = (status: number, body: unknown) =>
  ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }) as Response;
const completion = (content: string) => reply(200, { choices: [{ message: { content }, finish_reason: "stop" }] });

describe("OpenAiCompatibleClient", () => {
  let fetchMock: jest.SpyInstance;
  const client = () => new OpenAiCompatibleClient(config({ LLM_API_KEY: "gsk_test" }));
  const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body as string);

  beforeEach(() => (fetchMock = jest.spyOn(global, "fetch")));
  afterEach(() => jest.restoreAllMocks());

  it("asks Groq for a strict JSON schema and validates the answer", async () => {
    fetchMock.mockResolvedValue(completion('{"mediaType":"movie","genreIds":[35]}'));

    const result = await client().extract({ system: "sys", user: "usr", schema });

    expect(result).toEqual({ mediaType: "movie", genreIds: [35] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer gsk_test");
    const body = bodyOf(0);
    expect(body.model).toBe(DEFAULT_LLM_MODEL);
    expect(body.reasoning_effort).toBe("low");
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
    expect(body.messages[1]).toEqual({ role: "user", content: "usr" });
  });

  it("falls back to JSON mode when the model rejects json_schema, and remembers it", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: { message: "response_format json_schema is not supported" } }))
      .mockResolvedValue(completion('{"mediaType":null,"genreIds":[]}'));
    const llm = client();

    await llm.extract({ system: "s", user: "u", schema });
    await llm.extract({ system: "s", user: "u", schema });

    expect(bodyOf(1).response_format).toEqual({ type: "json_object" });
    expect(bodyOf(2).response_format).toEqual({ type: "json_object" });
  });

  it("rejects answers that don't match the schema", async () => {
    fetchMock.mockResolvedValue(completion('{"mediaType":"book","genreIds":[]}'));
    await expect(client().extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 502 });
  });

  it("maps free-tier rate limits to 429 and a missing key to 503", async () => {
    fetchMock.mockResolvedValue(reply(429, "rate limit reached"));
    await expect(client().extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 429 });

    const noKey = new OpenAiCompatibleClient(config({}));
    await expect(noKey.extract({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 503 });
  });

  it("produces a schema accepted by strict mode", () => {
    const json = toStrictJsonSchema(schema);
    expect(json.$schema).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("maximum");
    expect(json).toMatchObject({ additionalProperties: false, required: ["mediaType", "genreIds"] });
  });
});

describe("selectLlmProvider", () => {
  const claude = (enabled: boolean) => ({ enabled, label: "anthropic" }) as unknown as ClaudeClient;
  const compatible = { enabled: true, label: "compatible" } as unknown as OpenAiCompatibleClient;

  it("prefers Claude when its key is set, otherwise the free OpenAI-compatible endpoint", () => {
    const withKey = claude(true);
    expect(selectLlmProvider(config({}), withKey, compatible)).toBe(withKey);
    expect(selectLlmProvider(config({}), claude(false), compatible)).toBe(compatible);
  });

  it("honours an explicit LLM_PROVIDER", () => {
    const c = claude(true);
    expect(selectLlmProvider(config({ LLM_PROVIDER: "openai-compatible" }), c, compatible)).toBe(compatible);
    expect(selectLlmProvider(config({ LLM_PROVIDER: "anthropic" }), claude(false), compatible)).not.toBe(compatible);
  });
});
