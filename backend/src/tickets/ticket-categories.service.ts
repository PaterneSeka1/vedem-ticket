import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import type { CreateTicketCategoryDto } from './dto/create-ticket-category.dto.js';
import type { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto.js';

const DEFAULT_CURRENCY = 'XOF';

@Injectable()
export class TicketCategoriesService {
  findAll() {
    return db.orm.ticket_categories.all();
  }

  async findByIdOrThrow(id: string) {
    const category = await db.orm.ticket_categories.where({ _id: id }).first();
    if (!category) {
      throw new NotFoundException(`Catégorie de ticket "${id}" introuvable`);
    }
    return category;
  }

  create(dto: CreateTicketCategoryDto) {
    return db.orm.ticket_categories.create({
      name: dto.name,
      price: dto.price,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      stock: dto.stock ?? null,
      description: dto.description ?? null,
    });
  }

  async update(id: string, dto: UpdateTicketCategoryDto) {
    const existing = await this.findByIdOrThrow(id);
    return db.orm.ticket_categories.where({ _id: id }).update({
      name: dto.name ?? existing.name,
      price: dto.price ?? existing.price,
      currency: dto.currency ?? existing.currency,
      stock: dto.stock !== undefined ? dto.stock : existing.stock,
      description: dto.description !== undefined ? dto.description : existing.description,
    });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await db.orm.ticket_categories.where({ _id: id }).delete();
  }

  /**
   * Nombre de tickets déjà vendus (commandes payées) pour cette catégorie —
   * utilisé pour vérifier le stock disponible avant de créer une commande.
   * Une commande pouvant porter sur plusieurs catégories (`Order.items`), on
   * récupère toutes les commandes payées et on ne somme que la quantité de
   * l'item correspondant à cette catégorie dans chacune.
   *
   * Les commandes réglées par une invitation (`Payment.method ===
   * 'INVITATION'`, voir `OrdersService.createInvitation`) sont exclues : une
   * invitation ne doit pas réduire la disponibilité vue par les acheteurs
   * payants — décision produit, voir CLAUDE.md §4.
   *
   * Note : lecture-puis-écriture, pas de verrou/transaction (Mongo sans replica
   * set ici). Suffisant pour le volume d'un seul événement ; une commande
   * concurrente au moment exact où le stock s'épuise pourrait dépasser le
   * quota de quelques unités. À muscler plus tard si besoin.
   */
  async countSold(ticketCategoryId: string): Promise<number> {
    const [paidOrders, invitationPayments] = await Promise.all([
      db.orm.orders.where({ status: 'paid' }).all(),
      db.orm.payments.where({ method: 'INVITATION' }).all(),
    ]);
    const invitationOrderIds = new Set(invitationPayments.map((payment) => String(payment.orderId)));

    return paidOrders.reduce((total, order) => {
      if (invitationOrderIds.has(String(order._id))) {
        return total;
      }
      const items = order.items as { ticketCategoryId: unknown; quantity: number }[];
      const matching = items.filter((item) => String(item.ticketCategoryId) === String(ticketCategoryId));
      return total + matching.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  }
}
