import { createParamDecorator, UnauthorizedException, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedMember {
  memberId: string;
  householdId: string;
}

/**
 * Set by MemberGuard. Fails closed: a route that forgot the guard gets a 401
 * rather than `undefined` ids, which Prisma would read as "no filter".
 */
export const CurrentMember = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedMember => {
  const member = ctx.switchToHttp().getRequest().member as AuthenticatedMember | undefined;
  if (!member?.memberId || !member.householdId) throw new UnauthorizedException("Session manquante");
  return member;
});

/** Id of this device's session (set by MemberGuard), e.g. to sign it out. */
export const CurrentSessionId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const sessionId = ctx.switchToHttp().getRequest().sessionId as string | undefined;
  if (!sessionId) throw new UnauthorizedException("Session manquante");
  return sessionId;
});
