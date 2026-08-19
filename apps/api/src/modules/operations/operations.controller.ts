import { Controller, Get, Param } from '@nestjs/common';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator.js';
import type { Admin } from '@prisma/client';
import { OperationsService } from './operations.service.js';
import { OperationIdDto } from './operations.dto.js';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get(':id') get(@Param() params: OperationIdDto, @CurrentAdmin() admin: Admin) { return this.operations.getForAdmin(params.id, admin.id); }
}
