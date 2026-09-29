// Dernière commande passée sur cet appareil : permet de revenir au suivi
// (/success) après avoir quitté la page pour payer dans l'app Wave, et de
// pré-remplir le code sur /mes-tickets. localStorage (et non sessionStorage) :
// la validation par l'admin n'est pas immédiate, l'onglet a le temps d'être
// fermé entre-temps.
const LAST_ORDER_KEY = "vedem-last-order";
const LAST_ACCESS_CODE_KEY = "vedem-last-access-code";

// Repli en mémoire si localStorage est indisponible (navigation privée…) :
// survit à la navigation côté client checkout -> /success, où le code est
// affiché — c'est la seule fois où l'API le renvoie à l'acheteur.
let memoryOrderId: string | null = null;
let memoryAccessCode: string | null = null;

export function saveLastOrder(orderId: string, accessCode: string | null | undefined): void {
  memoryOrderId = orderId;
  memoryAccessCode = accessCode ?? null;
  try {
    localStorage.setItem(LAST_ORDER_KEY, orderId);
    if (accessCode) localStorage.setItem(LAST_ACCESS_CODE_KEY, accessCode);
    else localStorage.removeItem(LAST_ACCESS_CODE_KEY);
  } catch {
    // Stockage indisponible : l'orderId reste dans l'URL, le code en mémoire.
  }
}

export function getLastOrderId(): string | null {
  try {
    return localStorage.getItem(LAST_ORDER_KEY) ?? memoryOrderId;
  } catch {
    return memoryOrderId;
  }
}

/** Code de la dernière commande de cet appareil, seulement s'il correspond à `orderId` quand il est fourni. */
export function getLastAccessCode(orderId?: string | null): string | null {
  if (orderId && getLastOrderId() !== orderId) return null;
  try {
    return localStorage.getItem(LAST_ACCESS_CODE_KEY) ?? memoryAccessCode;
  } catch {
    return memoryAccessCode;
  }
}
