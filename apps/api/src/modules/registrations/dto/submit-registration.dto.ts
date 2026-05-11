import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class RegistrationResponseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  key!: string;

  @IsDefined()
  value!: unknown;
}

export class SubmitRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsBoolean()
  consentAccepted!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  consentPolicyVersion!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  captchaToken!: string;

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

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RegistrationResponseDto)
  responses!: RegistrationResponseDto[];
}
