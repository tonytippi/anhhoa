import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller.js';
import { ClassesService } from './classes.service.js';
import { OperationsModule } from '../operations/operations.module.js';

@Module({ imports: [OperationsModule], controllers: [ClassesController], providers: [ClassesService] })
export class ClassesModule {}
