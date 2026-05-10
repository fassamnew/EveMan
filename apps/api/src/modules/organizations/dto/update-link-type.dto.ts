import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLinkTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
