export function money(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

/**
 * Construit un lien "click-to-chat" WhatsApp (wa.me) à partir d'un numéro
 * local et d'un message pré-rempli. Les numéros ivoiriens (format à 10
 * chiffres depuis la réforme 2021, ex. 07 00 00 00 00) sont préfixés de
 * l'indicatif +225 sans retirer le 0 initial, conformément à ce format.
 */
export function whatsappLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("225") && digits.length <= 10) digits = `225${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
