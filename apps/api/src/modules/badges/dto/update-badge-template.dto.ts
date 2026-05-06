import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateBadgeTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
