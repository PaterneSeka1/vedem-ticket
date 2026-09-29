import { randomInt } from 'node:crypto';

// Sans 0/O, 1/I/L : le code est recopié à la main par l'acheteur.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACCESS_CODE_LENGTH = 8;

/**
 * Code de téléchargement d'une commande : 8 caractères tirés au hasard
 * (générateur cryptographique), soit ~39 bits — hors de portée d'une
 * recherche exhaustive vu le rate-limit de `POST /orders/access`.
 * Stocké sans séparateur ("K7M2P9QX"), affiché "K7M2-P9QX".
 */
export function generateAccessCode(): string {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Met un code saisi par l'acheteur sous sa forme stockée (majuscules, sans tiret ni espace). */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
