import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { BankAccountStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ListBankAccountsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(BankAccountStatus) status?: BankAccountStatus;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateBankAccountDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50) bankCode!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50) accountNumber!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150) accountHolderName!: string;
}

export class BankAccountIdDto { @IsUUID() id!: string; }
