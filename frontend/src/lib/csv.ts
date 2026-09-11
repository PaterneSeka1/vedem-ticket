// Export CSV minimal, côté client : les données sont déjà en mémoire (chargées
// via l'API), pas besoin d'un aller-retour serveur pour les réexporter.

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Toute cellule contenant un guillemet, une virgule ou un retour à la ligne
  // doit être entourée de guillemets (RFC 4180), guillemets internes doublés.
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  // BOM UTF-8 en tête : Excel (Windows) sans ça interprète les accents en latin1.
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(";"));
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
