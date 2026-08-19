import { Controller, Get, Param, Query } from '@nestjs/common';
import { InvoiceIdDto, ListInvoicesDto } from './invoices.dto.js';
import { InvoicesService } from './invoices.service.js';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Get() list(@Query() query: ListInvoicesDto) { return this.invoices.list(query); }
  @Get(':id') get(@Param() params: InvoiceIdDto) { return this.invoices.get(params.id); }
}
