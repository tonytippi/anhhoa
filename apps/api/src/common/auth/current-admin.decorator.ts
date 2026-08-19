import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Admin } from '@prisma/client';
export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): Admin => context.switchToHttp().getRequest().user);
