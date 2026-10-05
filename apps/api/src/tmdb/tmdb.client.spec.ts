import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { TmdbClient } from "./tmdb.client";

const config = { get: () => "v3-key" } as unknown as ConfigService;

function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("TmdbClient", () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends a timeout signal with every request", async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }));

    await new TmdbClient(config).get("/movie/1");

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a network failure or a timeout into a 503", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(new TmdbClient(config).get("/movie/1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("retries a 429 once after a short Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(respond(429, {}, { "retry-after": "0" })).mockResolvedValueOnce(respond(200, { id: 1 }));

    await expect(new TmdbClient(config).get("/movie/1")).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with a 503 when TMDB asks to wait long", async () => {
    fetchMock.mockResolvedValue(respond(429, {}, { "retry-after": "30" }));

    await expect(new TmdbClient(config).get("/movie/1")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("remembers unknown ids instead of asking TMDB again", async () => {
    fetchMock.mockResolvedValue(respond(404));
    const client = new TmdbClient(config);

    await expect(client.get("/movie/999999999")).rejects.toBeInstanceOf(NotFoundException);
    await expect(client.get("/movie/999999999")).rejects.toBeInstanceOf(NotFoundException);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
