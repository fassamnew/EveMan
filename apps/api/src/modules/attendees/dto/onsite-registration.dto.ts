import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class OnsiteResponseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fieldKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  value!: string;
}

export class OnsiteRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(50)
  @Type(() => OnsiteResponseDto)
  responses?: OnsiteResponseDto[];
}
