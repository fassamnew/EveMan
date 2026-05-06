import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyQrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  token!: string;
}
