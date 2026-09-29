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

  /**
   * Renvoie la commande avec ses tickets imbriqués (`tickets: []` tant
   * qu'elle n'est pas payée) plutôt que `{ order, tickets }` : c'est cette
   * forme "plate" que consomme le frontend (espace de suivi de l'acheteur,
   * qui poll cet endpoint jusqu'à voir `status === 'paid'`).
   *
   * `payment` résume le dernier paiement de la commande (`null` si aucun) :
   * l'acheteur voit ainsi si sa capture Wave est en attente de vérification
   * ou a été refusée, sans exposer le reste du document Payment.
   */
  async getWithTickets(id: string) {
    const order = await this.findByIdOrThrow(id);
    const [tickets, payments] = await Promise.all([
      this.ticketsService.findByOrder(id),
      db.orm.payments.where({ orderId: id }).all(),
    ]);
    const ticketsWithQrCodes =
      order.status === 'paid' ? await this.ticketsService.allWithQrCodes(tickets) : [];
    const latest = payments.reduce<(typeof payments)[number] | null>(
      (acc, p) => (!acc || p.createdAt.getTime() > acc.createdAt.getTime() ? p : acc),
      null,
    );
    const payment = latest ? { method: latest.method, status: latest.status } : null;
    return { ...order, tickets: ticketsWithQrCodes, payment };
  }
}
