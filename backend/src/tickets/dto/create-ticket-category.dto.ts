import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateTicketCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  /** Frais Wave (1 %) à la charge de l'acheteur, ajoutés au paiement Wave uniquement. */
  @IsOptional()
  @IsBoolean()
  chargeWaveFees?: boolean;
}
