import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { RegistrationResponseDto } from './submit-registration.dto';

export class UpdateRegistrationDto {
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accessPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RegistrationResponseDto)
  responses?: RegistrationResponseDto[];
}
