import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import type { Admin } from '@prisma/client';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator.js';
import { ClassesService } from './classes.service.js';
import { ClassIdDto, CreateClassDto, ListClassesDto, TransferClassDto, UpdateClassDto } from './classes.dto.js';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}
  @Get() list(@Query() query: ListClassesDto) { return this.classes.list(query); }
  @Get(':id') get(@Param() params: ClassIdDto) { return this.classes.get(params.id); }
  @Post() create(@Body() body: CreateClassDto) { return this.classes.create(body); }
  @Patch(':id') update(@Param() params: ClassIdDto, @Body() body: UpdateClassDto) { return this.classes.update(params.id, body); }
  @Post(':id/archive') archive(@Param() params: ClassIdDto) { return this.classes.archive(params.id); }
  @Post(':id/transfer') transfer(@Param() params: ClassIdDto, @Body() body: TransferClassDto, @Headers('idempotency-key') key: string | undefined, @CurrentAdmin() admin: Admin) {
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('Idempotency-Key must be a UUID.');
    return this.classes.transfer(params.id, body.destinationClassId, key, admin.id);
  }
}
