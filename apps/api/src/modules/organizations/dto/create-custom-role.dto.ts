import { IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class CreateCustomRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
