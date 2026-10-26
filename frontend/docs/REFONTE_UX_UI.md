# Refonte UX/UI — VEDEM Ticket

Branche `refactor/premium-ux-ui`. Périmètre : **frontend uniquement**. Aucun fichier backend, schéma Prisma ou donnée n'a été modifié.

## 1. Audit initial

### 1.1 Problèmes par interface

| Interface | Problème | Conséquence | Amélioration apportée | Priorité |
|---|---|---|---|---|
| Accueil | Hero unique sans contenu (date/lieu en texte brut), footer minimal, ~40 % du CSS mort (anciens hero, grilles, CTA) | Page peu informative, image « template » | Hero éditorial, billet stylisé (données réelles), section billets issue de l'API, parcours en 4 étapes, footer structuré | Haute |
| Catalogue | Icônes-lettres codées en dur par nom, Tombola affichée, `stock` interprété comme un reste alors que c'est une capacité, barre fixe recouvrant le contenu sur desktop, libellés « Augmenter » sans nom de catégorie, panier perdu au rechargement | Information trompeuse, accessibilité faible | Cartes de catégories, badge « Places limitées » (et non un faux reste), récapitulatif latéral desktop / barre fixe mobile, panier conservé en `sessionStorage`, Tombola masquée | Haute |
| Checkout | **Frais Wave absents** du récapitulatif, aucune validation en ligne, panier vide = formulaire vide sans explication | Montant affiché ≠ montant Wave | Étapes, validation accessible (`aria-invalid`, messages reliés), sous-total + frais Wave + total, état « panier vide » | Haute |
| Paiement Wave (`/success`) | **Montant affiché hors frais Wave** alors que le lien Wave les inclut ; identifiant Mongo complet affiché ; « Étape 3 sur 3 » incohérent | Acheteur induit en erreur sur le montant | Chronologie en 5 étapes, montant issu de `POST /payments/wave/checkout` (frais compris), mention explicite que la capture ne vaut pas confirmation, code copiable, référence courte | Critique |
| Récupération des billets | Nom de catégorie vide pour une catégorie réservée aux invitations ; saisie du code non assistée | Billet VVIP sans catégorie | Saisie formatée `XXXX-XXXX`, libellé de repli « Billet », messages 403/404/429 distincts, nouveau billet imprimable (QR agrandi sur mobile) | Moyenne |
| Dashboard | KPI Tombola ; **répartition Wave/espèces comptant les invitations comme des espèces**, calculée en nombre et non en montant ; zéros affichés pendant le chargement ; en-tête « Bonjour » répété partout | Indicateurs faux ou trompeurs | Indicateurs recalculés (`lib/metrics.ts`), répartition en montants, invitations séparées, squelettes, actions rapides | Critique |
| Transactions | **Recherche qui plante dès qu'une invitation existe** (`buyerPhone` null) ; invitations libellées « Espèces » ; **montant attendu hors frais Wave** dans la vérification (risque de refuser un paiement correct) ; pas de pagination ni de tri ; 8 colonnes sur mobile | Plantage, erreurs de vérification | Tableau trié/paginé, filtres (statut en segments avec compteurs, moyen dont Invitation), recherche robuste, tiroir de détail/vérification avec montant frais compris et enchaînement « Vérifier le suivant », cartes sur mobile | Critique |
| Billets | Pas de pagination, pas de compteurs, pas de distinction vente/invitation | Liste difficile à exploiter | Segments par statut, filtres catégorie/origine, pagination, tiroir de détail imprimable | Moyenne |
| Scanner | Rechargement des 5 jeux de données après chaque scan ; erreur réseau indiscernable d'un refus ; décodage plein cadre à chaque image ; pas de compteur | Lenteur à l'entrée, faux refus | Mise à jour locale du billet scanné, résultat « Non validé — réseau » distinct avec relance, décodage réduit et cadencé, pause pendant la validation serveur, vibration, compteur, historique de session, détection hors ligne, erreurs caméra détaillées | Haute |
| Paramètres | Option « frais Wave » supportée par l'API mais absente de l'interface ; Tombola listée | Réglage métier inaccessible | Sections, aperçu date/lieu, détection des modifications, catégorie : frais Wave, invitations, capacité ; Tombola masquée avec mention de sa conservation | Moyenne |
| Transverse | CSS unique minifié avec `!important`, styles en ligne, modales sans piège de focus ni verrou de défilement, `outline: none` sans remplacement, **vente espèces impossible sur mobile** (boutons masqués sous 900 px), `handleUnauthorized` dupliqué dans 6 fichiers | Maintenance coûteuse, accessibilité et usage mobile dégradés | Design system à tokens, dialogue accessible unique, focus visible, navigation mobile dédiée, hook `useAdminSession` | Haute |

### 1.2 Dépendances backend analysées (sans modification)

Commandes ↔ paiements (`Payment.status` règle `Order.status`), frais Wave figés sur `Order.waveFees`, invitations (`method: INVITATION`, `totalAmount: 0`), billets générés à la confirmation, code de téléchargement actif seulement si commande `paid`, scan atomique (409 sur second scan), stock = capacité totale (le reste disponible n'est pas exposé).

## 2. Design system

- **Tokens** : `src/styles/tokens.css` — couleurs de marque (marine/cyan du logo, or du Gala), neutres, surfaces, texte, bordures, états métier, couleurs par moyen de paiement, typographie, espacements (base 4 px), rayons, ombres, focus, transitions, z-index, breakpoints documentés.
- **Typographie** : Inter (interface, chiffres tabulaires) + Fraunces (titres publics et billet), via `next/font`.
- **Contrastes** : texte blanc jamais posé sur le cyan de marque (contraste insuffisant) — actions principales en marine, liens en cyan foncé.
- **Mouvement** : transitions courtes, désactivées par `prefers-reduced-motion`.
- **Feuilles** : `base.css`, `components.css`, `public.css`, `admin.css`, `ticket.css` (billet + impression). `globals.css` ne fait plus que les importer.

### Bibliothèques évaluées

| Bibliothèque | Décision | Raison |
|---|---|---|
| Tailwind CSS 4 | Installée mais non utilisée (inchangé) | Le projet était en CSS natif ; un système à tokens couvre le besoin sans réécrire en utilitaires |
| shadcn/ui, Radix UI | Non retenues | Les quelques primitives nécessaires (dialogue, menu) sont implémentées et accessibles en ~250 lignes |
| Lucide React | Conservée | Déjà présente |
| TanStack Table / Query | Non retenues | Un seul événement, volumes de quelques milliers de lignes déjà chargés en mémoire |
| Recharts | Non retenue | Deux visualisations simples (barre empilée, barres de progression) en CSS |
| React Hook Form + Zod | Non retenues | Formulaires courts ; validation dérivée de l'état |

**Aucune nouvelle dépendance.**

## 3. Composants

**Créés** (`src/components/ui/`) : `Dialog` (dialogue / tiroir / feuille mobile — focus piégé et restitué, Échap, pile de dialogues, verrou de défilement), `DataTable` (tri `aria-sort`, pagination, lignes activables au clavier, cartes sur mobile, colonnes secondaires), `Pagination`, `FilterToolbar` / `SearchInput` / `SegmentedFilter`, `ActionMenu`, `FormField`, `StatCard`, `StatusBadge` / `MethodTag`, `Card` / `SectionHeader`, `EmptyState` / `ErrorState`, `Skeleton`, `QuantityStepper`, `Steps` / `Timeline`, `PaymentSummary`, `CopyButton`.

**Publics** (`src/components/public/`) : `SiteHeader`, `SiteFooter`, `PurchaseHeader`.

**Administration** (`src/components/admin/`) : `AdminShell` (sidebar desktop, rail tablette, barre basse + menu mobile, topbar contextualisée), `AdminSidebar`, `SaleDialog` (vente espèces / invitation, remplace `CashModal`), `PaymentDrawer` (remplace `ProofModal`), `TicketDrawer` (remplace `AdminTicketModal`), `CategoryDialog` (remplace `CategoryModal`), `ProofLightbox`, `nav.ts`.

**Réutilisés et refondus** : `TicketCard` (TicketPreview), `TicketBundle`, contextes `Cart`, `AdminData`, `Confirm`, `Toast`.

**Supprimés** : `Topbar`, `AdminDashboardShell`, `CashModal`, `ProofModal`, page Tombola.

## 4. Architecture

- `lib/metrics.ts` : calcul pur des indicateurs (déduplication par commande, invitations exclues du chiffre d'affaires, frais Wave exclus, catégories historiques incluses).
- `lib/categories.ts` : masquage Tombola, estimation des frais Wave (miroir du calcul serveur, indicatif), statut « épuisé ».
- `lib/payments.ts` : libellés et tons des statuts et moyens de paiement.
- `hooks/useAdminSession.ts` : gestion unique d'une session expirée (401).
- `hooks/useQrScanner.ts` : caméra + décodage QR.
- `AdminDataContext` : ajout de `ready`, `lastUpdatedAt` et `markTicketUsed` (mise à jour locale après un scan).
- Transactions : filtre de statut et transaction ouverte portés par l'URL (`?status=pending&payment=…`), ce qui permet des liens directs depuis la vue générale.
- `next.config.ts` : redirection temporaire `/admin/dashboard/tombola` → `/admin/dashboard`.

## 5. Tombola

- Masquée du catalogue public, de l'accueil, de la vente espèces / invitation et de la liste des catégories en paramètres (avec mention de sa conservation).
- **Conservée** dans les recettes, la répartition, les transactions, la liste des billets et la vue « Billets par catégorie » (libellée « historique ») : aucun revenu encaissé n'est masqué.
- **Limite** : ce masquage n'est **pas** une désactivation métier. `POST /orders` accepte toujours la catégorie si on l'appelle directement. Une désactivation effective nécessite une règle serveur (par exemple capacité à 0 ou passage en `invitationOnly`), hors périmètre de cette mission.

## 6. Sécurité

- **Secrets versionnés** : `backend/.env.bak-atlas` et `backend/.env.bak-20261002` sont suivis par git. Ils contiennent un `JWT_SECRET` et, pour le premier, une URL MongoDB Atlas **avec identifiants**. Actions recommandées : rotation du mot de passe de l'utilisateur Atlas (ou suppression du cluster s'il n'est plus utilisé), rotation du `JWT_SECRET` de production s'il correspond, retrait des fichiers de l'index (`git rm --cached`) et ajout de `.env*` au `.gitignore` du backend, puis purge de l'historique si le dépôt est ou devient public. **Non effectué ici** : cela touche au backend et à l'historique git, et demande une validation.
- Le token admin reste en `localStorage` (comportement existant) : il est exposé à toute faille XSS. Aucun vecteur XSS n'a été introduit (aucun `dangerouslySetInnerHTML`).
- Inchangés : authentification, garde des routes `/admin/dashboard/**`, validations serveur, confirmation manuelle des paiements, accès aux billets par code uniquement.

## 7. Vérifications

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | OK |
| `npm run lint` | OK, 0 alerte |
| `next build` | OK, 17 routes |
| Tests backend (`npm test`) | 73/73 (backend non modifié) |
| Rendu réel (Playwright + Chromium) | Accueil, catalogue, checkout, paiement, mes billets, vue générale, transactions, vérification Wave, billets, scanner, vente espèces, paramètres — à 320, 375/390, 768/820, 1024, 1280 et 1440 px |
| Débordement horizontal de page | Aucun aux largeurs testées (scan automatique des éléments) |
| Indicateurs financiers | Recalculés à la main sur un jeu d'essai : recettes, répartition, montant attendu et nombre d'invitations conformes |

Les captures ont été produites avec une **API factice locale** (données d'exemple, hors dépôt), jamais avec des données clients ni en production.

**Non vérifié** : parcours de bout en bout contre le vrai backend et MongoDB (pas d'environnement local disponible), caméra physique (le scanner a été testé en saisie manuelle), impression papier réelle, audit automatisé axe/Lighthouse, lecteurs d'écran.

## 8. Limites restantes

- La capacité restante d'une catégorie n'est pas exposée par l'API publique : le catalogue ne peut pas afficher « X places restantes ». Le serveur reste juge (400 si stock insuffisant).
- `POST /orders/access` ne renvoie pas le nom des catégories : une catégorie réservée aux invitations s'affiche « Billet » côté acheteur. Correctif backend simple suggéré : inclure `categoryName` par billet.
- Le message 409 du scan est reformaté côté client à partir du texte du backend.
- Le message 403 de `/orders/access` (tutoiement côté backend) est remplacé par un texte au vouvoiement côté client.
