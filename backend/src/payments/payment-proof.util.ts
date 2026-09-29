/** Taille maximale d'une capture de paiement (une capture d'écran de téléphone fait quelques centaines de Ko). */
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export type ProofImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Détermine le type d'image à partir de sa signature (premiers octets), pas
 * du type déclaré par le client, qui n'est pas fiable. Renvoie `null` si ce
 * n'est ni un JPEG, ni un PNG, ni un WebP.
 */
export function detectProofImageType(buffer: Buffer): ProofImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
