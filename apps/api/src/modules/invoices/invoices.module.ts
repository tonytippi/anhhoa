import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { OperationsModule } from '../operations/operations.module.js';

@Module({ imports: [OperationsModule], controllers: [InvoicesController], providers: [InvoicesService] })
export class InvoicesModule {}
