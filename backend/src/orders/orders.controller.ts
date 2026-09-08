import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Public — l'acheteur passe commande sans compte. */
  @UseGuards(RateLimit(20, 60_000))
  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body);
  }

  /** Admin — suivi des commandes (dashboard). */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  /** Public — l'acheteur consulte sa commande et récupère ses tickets (QR codes) une fois payée. */
  @Get(':id')
  getWithTickets(@Param('id') id: string) {
    return this.ordersService.getWithTickets(id);
  }

  /**
   * Admin — confirmation manuelle (paiement espèces, ou dépannage) qui
   * déclenche la génération des tickets. Le module Payments appelle le même
   * `OrdersService.markPaid` depuis le webhook Wave et depuis sa propre
   * confirmation espèces ; cette route reste l'outil manuel du dashboard
   * prévu par CLAUDE.md §7.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.ordersService.markPaid(id);
  }
}
