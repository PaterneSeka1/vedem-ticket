# VEDEM Ticket

## 1. Objectif
Application de vente et de gestion de tickets pour un événement, avec paiement via Wave (mobile money) ou en espèces, génération de tickets avec QR code, et validation à l'entrée.

**Périmètre actuel : backend uniquement** (`backend/`). Le frontend (`frontend/`) est traité séparément et n'est pas dans le scope de ce document.

## 2. Stack technique

- NestJS (TypeScript)
- Prisma "Next" (`@prisma/orm-mongo`) — contrat MongoDB, pas le Prisma Client classique
- MongoDB Atlas
- Wave (mobile money) — lien de paiement marchand + capture du paiement, confirmée manuellement par l'admin
- Déploiement : frontend sur Vercel, backend sur un serveur OVH (Ubuntu, Nginx + systemd — o2switch mutualisé écarté : port MongoDB sortant bloqué, confirmé par leur support) — voir [`DEPLOYMENT.md`](DEPLOYMENT.md)

## 3. Architecture

### Backend
- NestJS, modules par domaine : `Auth` (admin), `Tickets` (catégories), `Orders` (commandes), `Payments` (Wave + espèces).
- Accès aux données via le "contract" Prisma (`backend/src/prisma/contract.prisma`) et `backend/src/prisma/db.ts` — jamais d'accès MongoDB direct hors escape hatch documenté.
- Un seul administrateur, authentifié par username/password (modèle `User`).
- Documentation API : Swagger/OpenAPI sur `/docs` (`SWAGGER_ENABLED=0` pour la désactiver). Générée depuis les DTO (`class-validator` + plugin `@nestjs/swagger` dans `nest-cli.json`) et les décorateurs `@ApiTags`/`@ApiOperation`/`@ApiBearerAuth` des contrôleurs — à ajouter sur tout nouvel endpoint.

### Frontend
Hors scope de ce document (voir `frontend/CLAUDE.md`).

### Base de données
MongoDB (Atlas en production). Contrat défini dans [`backend/src/prisma/contract.prisma`](backend/src/prisma/contract.prisma).

## 4. Règles métier

### Achat de tickets
- Achat **sans compte** : l'acheteur renseigne ses informations (nom, téléphone, email) au moment de la commande, sans inscription ni connexion.
- **Un seul événement** est géré par l'application, avec plusieurs catégories de tickets (ex. Standard, VIP), chacune avec son propre prix et éventuellement un stock limité.
- Une commande peut porter sur plusieurs tickets (quantité) et sur **plusieurs catégories différentes** (ex. 2 Standard + 1 VIP dans la même commande).

### Informations de l'événement
- Date et lieu sont **configurables par l'admin** (`GET`/`PATCH /event-settings`, consultation publique, modification protégée) et s'appliquent **partout sans exception** : page d'accueil, checkout, et tickets déjà émis (valeur toujours lue à jour au moment de l'affichage/impression, jamais figée dans le ticket au moment de l'achat).

### Paiements
- Deux moyens de paiement : **Wave** (mobile money) et **espèces**.
- Wave : **pas d'API ni de webhook**. L'acheteur ouvre le lien de paiement marchand Wave (`WAVE_PAYMENT_URL`, montant de la commande pré-rempli), paie, puis envoie une **capture d'écran** du paiement comme preuve. Le paiement reste `pending` (« en attente de confirmation ») jusqu'à ce que l'admin vérifie la capture et le **confirme** (→ `success`, génération des tickets) ou le **refuse** (→ `failed`, la commande reste `pending` et l'acheteur peut renvoyer une capture).
- Espèces : paiement enregistré manuellement par l'administrateur depuis le dashboard, ce qui déclenche la génération des tickets.
- Statuts de paiement : `pending`, `success`, `failed`.
- Capture : JPEG, PNG ou WebP (type vérifié sur le contenu), 5 Mo maximum, stockée dans la collection `payment_proofs` (séparée de `payments`). Tant que le paiement est `pending`, un nouvel envoi remplace la capture.
- Suivi acheteur (`/success?orderId=…`) : paiement, envoi de la capture, suivi de la validation. Ne donne **pas** accès aux tickets.

### Tickets d'invitation (personnalités)
- En plus des tickets payants (Wave/espèces), l'admin peut offrir des **tickets d'invitation** à des personnes spéciales (personnalités), sans aucun paiement.
- Créés en un seul appel admin (`POST /payments/invitation`) : commande + génération des tickets immédiate, matérialisés par un `Payment` de méthode `INVITATION` et de statut `success` (aucun montant réel encaissé).
- `totalAmount` de la commande reste à **0** (aucune valeur affichée), quelle que soit la catégorie choisie.
- Le téléphone de l'invité (`buyerPhone`) est **optionnel**, contrairement à une commande payante.
- Une invitation **ignore le stock** de sa catégorie (jamais bloquée par une catégorie épuisée) et **ne compte pas** dans le stock vu par les acheteurs payants (`TicketCategoriesService.countSold` exclut les commandes réglées par une invitation).

### Tickets
- Un ticket est généré **uniquement** après confirmation d'un paiement (Wave, espèces, ou invitation admin sans paiement réel — voir ci-dessus).
- Chaque ticket a un code unique matérialisé par un **QR code**.
- **Code de téléchargement** : chaque commande reçoit à sa création un code unique (8 caractères, affiché `XXXX-XXXX`), remis à l'acheteur avec le lien de la page `/mes-tickets`. Le code n'est **actif qu'une fois la transaction validée par l'admin** (commande `paid`) : avant, `POST /orders/access` le refuse (403). C'est le seul moyen public de récupérer les tickets — la route publique `GET /orders/:id` ne renvoie ni les tickets ni le code. L'admin voit le code dans le dashboard (pour le renvoyer au client) et récupère les tickets via `GET /orders/:id/tickets`.
- Validation à l'entrée : scan du QR code, qui marque le ticket comme utilisé et empêche toute réutilisation.
- Statuts de ticket : `valid`, `used`, `cancelled`.

## 5. Modèles de données

### User (administrateur)
- `username`, `password` (hashé) — un seul compte, pas d'inscription publique.

### TicketCategory
- `name`, `price`, `currency`, `stock` (optionnel), `description` (optionnel).

### EventSettings
- `date`, `location` — un seul document (un seul événement), créé avec des valeurs par défaut au premier appel s'il n'existe pas encore.

### Order (commande)
- Infos acheteur : `buyerName`, `buyerPhone` (optionnel — absent pour une invitation, obligatoire sinon au niveau DTO), `buyerEmail` (optionnel).
- `accessCode` : code de téléchargement des tickets, invitations comprises (absent sur les commandes antérieures à son introduction).
- `items` (liste de `{ ticketCategoryId, quantity }`, une ou plusieurs catégories différentes), `totalAmount` (0 pour une invitation), `status` (`pending`/`paid`/`failed`), horodatage.

### Payment
- `orderId`, `method` (`WAVE`/`CASH`/`INVITATION`), `status` (`pending`/`success`/`failed`), horodatage de confirmation, admin ayant confirmé (`waveReference` : hérité de l'ancienne intégration API, plus renseigné).

### PaymentProof
- `paymentId`, `mimeType`, `data` (image en base64), `createdAt` — capture d'un paiement Wave.

### Ticket
- `orderId`, `ticketCategoryId`, `code` unique (contenu du QR), `status` (`valid`/`used`/`cancelled`), `usedAt`, admin ayant scanné.

## 6. Parcours utilisateur

1. L'acheteur consulte les catégories de tickets disponibles.
2. Il choisit une ou plusieurs catégories, chacune avec sa propre quantité.
3. Il renseigne ses informations et choisit un moyen de paiement (Wave ou espèces sur place).
4. Paiement Wave : lien de paiement Wave → capture envoyée par l'acheteur → paiement en attente de confirmation → confirmation par l'admin → génération des tickets (QR codes), téléchargeables sur `/mes-tickets` avec le code de téléchargement remis à la commande.
   Paiement espèces : commande en attente jusqu'à confirmation manuelle par l'admin.
5. À l'entrée, le QR code de chaque ticket est scanné pour validation.

## 7. Administration

- Un seul administrateur, authentification par username/password.
- Dashboard privé : suivi des commandes/paiements, vérification des captures et confirmation/refus des paiements Wave, confirmation des paiements espèces, génération manuelle de tickets, création de tickets d'invitation pour des personnalités, scan/validation des tickets.

## 8. Contraintes importantes pour Claude Code

Claude doit :

- respecter strictement les règles métier ci-dessus ;
- ne pas inventer de fonctionnalités non actées dans ce document ;
- réutiliser les composants existants (`backend/src/prisma/contract.prisma`, modules NestJS existants) ;
- utiliser TypeScript strict ;
- utiliser le contract Prisma (MongoDB) pour tous les accès à la base ;
- vérifier les erreurs avant de modifier plusieurs fichiers ;
- se concentrer sur `backend/` sauf demande explicite contraire ;
- pour tout nouveau DTO exposé via `@Body()` : décorateurs `class-validator` (le `ValidationPipe` global — `whitelist` + `forbidNonWhitelisted` — rejette sinon les champs en trop) ;
- pour toute nouvelle route d'écriture publique (sans `JwtAuthGuard`) : ajouter `@UseGuards(RateLimit(n, windowMs))` (voir `backend/src/common/rate-limit.guard.ts`) ;
- pour tester la logique métier d'un service qui importe `db` directement : mocker `../prisma/db.js` avec `createFakeDb()` (voir `backend/src/test/fake-db.ts` et les specs existants) plutôt que de viser une vraie base.

## 9. Ordre d'implémentation

### Étape 1 — Modèle de données — ✅ fait
Étendre `contract.prisma` : `TicketCategory`, `Order`, `Payment`, `Ticket`. Régénérer le contrat (`npm run contract:emit`).

### Étape 2 — Authentification admin — ✅ fait
Implémenter `AuthModule` (hash du mot de passe, login, session/JWT), protéger les routes du dashboard.

### Étape 3 — Commandes & tickets — ✅ fait
Endpoints de création de commande, génération des tickets après paiement confirmé, génération des QR codes.

### Étape 4 — Paiements — ✅ fait
Intégration Wave (checkout + webhook signé), confirmation manuelle des paiements espèces côté admin.

### Étape 5 — Validation à l'entrée — ✅ fait
Endpoint de scan/validation de QR code, marquage "utilisé".

## 10. Critères de validation

- [x] Le projet compile.
- [x] Le contract Prisma (MongoDB) fonctionne — vérifié en direct sur le cluster Atlas.
- [ ] Les paiements Wave sont confirmés par l'admin sur capture — logique couverte par les tests unitaires (envoi/remplacement de capture, confirmation idempotente, refus) ; parcours complet à vérifier en direct.
- [x] Les paiements espèces peuvent générer des tickets — vérifié en direct.
- [x] Le dashboard est réservé à l'administrateur — vérifié (401 sans token).
- [x] Un ticket ne peut être validé (scanné) qu'une seule fois — vérifié en direct (409 sur un second scan).
