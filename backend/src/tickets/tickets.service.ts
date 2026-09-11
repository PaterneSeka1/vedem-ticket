import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db } from '../prisma/db.js';
import { generateQrCodeDataUrl } from './qr-code.util.js';

export type TicketStatus = 'valid' | 'used' | 'cancelled';

export interface PaidOrderRef {
  id: string;
  items: { ticketCategoryId: string; quantity: number }[];
}

@Injectable()
export class TicketsService {
  /** Admin — liste tous les tickets (dashboard : onglets Tickets/Tombola, comptage des entrées). */
  findAll() {
    return db.orm.tickets.all();
  }

  findByOrder(orderId: string) {
    return db.orm.tickets.where({ orderId }).all();
  }

  /**
   * Génère un ticket (avec code unique) par unité commandée, pour chacune des
   * catégories de la commande. Idempotent : si des tickets existent déjà pour
   * cette commande (ex. appel en double lors de la confirmation d'un
   * paiement), ils sont retournés tels quels plutôt que dupliqués.
   */
  async generateForOrder(order: PaidOrderRef) {
    const existing = await this.findByOrder(order.id);
    if (existing.length > 0) {
      return existing;
    }

    const tickets = [];
    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i += 1) {
        const ticket = await db.orm.tickets.create({
          orderId: order.id,
          ticketCategoryId: item.ticketCategoryId,
          code: randomUUID(),
          status: 'valid' satisfies TicketStatus,
          usedAt: null,
          scannedByUserId: null,
        });
        tickets.push(ticket);
      }
    }
    return tickets;
  }

  async withQrCode<T extends { code: string }>(ticket: T) {
    return { ...ticket, qrCodeDataUrl: await generateQrCodeDataUrl(ticket.code) };
  }

  async allWithQrCodes<T extends { code: string }>(tickets: T[]) {
    return Promise.all(tickets.map((ticket) => this.withQrCode(ticket)));
  }

  /**
   * Validation à l'entrée : un ticket `valid` passe à `used` et ne peut plus
   * être réutilisé. Enrichi avec le nom de l'acheteur et la catégorie pour
   * que l'admin voie qui il fait entrer.
   */
  async scan(code: string, scannedByUserId: string) {
    const ticket = await db.orm.tickets.where({ code }).first();
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    if (ticket.status === 'used') {
      throw new ConflictException(
        `Ticket déjà scanné le ${ticket.usedAt?.toISOString() ?? '(date inconnue)'}`,
      );
    }
    if (ticket.status === 'cancelled') {
      throw new ConflictException('Ticket annulé');
    }

    const usedAt = new Date();
    await db.orm.tickets
      .where({ _id: ticket._id.toString() })
      .update({ status: 'used' satisfies TicketStatus, usedAt, scannedByUserId });

    const [order, category] = await Promise.all([
      db.orm.orders.where({ _id: ticket.orderId.toString() }).first(),
      db.orm.ticket_categories.where({ _id: ticket.ticketCategoryId.toString() }).first(),
    ]);

    return {
      ticket: { ...ticket, status: 'used' satisfies TicketStatus, usedAt, scannedByUserId },
      buyerName: order?.buyerName ?? null,
      categoryName: category?.name ?? null,
    };
  }
}
