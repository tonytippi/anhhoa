import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { StudentStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ListStudentsDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateStudentDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) fullName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) nickname?: string | null;
}

export class UpdateStudentDto extends CreateStudentDto {
  @IsOptional() @Transform(({ value }) => value === null ? value : value) @IsUUID() classId?: string | null;
}
export class StudentIdDto { @IsUUID() id!: string; }
