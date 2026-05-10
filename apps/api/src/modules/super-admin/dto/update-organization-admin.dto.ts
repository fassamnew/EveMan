import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateOrganizationAdminDto {
  @IsOptional()
  @IsString()
  @Length(3, 120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9-]+$/)
  code?: string;
}
