import { IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class UpdateTicketCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  stock?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}
