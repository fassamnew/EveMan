import { IsArray, IsIn, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ImportRowDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class CreateImportJobDto {
  @IsString()
  @MinLength(1)
  sourceFilename!: string;

  @IsIn(['CSV', 'XLSX'])
  sourceFileType!: 'CSV' | 'XLSX';

  @IsIn(['SKIP', 'UPDATE', 'FLAG'])
  duplicateStrategy!: 'SKIP' | 'UPDATE' | 'FLAG';

  @IsObject()
  mappingProfile!: {
    fullName: string;
    email: string;
  };

  @IsString()
  @MinLength(1)
  eventId!: string;

  @IsString()
  @MinLength(1)
  registrationLinkId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows?: ImportRowDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  fileContentBase64?: string;
}
