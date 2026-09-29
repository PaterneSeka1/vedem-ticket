const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Un 401 sur un appel authentifié (token) veut dire : session admin expirée
// ou révoquée. Utilisé pour déclencher une déconnexion + redirection vers
// /admin/login plutôt que d'afficher une erreur générique.
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Corps non JSON (ex: page d'erreur du reverse proxy) : message générique.
  }
  const message =
    data && typeof data === "object" && "message" in data
      ? String((data as { message: unknown }).message)
      : `Erreur ${res.status}`;
  return new ApiError(res.status, message, data);
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw await toApiError(res);

  // 204 / vide
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Envoi multipart (capture de paiement Wave) : pas de Content-Type explicite,
// le navigateur le fixe lui-même avec la bonne `boundary`.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: formData });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

// Réponse binaire authentifiée (capture de paiement côté admin) : renvoyée en
// Blob, à afficher via `URL.createObjectURL`.
export async function apiFetchBlob(path: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await toApiError(res);
  return res.blob();
}

// Le back MongoDB/NestJS renvoie parfois `_id` plutôt que `id` selon la
// config de sérialisation — cette aide couvre les deux cas.
export function extractId(obj: unknown): string {
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (typeof o.id === "string") return o.id;
    if (typeof o._id === "string") return o._id;
  }
  throw new Error("Impossible de trouver l'identifiant dans la réponse de l'API.");
}
