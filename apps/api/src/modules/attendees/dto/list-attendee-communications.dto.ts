import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListAttendeeCommunicationsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(['EMAIL', 'SMS'])
  channel?: 'EMAIL' | 'SMS';

  @IsOptional()
  @IsIn(['QUEUED', 'SENT', 'FAILED'])
  status?: 'QUEUED' | 'SENT' | 'FAILED';
}
