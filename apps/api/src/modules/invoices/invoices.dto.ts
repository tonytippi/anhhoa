import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested, Matches } from 'class-validator';
import { InvoicePaymentMethod, InvoiceStatus } from '@prisma/client';

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

export class UpdateInvoiceItemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @IsNotEmpty() @MaxLength(300) description!: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(120) feeGroup?: string;
  @IsInt() @Min(-100_000_000) @Max(100_000_000) amount!: number;
}

export class UpdateInvoiceDto {
  @IsArray() @ArrayMinSize(1) @Transform(({ value }) => Array.isArray(value) ? value.map((item) => Object.assign(new UpdateInvoiceItemDto(), item)) : value) @ValidateNested({ each: true }) items!: UpdateInvoiceItemDto[];
  @IsEnum(InvoicePaymentMethod) paymentMethod!: InvoicePaymentMethod;
  @ValidateIf((input: UpdateInvoiceDto) => input.paymentMethod === InvoicePaymentMethod.TRANSFER) @IsDefined() @IsUUID() bankAccountId?: string;
}
