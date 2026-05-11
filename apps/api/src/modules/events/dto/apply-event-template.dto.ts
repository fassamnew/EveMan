import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyEventTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}
