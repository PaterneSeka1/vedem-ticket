import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateTicketCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  // 0 accepté uniquement pour une catégorie `invitationOnly` (contrôlé dans le service).
  @Min(0)
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

  /** Réservée aux invitations (ex. VVIP) : masquée du public, refusée à l'achat. */
  @IsOptional()
  @IsBoolean()
  invitationOnly?: boolean;
}
