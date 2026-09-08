import { IsMongoId } from 'class-validator';

export class CreateWaveCheckoutDto {
  @IsMongoId()
  orderId!: string;
}
