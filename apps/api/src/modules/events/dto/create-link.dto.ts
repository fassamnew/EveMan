import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @IsUUID()
  linkTypeId?: string;

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
