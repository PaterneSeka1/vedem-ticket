"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, ShoppingBag, TicketX } from "lucide-react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import PurchaseHeader from "@/components/public/PurchaseHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import EmptyState, { ErrorState } from "@/components/ui/EmptyState";
import PaymentSummary from "@/components/ui/PaymentSummary";
import QuantityStepper from "@/components/ui/QuantityStepper";
import Skeleton from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCart } from "@/context/CartContext";
import { isSoldOut, remainingPlaces } from "@/lib/categories";
import { currencyLabel, formatNumber, money, plural } from "@/lib/format";

export default function TicketsPage() {
  const router = useRouter();
  const {
    categories,
    loading,
    error,
    reload,
    quantities,
    setQuantity,
    maxQuantityFor,
    items,
    total,
    totalQuantity,
    waveFees,
    eventDate,
    eventLocation,
  } = useCart();

  const canContinue = totalQuantity > 0;

  return (
    <div className="public-page">
      <SiteHeader hideCta />
      <PurchaseHeader current={0} backHref="/" backLabel="Accueil" />
      <main id="contenu" className="container">
        <div className="flow-title">
          <span className="eyebrow">Billetterie officielle</span>
          <h1>Choisissez vos billets</h1>
          <p>Sélectionnez une ou plusieurs catégories et la quantité souhaitée. Aucun compte n&apos;est nécessaire.</p>
        </div>

        <div className="flow-grid">
          <section aria-label="Catégories de billets">
            {loading && (
              <div className="product-list" role="status" aria-label="Chargement des billets">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="product-card">
                    <div style={{ display: "grid", gap: 10 }}>
                      <Skeleton width="40%" height={22} />
                      <Skeleton width="70%" height={12} />
                      <Skeleton width="25%" height={18} />
                    </div>
                    <Skeleton width={120} height={44} radius={12} />
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <Card>
                <ErrorState title="Impossible de charger les billets" message={error} onRetry={reload} />
              </Card>
            )}

            {!loading && !error && categories.length === 0 && (
              <Card>
                <EmptyState
                  icon={TicketX}
                  title="Aucun billet en vente pour le moment"
                  description="La billetterie n'est pas encore ouverte. Revenez un peu plus tard."
                />
              </Card>
            )}

            {!loading && !error && categories.length > 0 && (
              <ul className="product-list" role="list">
                {categories.map((category) => {
                  const qty = quantities[category.id] ?? 0;
                  const soldOut = isSoldOut(category);
                  const max = maxQuantityFor(category);
                  const remaining = remainingPlaces(category);
                  return (
                    <li
                      key={category.id}
                      className="product-card"
                      data-selected={qty > 0 || undefined}
                      data-soldout={soldOut || undefined}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="product-card-head">
                          <h2>{category.name}</h2>
                          {soldOut ? (
                            <StatusBadge tone="danger">Épuisé</StatusBadge>
                          ) : (
                            remaining !== null && (
                              <StatusBadge tone={remaining <= 10 ? "warning" : "gold"}>
                                {remaining <= 10
                                  ? `Plus que ${remaining} place${remaining > 1 ? "s" : ""}`
                                  : `${formatNumber(remaining)} places disponibles`}
                              </StatusBadge>
                            )
                          )}
                        </div>
                        {category.description && <p>{category.description}</p>}
                        <div className="product-card-price">
                          {formatNumber(category.price)}
                          <small>{currencyLabel(category.currency)}</small>
                        </div>
                        {category.chargeWaveFees && (
                          <p style={{ marginTop: 4, fontSize: "var(--text-xs)" }}>+ frais Wave de 1 % au paiement</p>
                        )}
                      </div>
                      <div className="product-card-side">
                        <span className="product-card-subtotal" aria-hidden="true">
                          {qty > 0 ? money(category.price * qty) : ""}
                        </span>
                        <QuantityStepper
                          value={qty}
                          onChange={(value) => setQuantity(category.id, value)}
                          itemLabel={category.name}
                          max={max}
                          disabled={soldOut}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="flow-aside collapsible-mobile" aria-label="Votre commande">
            <Card>
              <SectionHeader title="Votre commande" description={plural(totalQuantity, "billet")} />
              <div className="card-body">
                {items.length === 0 ? (
                  <EmptyState
                    compact
                    icon={ShoppingBag}
                    title="Panier vide"
                    description="Ajoutez des billets pour voir le récapitulatif."
                  />
                ) : (
                  <PaymentSummary
                    lines={items.map((line) => ({
                      key: line.category.id,
                      name: line.category.name,
                      quantity: line.quantity,
                      unitPrice: line.category.price,
                    }))}
                    waveFees={waveFees}
                    totalLabel="Total estimé"
                  />
                )}
                <div className="event-recap">
                  <div>
                    <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
                    {eventDate}
                  </div>
                  <div>
                    <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                    {eventLocation}
                  </div>
                </div>
                <Link
                  href="/checkout"
                  className="btn btn-primary btn-lg btn-block"
                  aria-disabled={!canContinue}
                  onClick={(event) => {
                    if (!canContinue) event.preventDefault();
                  }}
                >
                  Continuer <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      </main>

      <div className="cart-bar">
        <div>
          <span>{plural(totalQuantity, "billet")}</span>
          <strong>{money(total + waveFees)}</strong>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!canContinue}
          onClick={() => router.push("/checkout")}
        >
          Continuer <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <SiteFooter eventDate={eventDate} eventLocation={eventLocation} />
    </div>
  );
}
