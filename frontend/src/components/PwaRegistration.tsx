"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Impossible d’activer le mode hors connexion.", error);
      });
  }, []);

  return null;
}
