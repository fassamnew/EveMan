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
  @IsIn(['MOBILE_ONLINE', 'OFFLINE_SYNC', 'MOBILE_OFFLINE'])
  source?: 'MOBILE_ONLINE' | 'OFFLINE_SYNC' | 'MOBILE_OFFLINE';

  @IsOptional()
  @IsString()
  @MinLength(1)
  selectedEventId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  accessZone?: string;

  @IsOptional()
  @IsString()
  scannedAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entrance?: string; // Checkpoint/entrance identifier (e.g., "Main Gate", "VIP Entrance")
}
