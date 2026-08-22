import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsUUID, ValidateNested } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

export class StudentIdDto { @IsUUID() id!: string; }
export class ParentIdDto { @IsUUID() parentId!: string; }

class GrantParentDto {
  @Transform(normalizeEmail) @IsEmail() email!: string;
}

export class GrantParentsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => GrantParentDto) parents!: GrantParentDto[];
}
