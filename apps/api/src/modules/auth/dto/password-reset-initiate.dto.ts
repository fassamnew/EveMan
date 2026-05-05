import { IsEmail, MaxLength } from 'class-validator';

export class PasswordResetInitiateDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
