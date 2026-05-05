import { IsEmail, IsIn, MaxLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(['ORG_ADMIN', 'ORG_STAFF'])
  roleName!: 'ORG_ADMIN' | 'ORG_STAFF';
}
