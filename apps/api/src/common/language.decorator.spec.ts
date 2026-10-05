import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
import { CacheFor } from "./cache-control";
import { Language } from "./language.decorator";

@Controller()
class FakeController {
  @Get("cached")
  @CacheFor("catalog")
  cached(@Language() language: string) {
    return { language };
  }

  @Get("private")
  mine(@Language() language: string) {
    return { language };
  }
}

describe("@Language()", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [FakeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(() => app.close());

  const language = async (path: string, acceptLanguage?: string) =>
    ((await (await fetch(`${baseUrl}${path}`, { headers: acceptLanguage ? { "Accept-Language": acceptLanguage } : {} })).json()) as {
      language: string;
    }).language;

  it("takes the language from the URL first", async () => {
    expect(await language("/cached?lang=en", "fr-FR")).toBe("en");
  });

  it("ignores Accept-Language on CDN-cached routes, which the cache key doesn't include", async () => {
    expect(await language("/cached", "en-GB,en;q=0.9")).toBe("fr");
  });

  it("follows Accept-Language on private routes", async () => {
    expect(await language("/private", "en-GB,en;q=0.9")).toBe("en");
  });
});
