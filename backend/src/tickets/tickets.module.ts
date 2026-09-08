import { Module } from '@nestjs/common';
import { TicketCategoriesController } from './ticket-categories.controller.js';
import { TicketCategoriesService } from './ticket-categories.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketCategoriesController, TicketsController],
  providers: [TicketCategoriesService, TicketsService],
  exports: [TicketCategoriesService, TicketsService],
})
export class TicketsModule {}
