import { IsUUID } from 'class-validator';

export class OperationIdDto { @IsUUID() id!: string; }
