import express from "express";
import type { AddressInfo } from "node:net";
import { countTmdbCall, requestLog } from "./request-log";

describe("requestLog", () => {
  it("logs one line per request with its TMDB calls, without the query string", async () => {
    const lines: string[] = [];
    const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const app = express();
    app.use(requestLog);
    app.get("/titles", async (_req, res) => {
      await Promise.resolve();
      countTmdbCall();
      countTmdbCall();
      res.json({ ok: true });
    });
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/titles?q=secret`, { headers: { "x-vercel-id": "fra1::abc" } });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(response.headers.get("x-request-id")).toBe("fra1::abc");
      const entry = JSON.parse(lines.find((l) => l.includes('"msg":"request"'))!);
      expect(entry).toMatchObject({ msg: "request", id: "fra1::abc", method: "GET", path: "/titles", status: 200, tmdbCalls: 2 });
      expect(JSON.stringify(entry)).not.toContain("secret");
    } finally {
      write.mockRestore();
      server.close();
    }
  });

  it("ignores TMDB calls made outside a request (warm-up, cron)", () => {
    expect(() => countTmdbCall()).not.toThrow();
  });
});
