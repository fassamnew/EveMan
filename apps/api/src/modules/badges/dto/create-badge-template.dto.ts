import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBadgeTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsObject()
  configJson!: Record<string, unknown>;
}
