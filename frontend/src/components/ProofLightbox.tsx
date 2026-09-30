"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RotateCcw, X } from "lucide-react";

interface ProofLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const STEP = 0.5;

function clamp(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * Affichage plein écran de la capture Wave (ProofModal) : zoom par boutons,
 * molette ou clic, déplacement par glisser une fois zoomé, Échap pour fermer.
 * À l'échelle 1 l'image tient dans l'écran ; au-delà, sa largeur est un
 * multiple de cette largeur « ajustée » et le conteneur défile.
 */
export default function ProofLightbox({ src, alt, onClose }: ProofLightboxProps) {
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => clamp(s + STEP));
      } else if (e.key === "-") {
        setScale((s) => clamp(s - STEP));
      } else if (e.key === "0") {
        setScale(1);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // La molette zoome plutôt que de faire défiler (listener non passif pour preventDefault).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) => clamp(s + (e.deltaY < 0 ? STEP : -STEP)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function measureFit() {
    if (scale === 1 && imgRef.current) setFitWidth(imgRef.current.getBoundingClientRect().width);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  }

  function onImageClick() {
    // Un glisser ne doit pas être pris pour un clic de zoom.
    if (drag.current?.moved) return;
    setScale((s) => (s === 1 ? 2 : 1));
  }

  const zoomed = scale > 1 && fitWidth !== null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Capture du paiement en plein écran">
      <div className="lightbox-toolbar">
        <button type="button" aria-label="Dézoomer" disabled={scale <= MIN_SCALE} onClick={() => setScale((s) => clamp(s - STEP))}>
          <Minus size={18} strokeWidth={2.4} />
        </button>
        <span className="lightbox-scale">{Math.round(scale * 100)} %</span>
        <button type="button" aria-label="Zoomer" disabled={scale >= MAX_SCALE} onClick={() => setScale((s) => clamp(s + STEP))}>
          <Plus size={18} strokeWidth={2.4} />
        </button>
        <button type="button" aria-label="Taille ajustée" disabled={scale === 1} onClick={() => setScale(1)}>
          <RotateCcw size={18} strokeWidth={2.4} />
        </button>
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans un nouvel onglet">
          <ExternalLink size={18} strokeWidth={2.4} />
        </a>
        <button type="button" aria-label="Fermer" onClick={onClose}>
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`lightbox-viewport${zoomed ? " zoomed" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerLeave={() => (drag.current = null)}
        onClick={(e) => {
          if (e.target === e.currentTarget && !drag.current?.moved) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={measureFit}
          onClick={onImageClick}
          style={zoomed ? { width: fitWidth * scale, maxWidth: "none", maxHeight: "none" } : undefined}
        />
      </div>
    </div>
  );
}
