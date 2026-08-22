import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { Admin } from '@prisma/client';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator.js';
import { GrantParentsDto, ParentIdDto, StudentIdDto } from './parents.dto.js';
import { ParentsService } from './parents.service.js';

function operationKey(key: string | undefined): string {
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('Idempotency-Key must be a UUID.');
  return key;
}

@Controller('students/:id/parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get() list(@Param() params: StudentIdDto) { return this.parents.list(params.id); }

  @Post('grant')
  grant(@Param() params: StudentIdDto, @Body() body: GrantParentsDto, @Headers('idempotency-key') key: string | undefined, @CurrentAdmin() admin: Admin) {
    return this.parents.grantBatch(params.id, body.parents.map((parent) => parent.email), operationKey(key), admin.id);
  }

  @Post(':parentId/revoke')
  revoke(@Param() params: StudentIdDto, @Param() parent: ParentIdDto, @Headers('idempotency-key') key: string | undefined, @CurrentAdmin() admin: Admin) {
    return this.parents.revokeWithOperation(params.id, parent.parentId, operationKey(key), admin.id);
  }
}
