import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderItemDto } from '../../orders/dto/create-order-item.dto.js';

/**
 * Ticket d'invitation (personnalité) : offert par l'admin, sans paiement —
 * voir CLAUDE.md §4. `buyerPhone` reste optionnel (contrairement à une
 * commande payante) car l'invité n'est pas toujours joignable au moment de
 * la saisie.
 */
export class CreateInvitationDto {
  @IsString()
  @MinLength(1)
  buyerName!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  buyerPhone?: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  /** Une ou plusieurs catégories, chacune avec sa propre quantité. */
  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
