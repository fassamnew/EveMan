import { IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateCustomRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
