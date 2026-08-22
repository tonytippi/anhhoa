import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Parent } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator.js';
import { ParentSessionGuard } from '../parent-auth/parent-session.guard.js';
import { ListParentInvoicesDto, ParentInvoiceIdDto } from './parent-portal.dto.js';
import { ParentPortalService } from './parent-portal.service.js';

@Public()
@Controller('parent')
@UseGuards(ParentSessionGuard)
export class ParentPortalController {
  constructor(private readonly portal: ParentPortalService) {}
  @Get('students') students(@Req() request: Request) { return this.portal.students((request.user as Parent).id); }
  @Get('invoices') invoices(@Req() request: Request, @Query() query: ListParentInvoicesDto) { return this.portal.invoices((request.user as Parent).id, query); }
  @Get('invoices/:invoiceId') invoice(@Req() request: Request, @Param() params: ParentInvoiceIdDto) { return this.portal.invoice((request.user as Parent).id, params.invoiceId); }
}
