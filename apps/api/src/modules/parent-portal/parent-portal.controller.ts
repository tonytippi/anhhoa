import { Controller, Get, Header, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Parent } from '@prisma/client';
import type { Request, Response } from 'express';
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
  @Get('invoices/:invoiceId/payment')
  @Header('Cache-Control', 'no-store')
  @Header('Vary', 'Accept')
  async payment(@Req() request: Request, @Param() params: ParentInvoiceIdDto, @Res({ passthrough: true }) response: Response) {
    if (request.get('accept')?.split(',').some((value) => value.trim().split(';', 1)[0]!.toLowerCase() === 'image/png')) {
      const png = await this.portal.paymentPng((request.user as Parent).id, params.invoiceId);
      response.type('png').attachment(`anh-hoa-${params.invoiceId}.png`);
      return png;
    }
    const payment = await this.portal.payment((request.user as Parent).id, params.invoiceId);
    return payment;
  }
  @Get('invoices/:invoiceId') invoice(@Req() request: Request, @Param() params: ParentInvoiceIdDto) { return this.portal.invoice((request.user as Parent).id, params.invoiceId); }
}
