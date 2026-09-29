import { Controller, Get, NotFoundException, Put, type INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
import { CACHE_PROFILES, CacheControlInterceptor, CacheFor, noStoreByDefault } from "./cache-control";

@Controller()
class FakeController {
  @Get("public")
  @CacheFor("catalog")
  ok() {
    return { ok: true };
  }

  @Get("public-broken")
  @CacheFor("catalog")
  broken() {
    throw new NotFoundException();
  }

  @Get("private")
  mine() {
    return { mine: true };
  }

  @Put("public")
  @CacheFor("catalog")
  write() {
    return { written: true };
  }
}

describe("HTTP cache headers", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [FakeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(noStoreByDefault);
    app.useGlobalInterceptors(new CacheControlInterceptor(app.get(Reflector)));
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(() => app.close());

  const cacheControl = async (path: string, method = "GET") =>
    (await fetch(`${baseUrl}${path}`, { method })).headers.get("cache-control");

  it("lets the CDN cache successful public GETs", async () => {
    expect(await cacheControl("/public")).toBe(CACHE_PROFILES.catalog);
  });

  it("never caches errors, even on public routes", async () => {
    expect(await cacheControl("/public-broken")).toBe("private, no-store");
  });

  it("keeps routes without a profile private", async () => {
    expect(await cacheControl("/private")).toBe("private, no-store");
  });

  it("never caches writes", async () => {
    expect(await cacheControl("/public", "PUT")).toBe("private, no-store");
  });
});
