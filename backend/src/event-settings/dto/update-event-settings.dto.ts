import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEventSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  location?: string;
}
