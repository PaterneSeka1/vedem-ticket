const WAVE_API_BASE_URL = 'https://api.wave.com/v1';

export interface CreateCheckoutSessionInput {
  amount: number;
  currency: string;
  clientReference: string;
  successUrl: string;
  errorUrl: string;
}

export interface WaveCheckoutSession {
  id: string;
  wave_launch_url: string;
  transaction_id?: string;
  checkout_status: 'open' | 'complete' | 'expired';
  payment_status: 'processing' | 'cancelled' | 'succeeded';
  client_reference?: string;
  when_created: string;
  when_expires: string;
}

/** Client minimal pour l'API Checkout de Wave (https://docs.wave.com/checkout). */
export class WaveClient {
  constructor(private readonly apiKey: string) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<WaveCheckoutSession> {
    const response = await fetch(`${WAVE_API_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Wave attend un montant formaté en chaîne (0 à 2 décimales).
        amount: input.amount.toFixed(0),
        currency: input.currency,
        client_reference: input.clientReference,
        success_url: input.successUrl,
        error_url: input.errorUrl,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wave checkout session creation failed (${response.status}): ${body}`);
    }

    return (await response.json()) as WaveCheckoutSession;
  }

  async getCheckoutSession(id: string): Promise<WaveCheckoutSession> {
    const response = await fetch(`${WAVE_API_BASE_URL}/checkout/sessions/${id}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wave checkout session lookup failed (${response.status}): ${body}`);
    }

    return (await response.json()) as WaveCheckoutSession;
  }
}
