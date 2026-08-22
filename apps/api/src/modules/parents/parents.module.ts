import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module.js';
import { ParentsController } from './parents.controller.js';
import { ParentsService } from './parents.service.js';

@Module({ imports: [OperationsModule], controllers: [ParentsController], providers: [ParentsService], exports: [ParentsService] })
export class ParentsModule {}
