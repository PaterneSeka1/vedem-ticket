import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateTicketCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  // 0 accepté uniquement pour une catégorie `invitationOnly` (contrôlé dans le service).
  @Min(0)
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

  /** Frais Wave (1 %) à la charge de l'acheteur, ajoutés au paiement Wave uniquement. */
  @IsOptional()
  @IsBoolean()
  chargeWaveFees?: boolean;

  /** Réservée aux invitations (ex. VVIP) : masquée du public, refusée à l'achat. */
  @IsOptional()
  @IsBoolean()
  invitationOnly?: boolean;
}
