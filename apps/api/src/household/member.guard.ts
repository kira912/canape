import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedMember } from "./current-member";
import { hashToken } from "./tokens";

/** `lastUsedAt` drives the inactivity purge (RetentionService): a day's precision is enough. */
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Resolves `Authorization: Bearer <session token>` to the member of a household. */
@Injectable()
export class MemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token) throw new UnauthorizedException("Session manquante");

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, lastUsedAt: true, member: { select: { id: true, householdId: true } } },
    });
    if (!session) throw new UnauthorizedException("Session inconnue");
    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    }

    request.member = {
      memberId: session.member.id,
      householdId: session.member.householdId,
    } satisfies AuthenticatedMember;
    request.sessionId = session.id;
    return true;
  }
}
