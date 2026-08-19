import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateInvoiceTemplateItemDto, InvoiceTemplateItemIdDto, UpdateInvoiceTemplateItemDto } from './invoice-template.dto.js';
import { InvoiceTemplateService } from './invoice-template.service.js';

@Controller('invoice-template')
export class InvoiceTemplateController {
  constructor(private readonly template: InvoiceTemplateService) {}
  @Get() get() { return this.template.get(); }
  @Post('items') create(@Body() body: CreateInvoiceTemplateItemDto) { return this.template.createItem(body); }
  @Patch('items/:id') update(@Param() params: InvoiceTemplateItemIdDto, @Body() body: UpdateInvoiceTemplateItemDto) { return this.template.updateItem(params.id, body); }
  @Delete('items/:id') delete(@Param() params: InvoiceTemplateItemIdDto) { return this.template.deleteItem(params.id); }
  @Post('items/:id/move-up') moveUp(@Param() params: InvoiceTemplateItemIdDto) { return this.template.reorder(params.id, 'up'); }
  @Post('items/:id/move-down') moveDown(@Param() params: InvoiceTemplateItemIdDto) { return this.template.reorder(params.id, 'down'); }
}
