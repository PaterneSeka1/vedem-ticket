"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  History,
  Keyboard,
  Loader2,
  RotateCw,
  ShieldX,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminData } from "@/context/AdminDataContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useQrScanner } from "@/hooks/useQrScanner";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { formatDateTime, formatNumber, formatTime } from "@/lib/format";
import { ScanResponse } from "@/lib/types";

type Outcome = "success" | "refused" | "unknown";

interface ScanEvent {
  id: number;
  code: string;
  outcome: Outcome;
  title: string;
  detail: string | null;
  time: number;
}

// Le même code ne redéclenche pas de scan pendant ce délai : la caméra
// continue de « voir » le QR tant qu'il reste dans le champ.
const RESCAN_COOLDOWN_MS = 3000;
const HISTORY_KEY = "vedem-scan-history";
const HISTORY_MAX = 50;

function readHistory(): ScanEvent[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ScanEvent[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: ScanEvent[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Stockage indisponible : l'historique reste en mémoire.
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Résultat d'un appel de validation, toujours issu de la réponse du serveur (jamais présumé localement). */
function describeError(err: unknown): Omit<ScanEvent, "id" | "code" | "time"> {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      // Le backend renvoie « Ticket déjà scanné le <date ISO> » : date rendue lisible.
      const iso = err.message.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/)?.[0];
      return {
        outcome: "refused",
        title: "Billet déjà utilisé",
        detail: iso ? `Entrée déjà validée le ${formatDateTime(iso)}.` : err.message,
      };
    }
    if (err.status === 404) return { outcome: "refused", title: "Billet inconnu", detail: "Ce code ne correspond à aucun billet émis." };
    if (err.status === 400) return { outcome: "refused", title: "Billet refusé", detail: err.message };
    return {
      outcome: "unknown",
      title: "Validation impossible",
      detail: `Le serveur a répondu « ${err.message} ». Le billet n'a pas été validé : réessayez.`,
    };
  }
  return {
    outcome: "unknown",
    title: "Réseau indisponible",
    detail: "Aucune réponse du serveur : le billet n'a PAS été validé. Vérifiez la connexion puis réessayez.",
  };
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration non prise en charge : retour visuel uniquement.
  }
}

export default function AccessControlPage() {
  const { token, handleUnauthorized } = useAdminSession();
  const { tickets, markTicketUsed } = useAdminData();

  const [cameraOn, setCameraOn] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [last, setLast] = useState<ScanEvent | null>(null);
  const [history, setHistory] = useState<ScanEvent[]>(() => (typeof window !== "undefined" ? readHistory() : []));
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const inFlightRef = useRef(false);
  // Identifiants uniques même face à l'historique restauré : horodatage + compteur.
  const eventIdRef = useRef(0);

  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const entries = useMemo(() => tickets.filter((t) => t.status === "used").length, [tickets]);
  const issued = useMemo(() => tickets.filter((t) => t.status !== "cancelled").length, [tickets]);
  const sessionValidated = history.filter((h) => h.outcome === "success").length;

  // Point d'entrée unique des scans (caméra, douchette ou saisie clavier).
  const runScan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !token || inFlightRef.current) return;
      const now = Date.now();
      if (lastScanRef.current?.code === code && now - lastScanRef.current.at < RESCAN_COOLDOWN_MS) return;
      lastScanRef.current = { code, at: now };
      inFlightRef.current = true;
      setProcessing(code);

      let event: ScanEvent;
      try {
        const res = await apiFetch<ScanResponse>(`/tickets/${encodeURIComponent(code)}/scan`, { method: "PATCH", token });
        event = {
          id: now * 1000 + (++eventIdRef.current % 1000),
          code,
          outcome: "success",
          title: "Entrée autorisée",
          detail: [res.buyerName, res.categoryName].filter(Boolean).join(" · ") || null,
          time: now,
        };
        // Reflète la validation localement plutôt que de recharger tout le dashboard à chaque entrée.
        markTicketUsed(res.ticket.code, res.ticket.usedAt);
        vibrate(80);
      } catch (err) {
        if (isUnauthorized(err)) {
          inFlightRef.current = false;
          setProcessing(null);
          handleUnauthorized();
          return;
        }
        event = { id: now * 1000 + (++eventIdRef.current % 1000), code, time: now, ...describeError(err) };
        // Un échec réseau ne doit pas bloquer une nouvelle tentative sur le même code.
        if (event.outcome === "unknown") lastScanRef.current = null;
        vibrate([60, 60, 60]);
      }

      setLast(event);
      setHistory((prev) => {
        const next = [event, ...prev].slice(0, HISTORY_MAX);
        writeHistory(next);
        return next;
      });
      inFlightRef.current = false;
      setProcessing(null);
    },
    [token, markTicketUsed, handleUnauthorized],
  );

  const { state: cameraState, error: cameraError } = useQrScanner({
    videoRef,
    enabled: cameraOn,
    paused: processing !== null,
    onDecode: runScan,
  });

  // Douchette USB/Bluetooth : focus du champ code sur les appareils à pointeur fin
  // (desktop), pas sur mobile où cela ouvrirait le clavier virtuel.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = manualCode;
    setManualCode("");
    lastScanRef.current = null; // une saisie volontaire n'est pas soumise au délai anti-rebond
    void runScan(code);
  }

  function retry() {
    if (!last) return;
    lastScanRef.current = null;
    void runScan(last.code);
  }

  // Le cadre de visée prend la couleur du dernier résultat jusqu'au scan suivant.
  const stageState = processing ? "processing" : last ? (last.outcome === "success" ? "success" : "error") : "idle";

  return (
    <div className="scan-layout">
      <div style={{ display: "grid", gap: "var(--space-4)", minWidth: 0 }}>
        {!online && (
          <div className="offline-banner" role="alert">
            <WifiOff size={16} strokeWidth={2} aria-hidden="true" /> Hors connexion — les billets ne peuvent pas être validés.
          </div>
        )}

        <div className="scan-stage" data-state={stageState}>
          <video ref={videoRef} muted playsInline aria-label="Flux de la caméra" hidden={cameraState !== "live"} />
          {cameraState === "live" ? (
            <>
              <div className="scan-reticle" aria-hidden="true" />
              <span className="scan-stage-status" aria-live="polite">
                {processing ? (
                  <>
                    <Loader2 size={14} strokeWidth={2.4} className="spin" aria-hidden="true" /> Vérification auprès du serveur…
                  </>
                ) : (
                  <>
                    <span className="scan-live-dot" aria-hidden="true" /> Placez le QR code dans le cadre
                  </>
                )}
              </span>
            </>
          ) : (
            <div className="scan-stage-overlay">
              {cameraState === "starting" ? (
                <>
                  <Loader2 size={28} strokeWidth={2} className="spin" aria-hidden="true" />
                  <p>Démarrage de la caméra…</p>
                </>
              ) : cameraState === "error" ? (
                <>
                  <CameraOff size={28} strokeWidth={2} aria-hidden="true" />
                  <p role="alert">{cameraError}</p>
                  <button type="button" className="btn btn-inverse" onClick={() => setCameraOn(false)}>
                    Fermer
                  </button>
                </>
              ) : (
                <>
                  <Camera size={28} strokeWidth={2} aria-hidden="true" />
                  <p>Activez la caméra arrière pour scanner les QR codes des billets.</p>
                  <button type="button" className="btn btn-gold btn-lg" onClick={() => setCameraOn(true)}>
                    <Camera size={18} strokeWidth={2} aria-hidden="true" /> Activer la caméra
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {cameraOn && cameraState !== "error" && (
          <button type="button" className="btn btn-secondary" onClick={() => setCameraOn(false)}>
            <CameraOff size={16} strokeWidth={2} aria-hidden="true" /> Arrêter la caméra
          </button>
        )}

        <div aria-live="assertive" aria-atomic="true">
          {processing ? (
            <div className="scan-result" data-tone="processing">
              <span className="scan-result-icon" aria-hidden="true">
                <Loader2 size={24} strokeWidth={2} className="spin" />
              </span>
              <div>
                <h3>Vérification…</h3>
                <p className="ref">{processing}</p>
              </div>
            </div>
          ) : (
            last && (
              <div
                className="scan-result"
                key={last.id}
                data-tone={last.outcome === "success" ? "success" : last.outcome === "refused" ? "danger" : "warning"}
              >
                <span className="scan-result-icon" aria-hidden="true">
                  {last.outcome === "success" ? (
                    <CheckCircle2 size={28} strokeWidth={2} />
                  ) : last.outcome === "refused" ? (
                    <XCircle size={28} strokeWidth={2} />
                  ) : (
                    <ShieldX size={28} strokeWidth={2} />
                  )}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3>{last.title}</h3>
                  {last.detail && <p>{last.detail}</p>}
                  <div className="scan-result-meta">
                    <span className="ref">{last.code}</span>
                    <span className="text-tertiary" style={{ fontSize: "var(--text-xs)" }}>
                      {formatTime(last.time)}
                    </span>
                  </div>
                  {last.outcome === "unknown" && (
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={retry}>
                      <RotateCw size={14} strokeWidth={2} aria-hidden="true" /> Réessayer ce billet
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <Card>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <label htmlFor="manual-code" className="field-label">
              <Keyboard size={15} strokeWidth={2} aria-hidden="true" /> Saisie manuelle ou douchette
            </label>
            <form className="scan-manual" onSubmit={handleManualSubmit}>
              <input
                id="manual-code"
                ref={inputRef}
                className="input input-lg"
                placeholder="Code du billet"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button className="btn btn-primary btn-lg" type="submit" disabled={!manualCode.trim() || processing !== null}>
                Valider
              </button>
            </form>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gap: "var(--space-4)", minWidth: 0 }}>
        <div className="scan-counter" aria-label="Compteurs">
          <div>
            <span>Entrées</span>
            <b>{formatNumber(entries)}</b>
          </div>
          <div>
            <span>Billets émis</span>
            <b>{formatNumber(issued)}</b>
          </div>
          <div>
            <span>Cette session</span>
            <b>{formatNumber(sessionValidated)}</b>
          </div>
        </div>

        <Card>
          <SectionHeader
            title="Derniers scans"
            description="Sur cet appareil, pendant cette session"
            actions={
              history.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setHistory([]);
                    writeHistory([]);
                  }}
                >
                  Effacer
                </button>
              )
            }
          />
          <div style={{ marginTop: 12 }}>
            {history.length === 0 ? (
              <EmptyState compact icon={History} title="Aucun scan pour l'instant" />
            ) : (
              <ul className="mini-list">
                {history.map((h) => (
                  <li key={h.id} className="mini-list-item">
                    <div>
                      <span className="cell-primary truncate">{h.detail && h.outcome === "success" ? h.detail : h.title}</span>
                      <span className="cell-secondary ref">{h.code}</span>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <StatusBadge tone={h.outcome === "success" ? "success" : h.outcome === "refused" ? "danger" : "warning"}>
                        {h.outcome === "success" ? "Validé" : h.outcome === "refused" ? "Refusé" : "Non validé"}
                      </StatusBadge>
                      <span className="cell-secondary">{formatTime(h.time)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
