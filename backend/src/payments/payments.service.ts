import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { WaveClient } from './wave-client.js';
import { verifyWaveSignature } from './wave-signature.util.js';

export type PaymentMethod = 'WAVE' | 'CASH';
export type PaymentStatus = 'pending' | 'success' | 'failed';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new InternalServerErrorException(`${name} n'est pas configuré côté serveur`);
  }
  return value;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ticketCategoriesService: TicketCategoriesService,
  ) {}

  findAll() {
    return db.orm.payments.all();
  }

  /** Public — l'acheteur choisit Wave comme moyen de paiement pour sa commande. */
  async initiateWaveCheckout(orderId: string) {
    const order = await this.ordersService.findByIdOrThrow(orderId);
    if (order.status !== 'pending') {
      throw new BadRequestException(`Commande "${orderId}" déjà ${order.status}`);
    }
    const category = await this.ticketCategoriesService.findByIdOrThrow(
      order.ticketCategoryId.toString(),
    );

    const frontendBaseUrl = requireEnv('FRONTEND_BASE_URL');
    const waveClient = new WaveClient(requireEnv('WAVE_API_KEY'));

    const session = await waveClient.createCheckoutSession({
      amount: order.totalAmount,
      currency: category.currency,
      clientReference: order._id.toString(),
      successUrl: `${frontendBaseUrl}/paiement/succes?orderId=${order._id.toString()}`,
      errorUrl: `${frontendBaseUrl}/paiement/echec?orderId=${order._id.toString()}`,
    });

    const payment = await db.orm.payments.create({
      orderId: order._id.toString(),
      method: 'WAVE' satisfies PaymentMethod,
      status: 'pending' satisfies PaymentStatus,
      waveReference: session.id,
      confirmedByUserId: null,
      confirmedAt: null,
      createdAt: new Date(),
    });

    return { paymentId: payment._id.toString(), checkoutUrl: session.wave_launch_url };
  }

  /**
   * Traite un événement webhook Wave déjà authentifié (signature vérifiée par
   * le contrôleur avant l'appel). Idempotent : un événement rejoué pour un
   * paiement déjà "success" est un no-op.
   */
  async handleWaveEvent(event: {
    type: string;
    data: { id: string; client_reference?: string; payment_status: string };
  }) {
    if (event.type !== 'checkout.session.completed') {
      return { ignored: true, reason: 'unhandled_event_type' };
    }

    const payment = await db.orm.payments.where({ waveReference: event.data.id }).first();
    if (!payment) {
      // Pas d'erreur 4xx/5xx ici : on ne veut pas que Wave boucle en retry sur
      // un événement qu'on ne pourra jamais rapprocher (session inconnue).
      return { ignored: true, reason: 'payment_not_found' };
    }
    if (payment.status === 'success') {
      return { ok: true, alreadyProcessed: true };
    }

    if (event.data.payment_status === 'succeeded') {
      await db.orm.payments
        .where({ _id: payment._id.toString() })
        .update({ status: 'success' satisfies PaymentStatus, confirmedAt: new Date() });
      await this.ordersService.markPaid(payment.orderId.toString());
    } else {
      await db.orm.payments
        .where({ _id: payment._id.toString() })
        .update({ status: 'failed' satisfies PaymentStatus });
    }

    return { ok: true };
  }

  /** Vérifie la signature `Wave-Signature` d'une requête webhook brute. */
  verifyWebhookRequest(signatureHeader: string | undefined, rawBody: Buffer): void {
    const secret = requireEnv('WAVE_WEBHOOK_SECRET');
    if (!verifyWaveSignature(signatureHeader, rawBody, secret)) {
      throw new UnauthorizedException('Signature Wave invalide');
    }
  }

  /** Admin — confirmation manuelle d'un paiement espèces (CLAUDE.md §4/§7). */
  async confirmCashPayment(orderId: string, confirmedByUserId: string) {
    const existing = await db.orm.payments
      .where({ orderId, method: 'CASH' satisfies PaymentMethod, status: 'success' satisfies PaymentStatus })
      .first();

    const payment =
      existing ??
      (await db.orm.payments.create({
        orderId,
        method: 'CASH' satisfies PaymentMethod,
        status: 'success' satisfies PaymentStatus,
        waveReference: null,
        confirmedByUserId,
        confirmedAt: new Date(),
        createdAt: new Date(),
      }));

    const { order, tickets } = await this.ordersService.markPaid(orderId);
    return { payment, order, tickets };
  }
}
