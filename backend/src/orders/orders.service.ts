import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

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
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('quantity doit être un entier positif');
    }

    const category = await this.ticketCategoriesService.findByIdOrThrow(dto.ticketCategoryId);

    if (category.stock !== null) {
      const alreadySold = await this.ticketCategoriesService.countSold(dto.ticketCategoryId);
      if (alreadySold + dto.quantity > category.stock) {
        const remaining = Math.max(category.stock - alreadySold, 0);
        throw new BadRequestException(
          `Stock insuffisant pour "${category.name}" (${remaining} restant(s))`,
        );
      }
    }

    return db.orm.orders.create({
      buyerName: dto.buyerName,
      buyerPhone: dto.buyerPhone,
      buyerEmail: dto.buyerEmail ?? null,
      ticketCategoryId: dto.ticketCategoryId,
      quantity: dto.quantity,
      totalAmount: category.price * dto.quantity,
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
      ticketCategoryId: order.ticketCategoryId.toString(),
      quantity: order.quantity,
    });

    return { order: await this.findByIdOrThrow(id), tickets };
  }

  async getWithTickets(id: string) {
    const order = await this.findByIdOrThrow(id);
    const tickets = await this.ticketsService.findByOrder(id);
    const ticketsWithQrCodes =
      order.status === 'paid' ? await this.ticketsService.allWithQrCodes(tickets) : [];
    return { order, tickets: ticketsWithQrCodes };
  }
}
