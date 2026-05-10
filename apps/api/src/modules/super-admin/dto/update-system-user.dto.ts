import { IsBoolean } from 'class-validator';

export class UpdateSystemUserDto {
  @IsBoolean()
  isActive!: boolean;
}
