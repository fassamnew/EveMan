import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCheckinDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsOptional()
  @IsIn(['MOBILE_ONLINE', 'OFFLINE_SYNC'])
  source?: 'MOBILE_ONLINE' | 'OFFLINE_SYNC';

  @IsOptional()
  @IsString()
  scannedAt?: string;
}
