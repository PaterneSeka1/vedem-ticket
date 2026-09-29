import { IsString, MaxLength, MinLength } from 'class-validator';

export class AccessOrderDto {
  /** Code de téléchargement remis à la création de la commande (tirets/espaces/casse ignorés). */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;
}
