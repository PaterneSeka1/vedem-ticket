import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { generateAccessCode, normalizeAccessCode } from './access-code.util.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

// Collision quasi impossible (~39 bits d'aléa), mais on vérifie quand même
// plutôt que de risquer deux commandes partageant un même code.
const ACCESS_CODE_MAX_ATTEMPTS = 5;

export type OrderStatus = 'pending' | 'paid' | 'failed';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ticketCategoriesService: TicketCategoriesService,
    private readonly ticketsService: TicketsService,
  ) {}

  findAll() {
    return db.orm.orders.all();
  }

  async findByIdOrThrow(id: string) {
    const order = await db.orm.orders.where({ _id: id }).first();
    if (!order) {
      throw new NotFoundException(`Commande "${id}" introuvable`);
    }
    return order;
  }

  async create(dto: CreateOrderDto) {
    // Plusieurs lignes peuvent viser la même catégorie (ex. appel client
    // maladroit) : on les fusionne avant de vérifier le stock/calculer le
    // total, plutôt que de rejeter ou de compter deux fois la même catégorie.
    const quantityByCategory = new Map<string, number>();
    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('quantity doit être un entier positif');
      }
      quantityByCategory.set(
        item.ticketCategoryId,
        (quantityByCategory.get(item.ticketCategoryId) ?? 0) + item.quantity,
      );
    }

    let totalAmount = 0;
    const items: { ticketCategoryId: string; quantity: number }[] = [];
    for (const [ticketCategoryId, quantity] of quantityByCategory) {
      const category = await this.ticketCategoriesService.findByIdOrThrow(ticketCategoryId);

      if (category.stock !== null) {
        const alreadySold = await this.ticketCategoriesService.countSold(ticketCategoryId);
        if (alreadySold + quantity > category.stock) {
          const remaining = Math.max(category.stock - alreadySold, 0);
          throw new BadRequestException(
            `Stock insuffisant pour "${category.name}" (${remaining} restant(s))`,
          );
        }
      }

      totalAmount += category.price * quantity;
      items.push({ ticketCategoryId, quantity });
    }

    // Renvoyé dans la réponse de création (seule fois où il est exposé
    // publiquement) : l'acheteur le garde pour télécharger ses tickets.
    return db.orm.orders.create({
      buyerName: dto.buyerName,
      buyerPhone: dto.buyerPhone,
      buyerEmail: dto.buyerEmail ?? null,
      items,
      totalAmount,
      accessCode: await this.generateUniqueAccessCode(),
      status: 'pending' satisfies OrderStatus,
      createdAt: new Date(),
    });
  }

  /**
   * Marque la commande comme payée et génère ses tickets. Appelée par le
   * module Payments une fois un paiement (Wave sur capture, ou espèces)
   * confirmé par l'admin. Idempotente : rejouer l'appel
   * sur une commande déjà payée ne régénère pas de nouveaux tickets.
   */
  async markPaid(id: string) {
    const order = await this.findByIdOrThrow(id);
    if (order.status !== 'paid') {
      await db.orm.orders.where({ _id: id }).update({ status: 'paid' satisfies OrderStatus });
    }

    const tickets = await this.ticketsService.generateForOrder({
      id: order._id.toString(),
      items: order.items.map((item) => ({
        ticketCategoryId: item.ticketCategoryId.toString(),
        quantity: item.quantity,
      })),
    });

    return { order: await this.findByIdOrThrow(id), tickets };
  }

  private async generateUniqueAccessCode(): Promise<string> {
    for (let attempt = 0; attempt < ACCESS_CODE_MAX_ATTEMPTS; attempt += 1) {
      const code = generateAccessCode();
      if (!(await db.orm.orders.where({ accessCode: code }).first())) {
        return code;
      }
    }
    throw new InternalServerErrorException('Impossible de générer un code de téléchargement unique');
  }

  /**
   * Résumé du dernier paiement de la commande (`null` si aucun) : suffit à
   * l'acheteur pour savoir si sa capture Wave est en attente de vérification
   * ou a été refusée, sans exposer le reste du document Payment.
   */
  private async latestPaymentSummary(orderId: string) {
    const payments = await db.orm.payments.where({ orderId }).all();
    const latest = payments.reduce<(typeof payments)[number] | null>(
      (acc, p) => (!acc || p.createdAt.getTime() > acc.createdAt.getTime() ? p : acc),
      null,
    );
    return latest ? { method: latest.method, status: latest.status } : null;
  }

  private async ticketsWithQrCodes(orderId: string) {
    return this.ticketsService.allWithQrCodes(await this.ticketsService.findByOrder(orderId));
  }

  /**
   * Public — suivi d'une commande par son id (espace de suivi de l'acheteur,
   * qui poll cet endpoint jusqu'à voir `status === 'paid'`). Ne renvoie
   * volontairement ni les tickets ni le code de téléchargement : l'id seul
   * ne doit pas suffire à récupérer les tickets (voir `accessByCode`).
   */
  async getPublicStatus(id: string) {
    const { accessCode: _accessCode, ...order } = await this.findByIdOrThrow(id);
    return { ...order, payment: await this.latestPaymentSummary(id) };
  }

  /**
   * Public — téléchargement des tickets avec le code remis à la création de
   * la commande. Le code n'est « actif » qu'une fois la transaction validée
   * par l'admin (commande `paid`) : avant, il est refusé (403).
   */
  async accessByCode(rawCode: string) {
    const code = normalizeAccessCode(rawCode);
    const order = code ? await db.orm.orders.where({ accessCode: code }).first() : null;
    if (!order) {
      throw new NotFoundException('Code invalide');
    }
    if (order.status !== 'paid') {
      throw new ForbiddenException(
        "Ta transaction n'a pas encore été validée par l'organisateur. Réessaie plus tard avec le même code.",
      );
    }
    const orderId = order._id.toString();
    return {
      id: orderId,
      buyerName: order.buyerName,
      items: order.items,
      totalAmount: order.totalAmount,
      status: order.status,
      tickets: await this.ticketsWithQrCodes(orderId),
    };
  }

  /**
   * Admin — commande complète avec ses tickets (QR codes) et son code de
   * téléchargement, pour réimprimer un ticket ou renvoyer le code au client.
   */
  async getWithTickets(id: string) {
    const order = await this.findByIdOrThrow(id);
    const [tickets, payment] = await Promise.all([
      order.status === 'paid' ? this.ticketsWithQrCodes(id) : Promise.resolve([]),
      this.latestPaymentSummary(id),
    ]);
    return { ...order, tickets, payment };
  }
}
