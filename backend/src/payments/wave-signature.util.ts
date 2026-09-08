import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/**
 * Vérifie l'en-tête `Wave-Signature` d'un webhook Wave.
 *
 * Format de l'en-tête : `t=<timestamp unix>,v1=<hmac-sha256 hex>`.
 * La charge signée est la concaténation `timestamp + corps brut` (sans
 * séparateur) — d'où l'obligation de vérifier contre le Buffer brut de la
 * requête, jamais contre un JSON reparsé/reformaté.
 *
 * Réf. https://docs.wave.com/webhook
 */
export function verifyWaveSignature(
  header: string | undefined,
  rawBody: Buffer,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!header) {
    return false;
  }

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(timestamp, 'utf-8'), rawBody]))
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf-8');
  const signatureBuffer = Buffer.from(signature, 'utf-8');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
