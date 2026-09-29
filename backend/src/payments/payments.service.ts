import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { OrdersService } from '../orders/orders.service.js';
import type { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { detectProofImageType, MAX_PROOF_BYTES } from './payment-proof.util.js';

export type PaymentMethod = 'WAVE' | 'CASH' | 'INVITATION';
export type PaymentStatus = 'pending' | 'success' | 'failed';

/** Sous-ensemble du fichier fourni par multer (stockage mémoire) dont on a besoin. */
export interface UploadedProofFile {
  buffer: Buffer;
  size: number;
}

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

  private async findWavePaymentOrThrow(paymentId: string) {
    const payment = await db.orm.payments.where({ _id: paymentId }).first();
    if (!payment || payment.method !== ('WAVE' satisfies PaymentMethod)) {
      throw new NotFoundException(`Paiement Wave "${paymentId}" introuvable`);
    }
    return payment;
  }

  private async findPendingOrderOrThrow(orderId: string) {
    const order = await this.ordersService.findByIdOrThrow(orderId);
    if (order.status !== 'pending') {
      throw new BadRequestException(`Commande "${orderId}" déjà ${order.status}`);
    }
    return order;
  }

  /**
   * Public — renvoie le lien de paiement Wave (lien marchand fixe,
   * `WAVE_PAYMENT_URL`) complété du montant de la commande. Aucune écriture
   * en base : le paiement n'existe qu'une fois la capture envoyée
   * (`submitWaveProof`), puis confirmé manuellement par l'admin.
   */
  async getWavePaymentLink(orderId: string) {
    const order = await this.findPendingOrderOrThrow(orderId);
    // La commande peut porter sur plusieurs catégories : le lien Wave ne
    // porte qu'UNE devise, donc on vérifie qu'elles sont toutes identiques
    // (cas normal, un seul événement/une seule devise).
    const categories = await Promise.all(
      order.items.map((item) => this.ticketCategoriesService.findByIdOrThrow(item.ticketCategoryId.toString())),
    );
    const currency = categories[0].currency;
    if (categories.some((c) => c.currency !== currency)) {
      throw new BadRequestException(
        'Les catégories de cette commande utilisent des devises différentes',
      );
    }

    let paymentUrl: URL;
    try {
      paymentUrl = new URL(requireEnv('WAVE_PAYMENT_URL'));
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException("WAVE_PAYMENT_URL n'est pas une URL valide");
    }
    // Pré-remplit le montant dans l'app Wave ; l'acheteur peut encore le
    // modifier, d'où la vérification par l'admin sur la capture.
    paymentUrl.searchParams.set('amount', String(order.totalAmount));

    return { paymentUrl: paymentUrl.toString(), amount: order.totalAmount, currency };
  }

  /**
   * Public — l'acheteur envoie la capture d'écran de son paiement Wave. Crée
   * un paiement WAVE `pending` (en attente de vérification par l'admin), ou
   * remplace la capture du paiement déjà en attente pour cette commande
   * (erreur de fichier, capture illisible…). Après un refus (`failed`), un
   * nouvel envoi crée un nouveau paiement en attente.
   */
  async submitWaveProof(orderId: string, file: UploadedProofFile | undefined) {
    if (!file || file.size === 0) {
      throw new BadRequestException('Capture du paiement manquante (champ "file")');
    }
    if (file.size > MAX_PROOF_BYTES) {
      throw new BadRequestException('Capture trop volumineuse (5 Mo maximum)');
    }
    // Type déterminé à partir du contenu réel, pas du type déclaré par le
    // navigateur : c'est lui qui sera renvoyé à l'admin comme Content-Type.
    const mimeType = detectProofImageType(file.buffer);
    if (!mimeType) {
      throw new BadRequestException('Format non pris en charge (JPEG, PNG ou WebP attendu)');
    }

    const order = await this.findPendingOrderOrThrow(orderId);
    const orderIdStr = order._id.toString();

    const existing = await db.orm.payments
      .where({
        orderId: orderIdStr,
        method: 'WAVE' satisfies PaymentMethod,
        status: 'pending' satisfies PaymentStatus,
      })
      .first();

    const payment =
      existing ??
      (await db.orm.payments.create({
        orderId: orderIdStr,
        method: 'WAVE' satisfies PaymentMethod,
        status: 'pending' satisfies PaymentStatus,
        waveReference: null,
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      }));
    const paymentId = payment._id.toString();

    if (existing) {
      await db.orm.payment_proofs.where({ paymentId }).delete();
    }
    await db.orm.payment_proofs.create({
      paymentId,
      mimeType,
      data: file.buffer.toString('base64'),
      createdAt: new Date(),
    });

    return { paymentId, status: 'pending' satisfies PaymentStatus };
  }

  /** Admin — capture d'écran associée à un paiement Wave. */
  async getWaveProof(paymentId: string) {
    await this.findWavePaymentOrThrow(paymentId);
    const proof = await db.orm.payment_proofs.where({ paymentId }).first();
    if (!proof) {
      throw new NotFoundException('Aucune capture pour ce paiement');
    }
    return { mimeType: proof.mimeType, data: Buffer.from(proof.data, 'base64') };
  }

  /**
   * Admin — valide un paiement Wave après vérification de la capture : passe
   * le paiement à `success`, la commande à `paid` et génère ses tickets.
   * Idempotent sur un paiement déjà confirmé.
   */
  async confirmWavePayment(paymentId: string, confirmedByUserId: string) {
    const payment = await this.findWavePaymentOrThrow(paymentId);
    if (payment.status === 'failed') {
      throw new BadRequestException('Ce paiement a été refusé');
    }
    if (payment.status !== 'success') {
      await db.orm.payments
        .where({ _id: paymentId })
        .update({ status: 'success' satisfies PaymentStatus, confirmedByUserId, confirmedAt: new Date() });
    }

    const { order, tickets } = await this.ordersService.markPaid(payment.orderId.toString());
    const updated = await db.orm.payments.where({ _id: paymentId }).first();
    return { payment: updated, order, tickets };
  }

  /**
   * Admin — refuse un paiement Wave (capture invalide, montant incorrect…).
   * La commande reste `pending` : l'acheteur peut envoyer une nouvelle capture.
   */
  async rejectWavePayment(paymentId: string) {
    const payment = await this.findWavePaymentOrThrow(paymentId);
    if (payment.status === 'success') {
      throw new BadRequestException('Ce paiement est déjà confirmé, les tickets ont été générés');
    }
    if (payment.status !== 'failed') {
      await db.orm.payments.where({ _id: paymentId }).update({ status: 'failed' satisfies PaymentStatus });
    }
    return db.orm.payments.where({ _id: paymentId }).first();
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

  /**
   * Admin — ticket d'invitation (personnalité) : crée la commande et génère
   * ses tickets en un seul appel, sans paiement réel (CLAUDE.md §4). Contrairement
   * au flux espèces, il n'y a pas de commande `pending` préexistante : l'admin
   * saisit directement les informations de l'invité.
   */
  async createInvitation(dto: CreateInvitationDto, confirmedByUserId: string) {
    const order = await this.ordersService.createInvitation(dto);

    const payment = await db.orm.payments.create({
      orderId: order._id.toString(),
      method: 'INVITATION' satisfies PaymentMethod,
      status: 'success' satisfies PaymentStatus,
      waveReference: null,
      confirmedByUserId,
      confirmedAt: new Date(),
      createdAt: new Date(),
    });

    const { order: paidOrder, tickets } = await this.ordersService.markPaid(order._id.toString());
    return { payment, order: paidOrder, tickets };
  }
}
