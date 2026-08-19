import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Validate, type ValidationArguments, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { InvoiceTemplateAmountSource } from '@prisma/client';

@ValidatorConstraint({ name: 'fixedAmountCompatible', async: false })
class FixedAmountCompatibleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const item = args.object as CreateInvoiceTemplateItemDto;
    return item.amountSource === InvoiceTemplateAmountSource.CLASS_TUITION ? value === undefined : Number.isSafeInteger(value) && (value as number) >= 0;
  }
  defaultMessage(args: ValidationArguments): string { return (args.object as CreateInvoiceTemplateItemDto).amountSource === InvoiceTemplateAmountSource.CLASS_TUITION ? 'fixedAmount must not be provided when amountSource is CLASS_TUITION' : 'fixedAmount must be a non-negative safe integer for FIXED'; }
}

export class CreateInvoiceTemplateItemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @IsNotEmpty() @MaxLength(200) description!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value) @IsOptional() @IsString() @MaxLength(100) feeGroup?: string;
  @IsEnum(InvoiceTemplateAmountSource) amountSource!: InvoiceTemplateAmountSource;
  @Validate(FixedAmountCompatibleConstraint) fixedAmount?: number;
}

export class UpdateInvoiceTemplateItemDto extends CreateInvoiceTemplateItemDto {}
export class InvoiceTemplateItemIdDto { @IsUUID() id!: string; }
