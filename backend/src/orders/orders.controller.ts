import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { AccessOrderDto } from './dto/access-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Public — l'acheteur passe commande sans compte. */
  @ApiOperation({
    summary: 'Créer une commande (public, sans compte)',
    description: "`items` peut porter sur une ou plusieurs catégories différentes, chacune avec sa propre quantité. Calcule `totalAmount` à partir des catégories et vérifie le stock restant de chacune. La commande démarre en statut `pending` — l'acheteur paie ensuite via le lien Wave (`POST /payments/wave/checkout`) et envoie sa capture (`POST /payments/wave/proof/{orderId}`) ; les tickets ne sont générés qu'après confirmation du paiement par l'admin. La réponse contient `accessCode`, le code de téléchargement à remettre à l'acheteur (seule réponse publique qui l'expose), utilisable via `POST /orders/access` une fois la commande payée.",
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

  /**
   * Public — téléchargement des tickets avec le code remis à la création de
   * la commande. POST (et non GET) pour que le code n'apparaisse ni dans les
   * URLs ni dans les logs d'accès.
   */
  @ApiOperation({
    summary: 'Récupérer ses tickets avec son code de téléchargement (public)',
    description:
      "Le code n'est actif qu'une fois la transaction validée par l'admin (commande `paid`). Renvoie la commande et ses `tickets`, chacun avec son `qrCodeDataUrl` (PNG en data URL). Tirets, espaces et casse sont ignorés.",
  })
  @ApiNotFoundResponse({ description: 'Code invalide.' })
  @ApiForbiddenResponse({ description: "Transaction pas encore validée par l'admin." })
  @UseGuards(RateLimit(15, 10 * 60_000))
  @HttpCode(200)
  @Post('access')
  accessByCode(@Body() body: AccessOrderDto) {
    return this.ordersService.accessByCode(body.code);
  }

  /** Admin — commande complète avec tickets (QR codes) et code de téléchargement. */
  @ApiOperation({
    summary: 'Consulter une commande avec ses tickets et son code (admin)',
    description: "Pour réimprimer un ticket ou renvoyer son code de téléchargement au client. `tickets` est vide tant que `status !== 'paid'`.",
  })
  @ApiParam({ name: 'id', description: 'ObjectId de la commande' })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get(':id/tickets')
  getWithTickets(@Param('id') id: string) {
    return this.ordersService.getWithTickets(id);
  }

  /** Public — suivi de la commande par l'acheteur (statut, état du paiement), sans les tickets. */
  @ApiOperation({
    summary: "Suivre l'état d'une commande (public)",
    description:
      "Renvoie la commande et `payment` (`{ method, status }` du dernier paiement, ou `null`). Ne renvoie ni les tickets ni le code de téléchargement : les tickets se récupèrent via `POST /orders/access` avec le code.",
  })
  @ApiParam({ name: 'id', description: 'ObjectId de la commande' })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  @Get(':id')
  getPublicStatus(@Param('id') id: string) {
    return this.ordersService.getPublicStatus(id);
  }

  /**
   * Admin — confirmation manuelle (paiement espèces, ou dépannage) qui
   * déclenche la génération des tickets. Le module Payments appelle le même
   * `OrdersService.markPaid` depuis ses confirmations Wave et espèces ;
   * cette route reste l'outil manuel du dashboard
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
