import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, Matches } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class ListInvoicesDto {
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/) billingMonth!: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class InvoiceIdDto { @IsUUID() id!: string; }

export class BatchInvoiceDto {
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/) billingMonth!: string;
  @IsBoolean() allActiveClasses!: boolean;
  @ValidateIf((input: BatchInvoiceDto) => !input.allActiveClasses) @IsArray() @ArrayMinSize(1) @IsUUID(undefined, { each: true }) classIds?: string[];
}
