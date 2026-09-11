"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { useRouter } from "next/navigation";

interface ScanResponse {
  ticket: { code: string; status: string; usedAt: string | null };
  buyerName: string | null;
  categoryName: string | null;
}

interface ScanEvent {
  code: string;
  ok: boolean;
  message: string;
  detail: string | null;
  time: number;
}

// Le même code ne redéclenche pas de scan pendant ce délai : le flux caméra
// continue de "voir" le QR pendant plusieurs frames tant qu'il reste dans le
// champ, il ne faut pas le soumettre en boucle.
const RESCAN_COOLDOWN_MS = 2500;

export default function AccessControlPage() {
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const { refresh } = useAdminData();
  const toast = useToast();

  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; detail: string | null } | null>(
    null,
  );
  const [history, setHistory] = useState<ScanEvent[]>([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleUnauthorized() {
    toast.error("Session expirée — reconnecte-toi.");
    logout();
    router.replace("/admin/login");
  }

  // Point d'entrée unique des scans, qu'ils viennent du champ manuel (douchette
  // ou saisie clavier) ou du décodage caméra.
  const runScan = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || !token) return;

      const now = Date.now();
      if (lastScanRef.current?.code === trimmed && now - lastScanRef.current.at < RESCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { code: trimmed, at: now };

      setSubmitting(true);
      try {
        const res = await apiFetch<ScanResponse>(`/tickets/${encodeURIComponent(trimmed)}/scan`, {
          method: "PATCH",
          token,
        });
        const detail = [res.buyerName, res.categoryName].filter(Boolean).join(" • ") || null;
        const result = { ok: true, message: "Ticket validé — entrée autorisée.", detail };
        setLastResult(result);
        setHistory((prev) => [{ code: trimmed, ...result, time: now }, ...prev].slice(0, 30));
        refresh(); // met à jour le comptage "Entrées" / statut du ticket ailleurs dans le dashboard
      } catch (err) {
        if (isUnauthorized(err)) {
          handleUnauthorized();
          return;
        }
        const message = err instanceof ApiError ? err.message : "Erreur de validation.";
        const result = { ok: false, message, detail: null };
        setLastResult(result);
        setHistory((prev) => [{ code: trimmed, ...result, time: now }, ...prev].slice(0, 30));
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    runScan(manualCode);
    setManualCode("");
    inputRef.current?.focus();
  }

  // Boucle de décodage : capture une frame vidéo dans un canvas hors-écran,
  // tente d'y lire un QR code, recommence à la frame suivante. Fonction
  // nommée (plutôt qu'une référence à la const `decodeLoop`) pour pouvoir
  // s'auto-rappeler sans dépendre de son propre binding externe.
  const decodeLoop = useCallback(
    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        runScan(code.data);
      }
      frameRef.current = requestAnimationFrame(tick);
    },
    [runScan],
  );

  function toggleCamera() {
    // Réinitialisé ici (dans le handler, pas dans l'effect) : évite un
    // setState synchrone au corps de l'effect pour une valeur qui ne dépend
    // que de l'action de l'utilisateur, pas d'une resynchronisation externe.
    setCameraError(null);
    setCameraOn((v) => !v);
  }

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        frameRef.current = requestAnimationFrame(decodeLoop);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            ? "Accès caméra refusé — autorisez la caméra dans votre navigateur, ou utilisez le champ code."
            : "Caméra indisponible sur cet appareil — utilisez le champ code.";
        setCameraError(message);
        setCameraOn(false);
      });

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // decodeLoop ferme déjà sur `runScan` à jour ; le seul déclencheur voulu ici est cameraOn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  return (
    <div className="scan-layout">
      <section className="panel scan-panel">
        <div className="panel-head">
          <div>
            <span>ENTRÉE</span>
            <h2>Scanner un ticket</h2>
          </div>
          <button type="button" onClick={toggleCamera}>
            {cameraOn ? "Désactiver la caméra" : "Activer la caméra"}
          </button>
        </div>

        {cameraError && <div className="cash-error" style={{ marginBottom: 10 }}>{cameraError}</div>}

        {cameraOn && (
          <div className="scan-video-box">
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} hidden />
            <div className="scan-video-frame" />
          </div>
        )}

        <form className="scan-manual" onSubmit={handleManualSubmit}>
          <label>
            Code du ticket
            <input
              ref={inputRef}
              autoFocus
              placeholder="Scannez avec une douchette ou saisissez le code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
          </label>
          <button className="primary" type="submit" disabled={submitting || !manualCode.trim()}>
            {submitting ? "Vérification…" : "Valider l'entrée"}
          </button>
        </form>

        {lastResult && (
          <div className={`scan-result ${lastResult.ok ? "ok" : "error"}`}>
            <b>{lastResult.ok ? "✓" : "✕"} {lastResult.message}</b>
            {lastResult.detail && <span>{lastResult.detail}</span>}
          </div>
        )}
      </section>

      <section className="panel scan-history">
        <div className="panel-head">
          <div>
            <span>SESSION EN COURS</span>
            <h2>Derniers scans</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>Code</th>
                <th>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={`${h.code}-${h.time}-${i}`}>
                  <td>{new Date(h.time).toLocaleTimeString("fr-FR")}</td>
                  <td>{h.code}</td>
                  <td>
                    <span className={`status ${h.ok ? "paid" : "failed"}`}>{h.ok ? "Validé" : "Refusé"}</span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                    Aucun scan pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
