import { IsInt, IsMongoId, IsPositive } from 'class-validator';

export class CreateOrderItemDto {
  @IsMongoId()
  ticketCategoryId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}
