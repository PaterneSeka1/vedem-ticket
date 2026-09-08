import { IsEmail, IsInt, IsMongoId, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

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

  @IsMongoId()
  ticketCategoryId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}
