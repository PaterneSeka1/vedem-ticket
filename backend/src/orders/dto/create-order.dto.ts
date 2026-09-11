import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderItemDto } from './create-order-item.dto.js';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  buyerName!: string;

  @IsString()
  @MinLength(6)
  buyerPhone!: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  /** Une ou plusieurs catégories, chacune avec sa propre quantité (voir CLAUDE.md §4). */
  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
