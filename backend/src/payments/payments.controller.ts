import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedAdmin } from '../auth/jwt.strategy.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWaveCheckoutDto } from './dto/create-wave-checkout.dto.js';
import { SimulateWaveOutcomeDto } from './dto/simulate-wave-outcome.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Admin — suivi des paiements (dashboard). */
  @ApiOperation({ summary: 'Lister tous les paiements (admin)' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  /** Public — l'acheteur démarre un paiement Wave pour sa commande. */
  @ApiOperation({
    summary: 'Démarrer un paiement Wave (public)',
    description: "Crée une session de checkout Wave pour une commande `pending` et renvoie `checkoutUrl` : rediriger l'acheteur vers cette URL. La commande passe à `paid` de façon asynchrone, via le webhook Wave, une fois le paiement confirmé — pas immédiatement en retour de cet appel.",
  })
  @UseGuards(RateLimit(20, 60_000))
  @Post('wave/checkout')
  initiateWaveCheckout(@Body() body: CreateWaveCheckoutDto) {
    return this.paymentsService.initiateWaveCheckout(body.orderId);
  }

  /**
   * Webhook Wave (appelé par Wave, pas par le front). Le corps doit rester
   * BRUT (voir `main.ts` — route montée avec `express.raw()`) pour que la
   * vérification de signature HMAC porte sur les octets exacts envoyés par
   * Wave, avant tout re-sérialisation JSON. Pas de rate-limit ni de
   * ValidationPipe ici : c'est Wave qui appelle, pas un DTO de notre API.
   */
  @ApiExcludeEndpoint() // appelé par Wave, pas par le frontend — hors périmètre de cette doc.
  @Post('wave/webhook')
  @HttpCode(200)
  async waveWebhook(@Req() req: Request, @Headers('wave-signature') signature?: string) {
    const rawBody = req.body as unknown as Buffer;
    this.paymentsService.verifyWebhookRequest(signature, rawBody);

    let event: unknown;
    try {
      event = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      throw new BadRequestException('Corps du webhook invalide (JSON attendu)');
    }
    return this.paymentsService.handleWaveEvent(event as Parameters<PaymentsService['handleWaveEvent']>[0]);
  }

  /**
   * Dev uniquement — simule le résultat d'un paiement Wave sans appeler la
   * vraie API Wave, pour tester tout le parcours en local avant d'avoir des
   * identifiants marchand (voir backend/.env.example — `WAVE_SIMULATE`).
   * Inexistante (404) si `WAVE_SIMULATE` n'est pas activé.
   */
  @ApiOperation({
    summary: 'Simuler un paiement Wave (dev uniquement)',
    description:
      "Rejoue localement l'événement que Wave enverrait par webhook, sans vérifier de signature. " +
      "Actif uniquement si WAVE_SIMULATE=1 côté serveur (404 sinon) — jamais destiné à la production.",
  })
  @UseGuards(RateLimit(20, 60_000))
  @Post('wave/simulate/:paymentId')
  simulateWavePayment(@Param('paymentId') paymentId: string, @Body() body: SimulateWaveOutcomeDto) {
    return this.paymentsService.simulateWaveOutcome(paymentId, body.outcome);
  }

  /** Admin — confirmation manuelle d'un paiement espèces. */
  @ApiOperation({
    summary: 'Confirmer un paiement espèces (admin)',
    description: 'Enregistre le paiement, passe la commande à `paid` et génère ses tickets. Idempotent.',
  })
  @ApiParam({ name: 'orderId', description: 'ObjectId de la commande' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('cash/:orderId')
  confirmCashPayment(@Param('orderId') orderId: string, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.paymentsService.confirmCashPayment(orderId, admin.userId);
  }

  /**
   * Admin — ticket d'invitation (personnalité), offert sans paiement.
   * Contrairement au flux espèces, il n'y a pas de commande existante :
   * l'admin saisit directement les informations de l'invité et les
   * catégories/quantités souhaitées.
   */
  @ApiOperation({
    summary: "Créer un ticket d'invitation (admin)",
    description:
      "Crée la commande et génère directement ses tickets, sans paiement réel : `totalAmount` reste à 0. " +
      "Ignore le stock de chaque catégorie (une invitation ne doit pas être bloquée par une catégorie épuisée) " +
      'et ces commandes ne comptent pas dans le stock vu par les acheteurs payants.',
  })
  @ApiBadRequestResponse({ description: 'Quantité invalide ou catégorie inconnue.' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Post('invitation')
  createInvitation(@Body() body: CreateInvitationDto, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.paymentsService.createInvitation(body, admin.userId);
  }
}
