import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchAttendeesDto {
  @IsString()
  @MinLength(2)
  q!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  eventId?: string;
}
