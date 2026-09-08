import QRCode from 'qrcode';

/**
 * Encode le code unique d'un ticket dans un QR code, retourné en data URL PNG
 * (directement affichable dans un <img src="...">). Le contenu du QR est le
 * code du ticket lui-même ; c'est ce code que l'endpoint de scan (Étape 5)
 * lira pour retrouver et valider le ticket.
 */
export function generateQrCodeDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code);
}
