import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAttendeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
