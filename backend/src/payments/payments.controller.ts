import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedAdmin } from '../auth/jwt.strategy.js';
import { RateLimit } from '../common/rate-limit.guard.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWaveCheckoutDto } from './dto/create-wave-checkout.dto.js';
import { MAX_PROOF_BYTES } from './payment-proof.util.js';
import { PaymentsService, type UploadedProofFile } from './payments.service.js';

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

  /** Public — l'acheteur récupère le lien de paiement Wave de sa commande. */
  @ApiOperation({
    summary: 'Obtenir le lien de paiement Wave (public)',
    description:
      "Renvoie `paymentUrl` (lien marchand Wave, montant pré-rempli) pour une commande `pending`. " +
      "Aucun paiement n'est enregistré à ce stade : l'acheteur paie sur Wave, puis envoie sa capture " +
      'via `POST /payments/wave/proof/{orderId}`, et l\'admin confirme le paiement.',
  })
  @UseGuards(RateLimit(20, 60_000))
  @Post('wave/checkout')
  getWavePaymentLink(@Body() body: CreateWaveCheckoutDto) {
    return this.paymentsService.getWavePaymentLink(body.orderId);
  }

  /** Public — l'acheteur envoie la capture d'écran de son paiement Wave. */
  @ApiOperation({
    summary: "Envoyer la capture d'un paiement Wave (public)",
    description:
      "Multipart, champ `file` : JPEG, PNG ou WebP, 5 Mo maximum. Le paiement passe `pending` en attente " +
      "de vérification par l'admin ; un nouvel envoi remplace la capture tant qu'il n'a pas été traité.",
  })
  @ApiParam({ name: 'orderId', description: 'ObjectId de la commande' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(RateLimit(10, 10 * 60_000))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PROOF_BYTES, files: 1 } }))
  @Post('wave/proof/:orderId')
  submitWaveProof(@Param('orderId') orderId: string, @UploadedFile() file?: UploadedProofFile) {
    return this.paymentsService.submitWaveProof(orderId, file);
  }

  /** Admin — affiche la capture envoyée par l'acheteur. */
  @ApiOperation({ summary: "Voir la capture d'un paiement Wave (admin)", description: 'Renvoie l\'image brute.' })
  @ApiParam({ name: 'paymentId', description: 'ObjectId du paiement' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get(':paymentId/proof')
  async getWaveProof(@Param('paymentId') paymentId: string) {
    const proof = await this.paymentsService.getWaveProof(paymentId);
    return new StreamableFile(proof.data, { type: proof.mimeType });
  }

  /** Admin — valide un paiement Wave après vérification de la capture. */
  @ApiOperation({
    summary: 'Confirmer un paiement Wave (admin)',
    description: 'Passe le paiement à `success`, la commande à `paid` et génère ses tickets. Idempotent.',
  })
  @ApiParam({ name: 'paymentId', description: 'ObjectId du paiement' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Post(':paymentId/confirm')
  confirmWavePayment(@Param('paymentId') paymentId: string, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.paymentsService.confirmWavePayment(paymentId, admin.userId);
  }

  /** Admin — refuse un paiement Wave (capture invalide, montant incorrect…). */
  @ApiOperation({
    summary: 'Refuser un paiement Wave (admin)',
    description: "Passe le paiement à `failed`. La commande reste `pending` : l'acheteur peut renvoyer une capture.",
  })
  @ApiParam({ name: 'paymentId', description: 'ObjectId du paiement' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Post(':paymentId/reject')
  rejectWavePayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.rejectWavePayment(paymentId);
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
