import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkInviteUsersDto {
  @IsString()
  @MaxLength(200000)
  csvContent!: string;

  @IsOptional()
  @IsIn(['ORG_ADMIN', 'ORG_STAFF'])
  defaultRoleName?: 'ORG_ADMIN' | 'ORG_STAFF';
}
