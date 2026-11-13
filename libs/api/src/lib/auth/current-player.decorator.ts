import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Player } from '@porolympiques/domain';
import type { AuthenticatedRequest } from './session.guard';

/** Le joueur connecté, posé sur la requête par SessionGuard. */
export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Player => ctx.switchToHttp().getRequest<AuthenticatedRequest>().player,
);
