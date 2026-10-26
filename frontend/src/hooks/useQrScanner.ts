"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export type CameraState = "off" | "starting" | "live" | "error";

// Décodage cadencé (≈ 8 images/s) sur une image réduite : suffisant pour un
// QR présenté face caméra, et bien plus sobre en batterie qu'un décodage
// pleine résolution à chaque frame sur un téléphone d'entrée de gamme.
const DECODE_INTERVAL_MS = 120;
const DECODE_MAX_WIDTH = 640;

function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La caméra exige une connexion sécurisée (HTTPS). Utilisez la saisie manuelle.";
  }
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Accès à la caméra refusé. Autorisez-la dans les réglages du navigateur, ou utilisez la saisie manuelle.";
    }
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return "Aucune caméra détectée sur cet appareil. Utilisez la saisie manuelle.";
    }
    if (err.name === "NotReadableError") {
      return "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.";
    }
  }
  return "Caméra indisponible. Utilisez la saisie manuelle.";
}

interface UseQrScannerOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** Suspend le décodage (ex. pendant la validation serveur d'un code). */
  paused: boolean;
  onDecode: (value: string) => void;
}

export function useQrScanner({ videoRef, enabled, paused, onDecode }: UseQrScannerOptions) {
  const [state, setState] = useState<CameraState>("off");
  const [error, setError] = useState<string | null>(null);
  const onDecodeRef = useRef(onDecode);
  const pausedRef = useRef(paused);

  useEffect(() => {
    onDecodeRef.current = onDecode;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!enabled) return;
    const videoEl = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame: number | null = null;
    let lastDecode = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || !ctx || pausedRef.current || now - lastDecode < DECODE_INTERVAL_MS) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA || !video.videoWidth) return;
      lastDecode = now;
      const scale = Math.min(1, DECODE_MAX_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (code?.data) onDecodeRef.current(code.data);
    }

    // Tout setState passe par les callbacks asynchrones (pas dans le corps de l'effet).
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setState("starting");
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("unsupported", "NotSupportedError");
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      })
      .then(async (media) => {
        if (!media) return;
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        if (videoEl) {
          videoEl.srcObject = media;
          await videoEl.play().catch(() => undefined);
        }
        setState("live");
        frame = requestAnimationFrame(tick);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(cameraErrorMessage(err));
        setState("error");
      });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
      setState("off");
    };
  }, [enabled, videoRef]);

  return { state, error };
}
