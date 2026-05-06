import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBulkSendDto {
  @IsString()
  @MinLength(1)
  templateId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeIds?: string[];
}
