import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type { Admin } from '@prisma/client';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator.js';
import { BatchInvoiceDto, InvoiceIdDto, ListInvoicesDto } from './invoices.dto.js';
import { InvoicesService } from './invoices.service.js';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Get() list(@Query() query: ListInvoicesDto) { return this.invoices.list(query); }
  @Post('batch-preview') preview(@Body() input: BatchInvoiceDto) { return this.invoices.preview(input); }
  @Post('batch') create(@Body() input: BatchInvoiceDto, @Headers('idempotency-key') operationId: string | undefined, @CurrentAdmin() admin: Admin) {
    if (!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) throw new BadRequestException('Idempotency-Key must be a UUID.');
    return this.invoices.createBatch(input, operationId, admin.id);
  }
  @Get(':id') get(@Param() params: InvoiceIdDto) { return this.invoices.get(params.id); }
}
