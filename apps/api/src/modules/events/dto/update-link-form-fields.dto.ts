import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

const FORM_FIELD_TYPES = ['TEXT', 'TEXTAREA', 'EMAIL', 'NUMBER', 'SELECT', 'CHECKBOX', 'DATE', 'RADIO_BUTTON', 'FILE_UPLOAD', 'PHOTO_UPLOAD'] as const;

export class LinkFormFieldInputDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/)
  key!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsIn(FORM_FIELD_TYPES)
  type!: (typeof FORM_FIELD_TYPES)[number];

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pattern?: string;

  @IsOptional()
  @IsDateString()
  minDate?: string;

  @IsOptional()
  @IsDateString()
  maxDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  allowedFileTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1024)
  maxFileSize?: number;
}

export class UpdateLinkFormFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkFormFieldInputDto)
  fields!: LinkFormFieldInputDto[];
}
