import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedMember {
  memberId: string;
  householdId: string;
}

export const CurrentMember = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedMember => ctx.switchToHttp().getRequest().member,
);
