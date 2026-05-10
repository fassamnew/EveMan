import { IsEmail, IsIn, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsIn(['ORG_ADMIN', 'ORG_STAFF'])
  roleName?: 'ORG_ADMIN' | 'ORG_STAFF';

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

