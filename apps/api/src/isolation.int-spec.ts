import { NotFoundException, type INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";

/**
 * Household isolation and data-erasure rules, end to end: real HTTP, real
 * guards, real Postgres constraints and cascades. Only TMDB is faked.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const run = /test/i.test(new URL(TEST_DATABASE_URL || "postgres://x/none").pathname) ? describe : describe.skip;

const fakeTmdb = {
  get: async (path: string) => {
    if (path.startsWith("/discover/")) return { page: 1, total_pages: 1, results: [{ id: 1 }, { id: 2 }] };
    const match = /^\/(movie|tv)\/(\d+)$/.exec(path);
    if (!match || match[2] === "999") throw new NotFoundException();
    return { id: Number(match[2]), title: `Title ${match[2]}`, genres: [], "watch/providers": { results: {} } };
  },
};

run("household isolation (Postgres)", () => {
  let app: INestApplication;
  let base: string;
  let prisma: import("@prisma/client").PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.DIRECT_URL = TEST_DATABASE_URL;
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "ignore" });
    const { AppModule } = await import("./app.module");
    const { configureApp } = await import("./app-setup");
    const { TmdbClient } = await import("./tmdb/tmdb.client");
    const { PrismaService } = await import("./prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TmdbClient)
      .useValue(fakeTmdb)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app as NestExpressApplication);
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE "Household", "Session", "DevicePairing", "RateLimit" CASCADE');
    jest.spyOn(process.stdout, "write").mockImplementation(() => true); // request logs
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const createHousehold = async (memberName: string) =>
    (await call("POST", "/households", undefined, { memberName, color: "#6FCF97", providerIds: [8] })).body as {
      token: string;
      memberId: string;
      household: { id: string; inviteCode: string };
    };

  it("keeps every household's data to itself", async () => {
    const alice = await createHousehold("Alice");
    const bob = await createHousehold("Bob");

    expect((await call("PUT", "/favorites/household/movie/550", alice.token)).status).toBe(204);
    expect((await call("PUT", "/favorites/me/movie/551", alice.token)).status).toBe(204);
    expect((await call("PUT", `/watched/movie/550/${alice.memberId}`, alice.token)).status).toBe(204);

    // Bob sees nothing of Alice's household…
    const bobFavorites = await call("GET", "/favorites", bob.token);
    expect(bobFavorites.body).toEqual({ household: [], mine: [] });
    expect((await call("GET", "/watched", bob.token)).body).toEqual({ items: [] });
    expect((await call("GET", "/household", bob.token)).body.household.id).toBe(bob.household.id);

    // …can't write on her behalf…
    expect((await call("PUT", `/watched/movie/1/${alice.memberId}`, bob.token)).status).toBe(404);
    // …and can't delete her data: these are no-ops scoped to his own household.
    await call("DELETE", `/watched/movie/550/${alice.memberId}`, bob.token);
    await call("DELETE", "/favorites/household/movie/550", bob.token);
    expect((await call("GET", "/watched", alice.token)).body.items).toHaveLength(1);
    expect((await call("GET", "/favorites", alice.token)).body.household).toHaveLength(1);

    // Match evenings are per household.
    expect((await call("POST", "/match/sessions", alice.token, { mediaType: "movie", genres: [] })).status).toBe(201);
    expect((await call("GET", "/match", bob.token)).body.session).toBeNull();
    expect((await call("POST", "/match/votes", bob.token, { mediaType: "movie", tmdbId: 1, liked: true })).status).toBe(404);
  });

  it("never opens an existing profile with the invite code", async () => {
    const alice = await createHousehold("Carla");
    const join = await call("POST", "/households/join", undefined, {
      inviteCode: alice.household.inviteCode,
      memberName: "CARLA",
      color: "#6FCF97",
    });
    expect(join.status).toBe(409);

    const dan = await call("POST", "/households/join", undefined, {
      inviteCode: alice.household.inviteCode,
      memberName: "Dan",
      color: "#6FCF97",
    });
    expect(dan.status).toBe(200);
    expect(dan.body.memberId).not.toBe(alice.memberId);
    // Renaming into an existing name, whatever the case, is refused too.
    expect((await call("PUT", "/household/member", dan.body.token, { name: "carla" })).status).toBe(409);
  });

  it("erases a member's data and the household with its last member", async () => {
    const eve = await createHousehold("Eve");
    const frank = (
      await call("POST", "/households/join", undefined, { inviteCode: eve.household.inviteCode, memberName: "Frank", color: "#6FCF97" })
    ).body as { token: string; memberId: string };
    await call("PUT", "/favorites/household/movie/10", frank.token);
    await call("PUT", "/favorites/me/movie/11", frank.token);
    await call("PUT", `/watched/movie/10/${frank.memberId}`, eve.token);

    expect((await call("DELETE", "/household/member", frank.token)).status).toBe(204);
    expect((await call("GET", "/household", frank.token)).status).toBe(401);
    expect(await prisma.favorite.count({ where: { householdId: eve.household.id } })).toBe(0);
    expect(await prisma.watched.count({ where: { householdId: eve.household.id } })).toBe(0);
    expect(await prisma.household.count({ where: { id: eve.household.id } })).toBe(1);

    expect((await call("DELETE", "/household/member", eve.token)).status).toBe(204);
    expect(await prisma.household.count({ where: { id: eve.household.id } })).toBe(0);
  });

  it("signs a device in by QR only with the code shown on it, once", async () => {
    const gina = await createHousehold("Gina");
    const pairing = (await call("POST", "/pairings")).body as { id: string; secret: string; verificationCode: string };
    const wrong = String(((Number(pairing.verificationCode) - 9) % 90) + 10);

    expect((await call("POST", `/pairings/${pairing.id}/approve`, gina.token, { verificationCode: wrong })).status).toBe(403);
    // Cancelled: the right code no longer works either, and the new device is told to start over.
    expect(
      (await call("POST", `/pairings/${pairing.id}/approve`, gina.token, { verificationCode: pairing.verificationCode })).status,
    ).toBe(410);
    expect((await call("POST", `/pairings/${pairing.id}/claim`, undefined, { secret: pairing.secret })).status).toBe(410);

    const second = (await call("POST", "/pairings")).body as { id: string; secret: string; verificationCode: string };
    await call("POST", `/pairings/${second.id}/approve`, gina.token, { verificationCode: second.verificationCode });
    const claimed = await call("POST", `/pairings/${second.id}/claim`, undefined, { secret: second.secret });
    expect(claimed.body.session.memberId).toBe(gina.memberId);
    expect((await call("POST", `/pairings/${second.id}/claim`, undefined, { secret: second.secret })).status).toBe(410);
  });

  it("rate-limits invite code guessing per IP", async () => {
    await prisma.rateLimit.deleteMany();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call("POST", "/households/join", undefined, { inviteCode: "ZZZZZZ", memberName: "x", color: "#6FCF97" })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
