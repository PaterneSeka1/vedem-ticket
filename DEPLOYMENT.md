# Déploiement — VEDEM Ticket

Ce document décrit comment déployer l'application :

- **Frontend** (Next.js, [frontend/](frontend/)) → **Vercel** — déployé :
  [`https://gala-ticket.vercel.app`](https://gala-ticket.vercel.app)
- **Backend** (NestJS, [backend/](backend/)) → **serveur OVH** (Ubuntu, accès
  root, Nginx en reverse proxy + **PM2**) — déployé :
  [`https://api-ticketgala.veilleurdesmedias.org`](https://api-ticketgala.veilleurdesmedias.org)
- **Base de données** → MongoDB **local au serveur OVH** (v7, replica set `rs0`,
  `127.0.0.1` uniquement, instance partagée avec les autres sites), base
  `vedem_ticket` — voir 1.4. Atlas n'est plus utilisé depuis le 2026-09-30
  (il ne contenait que des données de test).

> **Serveur mutualisé** : ce serveur OVH héberge déjà plusieurs autres sites
> (dont un projet `ticket` sans rapport, distinct de celui-ci, sur
> `ticketing.veilleurdesmedias.org`/`api-ticketing.veilleurdesmedias.org` —
> ne pas confondre). Convention déjà en place pour tous les process Node :
> **PM2** (sous l'utilisateur `ubuntu`, démon géré par `pm2-ubuntu.service`),
> pas d'unité systemd dédiée par site — c'est ce que ce projet suit aussi
> (voir 1.5), par cohérence avec l'existant plutôt que la doc originale.
> Le Node.js global du serveur (v20, via NodeSource) n'a pas été changé : il
> est partagé par tous les sites (`ss -ltnp` + `pm2 jlist` pour vérifier
> l'interpréteur des autres process avant d'y toucher) et suffit largement au
> runtime de ce backend — le warning `EBADENGINE` de `prisma`/
> `@prisma/composer-cli` (qui demandent Node ≥22.18) ne concerne que la
> régénération du contrat (`npm run contract:emit`, déjà faite et committée),
> pas `node dist/main.js`.

> **Historique** : un hébergement mutualisé o2switch a été essayé en premier
> pour le backend, mais abandonné — leur support a confirmé que le port
> sortant 27017 (MongoDB) est bloqué en dur sur le mutualisé, sans exception
> possible. D'où le choix d'un serveur OVH déjà disponible, où les connexions
> sortantes ne sont pas restreintes.

Les valeurs entre `<...>` sont des informations pas encore connues (clés Wave,
etc.) — à remplacer une fois disponibles. Aucun secret n'est présent dans ce
dépôt ; tout se configure directement sur le serveur / dans les interfaces
Vercel.

## Vue d'ensemble et ordre de déploiement

Le backend et le frontend référencent chacun l'URL de l'autre
(`CORS_ORIGIN` côté backend, `NEXT_PUBLIC_API_URL` côté frontend), d'où l'ordre recommandé :

1. **Déployer le backend sur OVH en premier**, avec `CORS_ORIGIN` non défini
   (= tout le monde autorisé, comme en dev).
   L'URL de l'API est déjà fixée : `https://api-ticketgala.veilleurdesmedias.org`.
2. **Déployer le frontend sur Vercel**, avec `NEXT_PUBLIC_API_URL` pointant
   vers cette URL. Noter l'URL Vercel définitive (domaine `vercel.app` ou
   domaine personnalisé).
3. **Revenir sur le serveur OVH** et resserrer `CORS_ORIGIN`
   sur l'URL réelle du frontend, puis redémarrer le service.

**Fait** : les deux étapes 1 et 2 sont en place, avec `CORS_ORIGIN` déjà
resserré sur `https://gala-ticket.vercel.app`
(étape 3 anticipée, pas besoin d'un tour supplémentaire tant que ce domaine
Vercel ne change pas).

## 1. Backend sur OVH

### 1.1 Prérequis

- Serveur Ubuntu (22.04/24.04), accès root/sudo par SSH. Nginx tourne déjà
  dessus pour d'autres sites — on ajoute un nouveau *server block* dédié, sans
  toucher aux vhosts existants.
- DNS : un enregistrement **A** pour `api-ticketgala.veilleurdesmedias.org`
  pointant vers l'IP publique du serveur (dans la zone DNS de
  `veilleurdesmedias.org`).
- Node.js ≥ 20 sur le serveur (`node -v` pour vérifier ; sinon voir 1.2).
- `certbot` (+ plugin nginx) pour le SSL — Wave exige des URLs HTTPS pour le
  webhook et les `success_url`/`error_url`.

### 1.2 Installer Node.js (si absent ou trop ancien)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # doit afficher v22.x
```

### 1.3 Récupérer et builder le code

Le dépôt est un monorepo (`frontend/` + `backend/`) : pas besoin de copier
`backend/` ailleurs comme sur cPanel, on peut travailler directement dans le
checkout.

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/PaterneSeka1/vedem-ticket.git gala
sudo chown -R $USER:$USER gala
cd gala/backend
npm install
npm run build
```

> Déployé dans `/var/www/gala` (convention de ce serveur : un dossier par
> site sous `/var/www/`, pas forcément le nom du dépôt Git).

### 1.4 Variables d'environnement

Créer `/var/www/gala/backend/.env` (lu automatiquement par l'app via
`dotenv/config`, cf. [`backend/src/main.ts`](backend/src/main.ts)) — mêmes
clés que [`backend/.env.example`](backend/.env.example) :

- `DATABASE_URL` — **Fait** :
  `mongodb://127.0.0.1:27017/vedem_ticket?replicaSet=rs0` (MongoDB local,
  même convention que les autres sites du serveur ; ne pas utiliser la base
  `ticket`, qui appartient à un autre projet). Schéma créé avec
  `npx prisma db init`. Pas de sauvegarde automatique comme sur Atlas :
  voir la sauvegarde par `mongodump` en 1.10.
- `JWT_SECRET` — secret dédié à la prod (`openssl rand -base64 48`). **Fait**.
- `PORT` — port interne sur lequel l'app écoute : **`4010`** (3000-3004,
  4000, 8787, 9000-9001 déjà pris par d'autres sites sur ce serveur —
  toujours vérifier avec `ss -ltnp` avant de choisir). Nginx y fait suivre le
  trafic (voir 1.6).
- `WAVE_PAYMENT_URL` — lien de paiement marchand Wave : `https://pay.wave.com/m/M_ci_cIMfFYkj7DER/c/ci/`. **Fait**.
  Le backend y ajoute `?amount=<montant de la commande>`. Tant qu'il est
  absent, `POST /payments/wave/checkout` échoue ; le reste de l'API
  (catégories, commandes, espèces, scan) fonctionne normalement. Plus d'API
  ni de webhook Wave : l'acheteur envoie une capture de son paiement, que
  l'admin confirme depuis le dashboard.
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET`, `FRONTEND_BASE_URL`, `WAVE_SIMULATE`
  — plus lues par le backend (ancienne intégration API Wave). **Retirées** du
  `.env` de production (2026-10-02).
- `CORS_ORIGIN` — **Fait** : `https://gala-ticket.vercel.app`.
- `TRUST_PROXY="1"` — **Fait**.
- `SWAGGER_ENABLED="0"` — **Fait** (désactivé en prod).

Protéger le fichier : `chmod 600 /var/www/gala/backend/.env`. **Fait**.

### 1.5 Process PM2

Convention de ce serveur pour tous les sites Node (voir note en tête de
document) : **PM2**, pas d'unité systemd dédiée. Fichier
[`backend/ecosystem.config.cjs`](backend/ecosystem.config.cjs) :

```js
module.exports = {
  apps: [
    {
      name: 'gala-ticket-backend',
      cwd: __dirname,
      script: 'dist/main.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

```bash
cd /var/www/gala/backend
pm2 start ecosystem.config.cjs
pm2 save   # persiste la liste pour pm2-ubuntu.service (déjà activé au boot)
pm2 status gala-ticket-backend   # doit afficher "online"
```

Pour voir les logs : `pm2 logs gala-ticket-backend`.

### 1.6 Nginx (reverse proxy) + SSL — **Fait**

Créé `/etc/nginx/sites-available/api-ticketgala.veilleurdesmedias.org.conf` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api-ticketgala.veilleurdesmedias.org;

    # Captures de paiement Wave envoyées par les acheteurs (5 Mo max côté
    # backend) — la valeur par défaut de Nginx (1 Mo) les rejetterait en 413.
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:4010;   # même port que PORT dans .env
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/api-ticketgala.veilleurdesmedias.org.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Puis SSL (`certbot` était déjà installé sur ce serveur pour les autres
sites) :

```bash
sudo certbot --nginx -d api-ticketgala.veilleurdesmedias.org
```

Certificat obtenu et déployé (expire 2026-12-10, renouvellement automatique
déjà configuré par certbot). Certbot a modifié le server block pour écouter
en 443 (SSL) et rediriger le 80 vers le 443 automatiquement.

### 1.7 Créer le compte admin — **Fait** (recréé le 2026-10-02)

> 2026-10-02 : la collection `users` de la base de production était vide
> (base probablement recréée depuis le premier seed) ; compte `admin` recréé
> et connexion testée.

```bash
cd /var/www/gala/backend
ADMIN_USERNAME="admin" ADMIN_PASSWORD="<mot-de-passe-fort>" npm run seed:admin
```

Identifiants générés et communiqués une seule fois à l'administrateur — pas
stockés dans ce dépôt.

### 1.8 Vérification — **Fait**

```bash
curl https://api-ticketgala.veilleurdesmedias.org/ticket-categories
```
→ renvoie `[]`. Connexion admin (`POST /auth/login`) testée avec succès ;
`GET /auth/me` sans token renvoie bien 401.

**Fait** (2026-09-30) : `client_max_body_size 6m;` (voir 1.6) ajouté à la conf Nginx
déjà en place, puis `sudo nginx -t && sudo systemctl reload nginx` — sans
quoi l'envoi des captures de paiement Wave échoue (413) au-delà de 1 Mo.

### 1.9 Mises à jour futures

```bash
cd /var/www/gala
git pull
cd backend
npm install
npm run build
npx prisma migration status   # base à jour ? (currentContract == targetContract)
npx prisma db update --dry-run   # si non : prévisualiser…
npx prisma db update             # …puis appliquer
pm2 restart gala-ticket-backend
```

Les validateurs MongoDB sont stricts (`additionalProperties: false`) : un
champ ajouté au contrat mais pas poussé en base fait échouer toute écriture
qui l'utilise (« Document failed validation »). `prisma`/`@prisma/composer-cli`
demandent Node ≥ 22.18 (voir la note en tête) : si le Node v20 du serveur
refuse, lancer `db update` depuis un poste de dev pointant sur la base de
production (`--db "<DATABASE_URL de prod>"`).

### 1.10 Sauvegarde de la base

Script [`backend/scripts/backup-db.sh`](backend/scripts/backup-db.sh) :
`mongodump` de la seule base `vedem_ticket` (l'instance est partagée) en
archive gzip dans `/home/ubuntu/backups/vedem_ticket/` (droits 700/600),
rotation à 14 jours (`RETENTION_DAYS`). Testé le 2026-10-02 (archive créée,
`mongorestore --dryRun` OK).

**Installé** (2026-10-02) — exécution quotidienne à 3 h 15 (crontab de `ubuntu`) :

```cron
15 3 * * * /var/www/gala/backend/scripts/backup-db.sh >> /home/ubuntu/backups/vedem_ticket-backup.log 2>&1
```

Restauration (écrase les collections de `vedem_ticket` uniquement) :

```bash
mongorestore --gzip --archive=/home/ubuntu/backups/vedem_ticket/<fichier>.archive.gz \
  --nsInclude='vedem_ticket.*' --drop
```

Les archives restent sur le même serveur : les copier aussi ailleurs
régulièrement en cas de perte du serveur.

## 2. Frontend sur Vercel

### 2.1 Importer le projet

- Vercel → *Add New → Project* → importer ce dépôt Git.
- **Root Directory : `frontend`** (dépôt monorepo — indispensable, sinon
  Vercel cherche un `package.json` à la racine).
- Framework Preset : *Next.js* (auto-détecté), build/output par défaut.

### 2.2 Variables d'environnement

Dans *Project Settings → Environment Variables* :

- `NEXT_PUBLIC_API_URL` = `https://api-ticketgala.veilleurdesmedias.org`
  (URL du backend OVH, étape 1). À définir pour *Production* (et *Preview* si
  des previews doivent pouvoir appeler l'API).

### 2.3 Domaine personnalisé (optionnel)

*Project Settings → Domains* → ajouter `<domaine>` puis mettre à jour les DNS
chez le registrar. Une fois le domaine définitif connu, mettre à jour
`CORS_ORIGIN` côté backend (étape 1.4).

## 3. Checklist finale

- [x] `DATABASE_URL` de production (MongoDB local du serveur) configuré et testé
- [x] Schéma de la base de production à jour (`npx prisma migration status` : `currentContract == targetContract`)
- [x] Sauvegarde quotidienne de la base `vedem_ticket` (`mongodump`, cron 3 h 15, cf. 1.10)
- [x] `JWT_SECRET` de production distinct de celui du dev
- [x] `WAVE_PAYMENT_URL` (lien de paiement marchand Wave) renseigné
- [x] `CORS_ORIGIN` restreint au(x) domaine(s) Vercel définitifs (`https://gala-ticket.vercel.app`)
- [x] `TRUST_PROXY="1"` sur le serveur OVH
- [x] `client_max_body_size 6m;` ajouté à la conf Nginx (envoi des captures Wave)
- [x] `npm run seed:admin` exécuté en production (recréé le 2026-10-02, cf. 1.7)
- [ ] Catégories de tickets créées depuis le dashboard (`ticket_categories` vide)
- [ ] Date et lieu de l'événement à jour (`PATCH /event-settings`)
- [x] `NEXT_PUBLIC_API_URL` (Vercel) = URL du backend OVH — vérifié dans le
      build déployé sur `https://gala-ticket.vercel.app` (2026-10-02)
- [x] Certificat SSL valide sur `api-ticketgala.veilleurdesmedias.org`
- [x] Process `gala-ticket-backend` démarré et persistant via PM2 (`pm2 save`,
      `pm2-ubuntu.service` déjà activé au démarrage du serveur)

## À compléter

- [x] Nom de domaine/sous-domaine définitif du **frontend** (Vercel) :
      `https://gala-ticket.vercel.app`
- [x] Lien de paiement marchand Wave (`WAVE_PAYMENT_URL`) — plus de clé API ni
      de secret webhook depuis le passage à la confirmation sur capture
