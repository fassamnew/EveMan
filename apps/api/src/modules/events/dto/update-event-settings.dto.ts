import { IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateEventSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(180)
  eventLogoUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(180)
  eventBannerUrl?: string;

  @IsOptional()
  @IsDateString()
  registrationStartsAt?: string;

  @IsOptional()
  @IsDateString()
  registrationEndsAt?: string;

  @IsOptional()
  @IsIn(['OPEN', 'APPROVED_ONLY', 'ONSITE_ONLY'])
  checkinPolicy?: 'OPEN' | 'APPROVED_ONLY' | 'ONSITE_ONLY';
}
