import { Module } from '@nestjs/common';
import { InvoiceTemplateController } from './invoice-template.controller.js';
import { InvoiceTemplateService } from './invoice-template.service.js';

@Module({ controllers: [InvoiceTemplateController], providers: [InvoiceTemplateService] })
export class InvoiceTemplateModule {}
