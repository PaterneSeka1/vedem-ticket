import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [OrdersModule, TicketsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
