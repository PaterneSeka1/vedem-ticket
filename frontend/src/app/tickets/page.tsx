"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useCart } from "@/context/CartContext";
import { money } from "@/lib/format";

// Icônes/couleurs par nom de catégorie — purement cosmétique, à ajuster si
// l'API ajoute un champ dédié (icon/color) plus tard.
const STYLE_BY_NAME: Record<string, { icon: string; color: string }> = {
  Classique: { icon: "C", color: "blue" },
  VIP: { icon: "V", color: "amber" },
  Tombola: { icon: "T", color: "violet" },
};
function styleFor(name: string) {
  return STYLE_BY_NAME[name] ?? { icon: name.charAt(0).toUpperCase(), color: "blue" };
}

export default function TicketsPage() {
  const router = useRouter();
  const { categories, loading, error, quantities, setQuantity, total, selectedQuantity } = useCart();

  function handleContinue() {
    if (selectedQuantity > 0) router.push("/checkout");
  }

  return (
    <>
      <Topbar />
      <section className="flow-screen">
        <div className="flow-head">
          <Link href="/" className="back">
            ← Retour
          </Link>
          <div>
            <span>ÉTAPE 1 SUR 3</span>
            <b>Choisissez vos tickets</b>
          </div>
          <div className="step-dots">
            <i className="on"></i>
            <i></i>
            <i></i>
          </div>
        </div>

        <div className="flow-body">
          <div className="flow-title">
            <span className="section-kicker">Billetterie officielle</span>
            <h1>Quel ticket souhaitez-vous ?</h1>
            <p>Sélectionnez une formule et indiquez la quantité.</p>
          </div>

          {loading && <p style={{ textAlign: "center", color: "var(--muted)" }}>Chargement des tickets…</p>}
          {error && (
            <p style={{ textAlign: "center", color: "#bd2c2c" }}>
              Impossible de charger les catégories de tickets ({error}).
            </p>
          )}

          {!loading && !error && categories.length === 0 && (
  <p style={{ textAlign: "center", color: "var(--muted)" }}>
    Aucune catégorie de tickets disponible pour l&apos;instant.
  </p>
)}

{!loading && !error && categories.length > 0 && (
  <div className="product-list">
              {categories.map((category) => {
                const qty = quantities[category.id] ?? 0;
                const style = styleFor(category.name);
                const outOfStock = category.stock <= 0;
                return (
                  <article key={category.id} className={`product${qty > 0 ? " selected" : ""}`}>
                    <div className={`product-icon ${style.color}`}>{style.icon}</div>
                    <div className="product-info">
                      <div>
                        <h3>{category.name}</h3>
                        {outOfStock && <span className="popular">ÉPUISÉ</span>}
                      </div>
                      <p>{category.description || "Accès à la soirée du Dîner-Gala."}</p>
                      <b>
                        {new Intl.NumberFormat("fr-FR").format(category.price)} <small>{category.currency}</small>
                      </b>
                    </div>
                    <div className="qty">
                      <button
                        aria-label="Diminuer"
                        onClick={() => setQuantity(category.id, qty - 1)}
                        type="button"
                        disabled={qty === 0}
                      >
                        −
                      </button>
                      <output>{qty}</output>
                      <button
                        aria-label="Augmenter"
                        onClick={() => setQuantity(category.id, qty + 1)}
                        type="button"
                        disabled={outOfStock || qty >= category.stock}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flow-footer">
          <div>
            <span>Total de la commande</span>
            <strong>{money(total)}</strong>
          </div>
          <button className="primary" onClick={handleContinue} disabled={selectedQuantity === 0} type="button">
            Continuer →
          </button>
        </div>
      </section>
    </>
  );
}
