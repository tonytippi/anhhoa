import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

const parentInvoiceStatuses = [InvoiceStatus.PENDING, InvoiceStatus.COMPLETED] as const;

export class ListParentInvoicesDto {
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/) billingMonth?: string;
  @IsOptional() @IsEnum(parentInvoiceStatuses) status?: (typeof parentInvoiceStatuses)[number];
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class ParentInvoiceIdDto { @IsUUID() invoiceId!: string; }
