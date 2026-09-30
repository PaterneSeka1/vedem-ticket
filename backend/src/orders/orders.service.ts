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
import { computeWaveFees } from '../payments/wave-fees.util.js';
import { generateAccessCode, normalizeAccessCode } from './access-code.util.js';
import type { CreateOrderItemDto } from './dto/create-order-item.dto.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { CreateInvitationDto } from '../payments/dto/create-invitation.dto.js';

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
    // Part du montant soumise aux frais Wave (catégories `chargeWaveFees`).
    let waveFeesBase = 0;
    const items: { ticketCategoryId: string; quantity: number }[] = [];
    for (const { ticketCategoryId, quantity, category } of resolved) {
      // Réservée aux invitations (ex. VVIP) : jamais vendue, ni en Wave ni en
      // espèces — seule `createInvitation` peut l'utiliser.
      if (category.invitationOnly) {
        throw new BadRequestException(`"${category.name}" est réservée aux invitations`);
      }
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
      if (category.chargeWaveFees) {
        waveFeesBase += category.price * quantity;
      }
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
      // Figés ici : modifier ensuite l'option de la catégorie ne change pas
      // le montant Wave d'une commande déjà passée.
      waveFees: computeWaveFees(waveFeesBase),
      accessCode: await this.generateUniqueAccessCode(),
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
      waveFees: 0,
      // Comme toute commande : l'admin le remet à l'invité pour `/mes-tickets`.
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
