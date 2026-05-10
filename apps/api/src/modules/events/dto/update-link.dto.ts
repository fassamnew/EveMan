import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  linkTypeId?: string | null;

  @IsOptional()
  @IsIn(['PUBLIC', 'UNLISTED', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(['AUTO', 'MANUAL'])
  approvalMode?: 'AUTO' | 'MANUAL';

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;
}
