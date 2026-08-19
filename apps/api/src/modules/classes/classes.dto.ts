import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ClassStatus } from '@prisma/client';

export class ListClassesDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(ClassStatus) status?: ClassStatus;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateClassDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) monthlyTuition!: number;
}

export class UpdateClassDto extends CreateClassDto {}

export class ClassIdDto { @IsUUID() id!: string; }
