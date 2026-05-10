import { IsObject } from 'class-validator';

export class UpdateJsonSettingDto {
  @IsObject()
  value!: Record<string, unknown>;
}
