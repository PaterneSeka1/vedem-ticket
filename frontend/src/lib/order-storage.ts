// Dernière commande passée sur cet appareil : permet de revenir à l'espace
// acheteur (/success, lien « Mes tickets » de la Topbar) après avoir quitté la
// page pour payer dans l'app Wave, ou plus tard une fois le paiement confirmé
// par l'admin. localStorage (et non sessionStorage) : la confirmation n'est
// pas immédiate, l'onglet a le temps d'être fermé entre-temps.
const LAST_ORDER_KEY = "vedem-last-order";

export function saveLastOrderId(orderId: string): void {
  try {
    localStorage.setItem(LAST_ORDER_KEY, orderId);
  } catch {
    // Stockage indisponible (navigation privée…) : l'orderId reste dans l'URL.
  }
}

export function getLastOrderId(): string | null {
  try {
    return localStorage.getItem(LAST_ORDER_KEY);
  } catch {
    return null;
  }
}
