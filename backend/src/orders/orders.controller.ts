import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Public — l'acheteur passe commande sans compte. */
  @ApiOperation({
    summary: 'Créer une commande (public, sans compte)',
    description: "Calcule `totalAmount` à partir de la catégorie et vérifie le stock restant. La commande démarre en statut `pending` — il faut ensuite `POST /payments/wave/checkout` ou attendre la confirmation espèces de l'admin pour que les tickets soient générés.",
  })
  @ApiBadRequestResponse({ description: 'Quantité invalide, catégorie inconnue ou stock insuffisant.' })
  @UseGuards(RateLimit(20, 60_000))
  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body);
  }

  /** Admin — suivi des commandes (dashboard). */
  @ApiOperation({ summary: 'Lister toutes les commandes (admin)' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  /** Public — l'acheteur consulte sa commande et récupère ses tickets (QR codes) une fois payée. */
  @ApiOperation({
    summary: 'Consulter une commande et ses tickets (public)',
    description: "Renvoie la commande avec son tableau `tickets` imbriqué, vide tant que `status !== 'paid'`. Une fois payée, chaque ticket inclut son `qrCodeDataUrl` (PNG en data URL, prêt pour un `<img src>`).",
  })
  @ApiParam({ name: 'id', description: 'ObjectId de la commande' })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
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
  @ApiOperation({
    summary: 'Forcer une commande à `paid` et générer ses tickets (admin)',
    description: "Outil manuel de dépannage — pour confirmer un paiement espèces avec la traçabilité complète, préférer `POST /payments/cash/{orderId}`. Idempotent.",
  })
  @ApiParam({ name: 'id', description: 'ObjectId de la commande' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.ordersService.markPaid(id);
  }
}
