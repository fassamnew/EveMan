import { IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateInviteDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;
}
