import { IsEmail, IsOptional, IsString, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ResponseUpdateDto {
  @IsString()
  fieldKey!: string;

  @IsString()
  value!: string;
}

export class UpdateAttendeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResponseUpdateDto)
  responses?: ResponseUpdateDto[];
}
