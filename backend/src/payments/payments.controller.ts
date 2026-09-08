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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedAdmin } from '../auth/jwt.strategy.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { CreateWaveCheckoutDto } from './dto/create-wave-checkout.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Admin — suivi des paiements (dashboard). */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  /** Public — l'acheteur démarre un paiement Wave pour sa commande. */
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

  /** Admin — confirmation manuelle d'un paiement espèces. */
  @UseGuards(JwtAuthGuard)
  @Post('cash/:orderId')
  confirmCashPayment(@Param('orderId') orderId: string, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.paymentsService.confirmCashPayment(orderId, admin.userId);
  }
}
