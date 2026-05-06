import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunicationTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(['EMAIL', 'SMS'])
  channel!: 'EMAIL' | 'SMS';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
