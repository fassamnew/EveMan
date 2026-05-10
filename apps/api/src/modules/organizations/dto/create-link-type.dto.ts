import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLinkTypeDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
