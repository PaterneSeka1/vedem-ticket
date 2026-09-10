// Types alignés sur la spec OpenAPI de VEDEM Ticket API.
// Les endpoints qui renvoient `schema:{type:"object"}` (sans détail) sont
// typés au mieux ici — à ajuster dès qu'on voit une vraie réponse en dev.

export interface TicketCategory {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  description?: string;
}

export type OrderStatus = "ending" | "paid" | "cancelled" | string;

export interface OrderTicket {
  id?: string;
  code: string;
  qrCodeDataUrl: string;
}

export interface Order {
  id: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  ticketCategoryId: string;
  quantity: number;
  status: OrderStatus;
  totalAmount?: number;
  tickets: OrderTicket[];
  createdAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  method: "wave" | "cash" | string;
  amount: number;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
}
