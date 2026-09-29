import { z } from "zod";
import { apiGet, apiRequest, buildQuery } from "./api-client";
import { useSession } from "./household-store";

describe("buildQuery", () => {
  it("joins id lists and skips empty values", () => {
    expect(buildQuery({ q: "la haine", providers: [8, 119], genres: [], page: 1, sort: undefined })).toBe(
      "?q=la%20haine&providers=8%2C119&page=1",
    );
    expect(buildQuery({})).toBe("");
  });
});

describe("apiRequest", () => {
  function jsonResponse(status: number, body: unknown) {
    return { ok: status < 300, status, json: async () => body } as Response;
  }

  beforeEach(() => {
    useSession.setState({ token: "tok-1", memberId: "m1" });
    global.fetch = jest.fn();
  });

  it("sends the session token as a bearer header", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(204, null));

    await apiRequest("PUT", "/favorites/household/movie/1", null);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  it("drops the local session when the API no longer knows it", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, { message: "Session inconnue" }));

    await expect(apiRequest("GET", "/household", null)).rejects.toThrow("Session inconnue");
    expect(useSession.getState().token).toBeNull();
  });
});

describe("apiGet", () => {
  it("puts the app language in the URL so the CDN caches each language separately", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] } as unknown as Response);

    await apiGet("/genres/movie", z.array(z.unknown()), { page: 2 });

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/genres\/movie\?page=2&lang=(fr|en)$/);
  });
});
