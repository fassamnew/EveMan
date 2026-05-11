import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLinkSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  confirmationMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  emailTemplateName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  registrationInstructions?: string;

  @IsOptional()
  @IsIn(['REQUIRED', 'OPTIONAL', 'DISABLED'])
  photoUpload?: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';

  @IsOptional()
  @IsIn(['PUBLIC', 'INVITE_ONLY', 'PASSWORD_PROTECTED'])
  accessMode?: 'PUBLIC' | 'INVITE_ONLY' | 'PASSWORD_PROTECTED';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accessPassword?: string;

  @IsOptional()
  @IsBoolean()
  allowRegistrantUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  smsDeliveryEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  smsTemplateName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  smsRecipientFieldKey?: string;

  @IsOptional()
  @IsIn([
    'CONFERENCE',
    'EXHIBITION',
    'VIP_INVITATION',
    'MEDIA_ACCREDITATION',
    'SPEAKER_REGISTRATION',
    'WORKSHOP_TRAINING'
  ])
  pageTemplate?:
    | 'CONFERENCE'
    | 'EXHIBITION'
    | 'VIP_INVITATION'
    | 'MEDIA_ACCREDITATION'
    | 'SPEAKER_REGISTRATION'
    | 'WORKSHOP_TRAINING';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageBannerImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pageBackgroundColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pageButtonColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pageFontFamily?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pageEventDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sponsorLogoUrls?: string[];

  @IsOptional()
  @IsIn(['SINGLE_COLUMN', 'TWO_COLUMN'])
  formLayout?: 'SINGLE_COLUMN' | 'TWO_COLUMN';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  footerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privacyNotice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  termsAndConditions?: string;
}
