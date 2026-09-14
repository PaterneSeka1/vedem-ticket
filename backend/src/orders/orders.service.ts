import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import type { CreateOrderItemDto } from './dto/create-order-item.dto.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { CreateInvitationDto } from '../payments/dto/create-invitation.dto.js';

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

  /**
   * Valide et fusionne les lignes d'une commande : rejette une quantité
   * invalide, vérifie que chaque catégorie existe, et fusionne les lignes en
   * double visant la même catégorie (ex. appel client maladroit) plutôt que
   * de rejeter ou de compter deux fois. Ne vérifie PAS le stock — appelant
   * responsable de ce contrôle si nécessaire (voir `create` vs
   * `createInvitation`).
   */
  private async resolveItems(items: CreateOrderItemDto[]) {
    const quantityByCategory = new Map<string, number>();
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('quantity doit être un entier positif');
      }
      quantityByCategory.set(
        item.ticketCategoryId,
        (quantityByCategory.get(item.ticketCategoryId) ?? 0) + item.quantity,
      );
    }

    const resolved: { ticketCategoryId: string; quantity: number; category: Awaited<ReturnType<TicketCategoriesService['findByIdOrThrow']>> }[] = [];
    for (const [ticketCategoryId, quantity] of quantityByCategory) {
      const category = await this.ticketCategoriesService.findByIdOrThrow(ticketCategoryId);
      resolved.push({ ticketCategoryId, quantity, category });
    }
    return resolved;
  }

  async create(dto: CreateOrderDto) {
    const resolved = await this.resolveItems(dto.items);

    let totalAmount = 0;
    const items: { ticketCategoryId: string; quantity: number }[] = [];
    for (const { ticketCategoryId, quantity, category } of resolved) {
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

    return db.orm.orders.create({
      buyerName: dto.buyerName,
      buyerPhone: dto.buyerPhone,
      buyerEmail: dto.buyerEmail ?? null,
      items,
      totalAmount,
      status: 'pending' satisfies OrderStatus,
      createdAt: new Date(),
    });
  }

  /**
   * Ticket d'invitation (personnalité) : offert par l'admin, sans paiement.
   * Contrairement à `create`, ignore volontairement le stock de chaque
   * catégorie (les invitations ne doivent pas être bloquées par une
   * catégorie épuisée) et fixe `totalAmount` à 0 (aucune valeur affichée —
   * décision produit, voir CLAUDE.md §4). Ces commandes sont exclues du
   * calcul de stock des ventes normales (voir
   * `TicketCategoriesService.countSold`), pour ne pas réduire artificiellement
   * la disponibilité vue par les acheteurs payants.
   */
  async createInvitation(dto: CreateInvitationDto) {
    const resolved = await this.resolveItems(dto.items);
    const items = resolved.map(({ ticketCategoryId, quantity }) => ({ ticketCategoryId, quantity }));

    return db.orm.orders.create({
      buyerName: dto.buyerName,
      buyerPhone: dto.buyerPhone ?? null,
      buyerEmail: dto.buyerEmail ?? null,
      items,
      totalAmount: 0,
      status: 'pending' satisfies OrderStatus,
      createdAt: new Date(),
    });
  }

  /**
   * Marque la commande comme payée et génère ses tickets. Appelée par le
   * module Payments (Étape 4) une fois un paiement Wave confirmé par webhook
   * ou un paiement espèces validé par l'admin. Idempotente : rejouer l'appel
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
   * forme "plate" que consomme le frontend (page de suivi post-paiement, qui
   * poll cet endpoint jusqu'à voir `status === 'paid'`).
   */
  async getWithTickets(id: string) {
    const order = await this.findByIdOrThrow(id);
    const tickets = await this.ticketsService.findByOrder(id);
    const ticketsWithQrCodes =
      order.status === 'paid' ? await this.ticketsService.allWithQrCodes(tickets) : [];
    return { ...order, tickets: ticketsWithQrCodes };
  }
}
