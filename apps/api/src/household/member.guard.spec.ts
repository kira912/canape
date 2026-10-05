import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { MemberGuard } from "./member.guard";
import { hashToken } from "./tokens";

const DAY = 24 * 60 * 60 * 1000;

function setup(session: { lastUsedAt: Date } | null) {
  const prisma = {
    session: {
      findUnique: jest.fn(async (_args: { where: { tokenHash: string } }) =>
        session ? { id: "s1", lastUsedAt: session.lastUsedAt, member: { id: "m1", householdId: "h1" } } : null,
      ),
      update: jest.fn(async (_args: unknown) => undefined),
    },
  };
  return { guard: new MemberGuard(prisma as unknown as PrismaService), prisma };
}

function context(authorization?: string) {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { ctx, request };
}

describe("MemberGuard", () => {
  it("resolves a bearer token to its member and session", async () => {
    const { guard, prisma } = setup({ lastUsedAt: new Date() });
    const { ctx, request } = context("Bearer abc");

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.session.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("abc") });
    expect(request.member).toEqual({ memberId: "m1", householdId: "h1" });
    expect(request.sessionId).toBe("s1");
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it.each([undefined, "abc", "Basic abc", "Bearer "])("refuses a missing or malformed header (%s)", async (header) => {
    const { guard, prisma } = setup({ lastUsedAt: new Date() });

    await expect(guard.canActivate(context(header).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an unknown token", async () => {
    const { guard } = setup(null);

    await expect(guard.canActivate(context("Bearer nope").ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refreshes lastUsedAt at most once a day", async () => {
    const { guard, prisma } = setup({ lastUsedAt: new Date(Date.now() - 2 * DAY) });

    await guard.canActivate(context("Bearer abc").ctx);

    expect(prisma.session.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { lastUsedAt: expect.any(Date) } });
  });
});
