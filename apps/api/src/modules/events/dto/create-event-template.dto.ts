import { IsString, MaxLength } from 'class-validator';

export class CreateEventTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(160)
  eventName!: string;
}
