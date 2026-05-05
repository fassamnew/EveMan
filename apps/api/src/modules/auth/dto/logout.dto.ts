import { IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsString()
  @MaxLength(4096)
  refreshToken!: string;
}
