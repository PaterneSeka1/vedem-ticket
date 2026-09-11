# Déploiement — VEDEM Ticket

Ce document décrit comment déployer l'application :

- **Frontend** (Next.js, [frontend/](frontend/)) → **Vercel** — déployé :
  [`https://gala-ticket.vercel.app`](https://gala-ticket.vercel.app)
- **Backend** (NestJS, [backend/](backend/)) → **serveur OVH** (Ubuntu, accès
  root, Nginx en reverse proxy + **PM2**) — déployé :
  [`https://api-ticketgala.veilleurdesmedias.org`](https://api-ticketgala.veilleurdesmedias.org)
- **Base de données** → MongoDB Atlas (déjà en place, aucun changement nécessaire)

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
(`CORS_ORIGIN`/`FRONTEND_BASE_URL` côté backend, `NEXT_PUBLIC_API_URL` côté
frontend), d'où l'ordre recommandé :

1. **Déployer le backend sur OVH en premier**, avec `CORS_ORIGIN` non défini
   (= tout le monde autorisé, comme en dev) et `FRONTEND_BASE_URL` provisoire.
   L'URL de l'API est déjà fixée : `https://api-ticketgala.veilleurdesmedias.org`.
2. **Déployer le frontend sur Vercel**, avec `NEXT_PUBLIC_API_URL` pointant
   vers cette URL. Noter l'URL Vercel définitive (domaine `vercel.app` ou
   domaine personnalisé).
3. **Revenir sur le serveur OVH** et resserrer `CORS_ORIGIN` + `FRONTEND_BASE_URL`
   sur l'URL réelle du frontend, puis redémarrer le service.

**Fait** : les deux étapes 1 et 2 sont en place, avec `CORS_ORIGIN`/
`FRONTEND_BASE_URL` déjà resserrés sur `https://gala-ticket.vercel.app`
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

- `DATABASE_URL` — chaîne de connexion MongoDB Atlas de production. **Fait**
  (cluster Atlas dédié, base `vedem_ticket`).
- `JWT_SECRET` — secret dédié à la prod (`openssl rand -base64 48`). **Fait**.
- `PORT` — port interne sur lequel l'app écoute : **`4010`** (3000-3004,
  4000, 8787, 9000-9001 déjà pris par d'autres sites sur ce serveur —
  toujours vérifier avec `ss -ltnp` avant de choisir). Nginx y fait suivre le
  trafic (voir 1.6).
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` — identifiants réels du compte
  marchand Wave (`<à compléter>` — pas encore fournis, voir « À compléter »).
  Tant qu'ils sont absents, `POST /payments/wave/checkout` échoue ; le reste
  de l'API (catégories, commandes, espèces, scan) fonctionne normalement.
- `FRONTEND_BASE_URL` — **Fait** : `https://gala-ticket.vercel.app`.
- `CORS_ORIGIN` — **Fait** : `https://gala-ticket.vercel.app`.
- `TRUST_PROXY="1"` — **Fait**.
- `SWAGGER_ENABLED="0"` — **Fait** (désactivé en prod).
- **Ne pas définir** `WAVE_SIMULATE` (dev uniquement, cf. CLAUDE.md §4). Pas
  défini.

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

### 1.7 Créer le compte admin — **Fait**

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

Webhook Wave pas encore enregistré côté Wave (identifiants marchand pas
encore fournis) — URL à utiliser le moment venu :
`https://api-ticketgala.veilleurdesmedias.org/payments/wave/webhook`.

### 1.9 Mises à jour futures

```bash
cd /var/www/gala
git pull
cd backend
npm install
npm run build
pm2 restart gala-ticket-backend
```

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
`CORS_ORIGIN`/`FRONTEND_BASE_URL` côté backend (étape 1.4).

## 3. Checklist finale

- [x] `DATABASE_URL` Atlas de production configuré et testé
- [x] `JWT_SECRET` de production distinct de celui du dev
- [ ] `WAVE_API_KEY` / `WAVE_WEBHOOK_SECRET` réels renseignés, `WAVE_SIMULATE` absent
      — identifiants marchand pas encore fournis (`WAVE_SIMULATE` bien absent)
- [x] `CORS_ORIGIN` restreint au(x) domaine(s) Vercel définitifs (`https://gala-ticket.vercel.app`)
- [x] `FRONTEND_BASE_URL` = domaine Vercel définitif
- [x] `TRUST_PROXY="1"` sur le serveur OVH
- [ ] Webhook Wave enregistré avec l'URL OVH (`/payments/wave/webhook`) — en attente des identifiants Wave
- [x] `npm run seed:admin` exécuté une fois en production
- [ ] `NEXT_PUBLIC_API_URL` (Vercel) = URL du backend OVH — variable communiquée,
      à ajouter dans Vercel puis redéployer (cf. 2.2)
- [x] Certificat SSL valide sur `api-ticketgala.veilleurdesmedias.org`
- [x] Process `gala-ticket-backend` démarré et persistant via PM2 (`pm2 save`,
      `pm2-ubuntu.service` déjà activé au démarrage du serveur)

## À compléter

- [x] Nom de domaine/sous-domaine définitif du **frontend** (Vercel) :
      `https://gala-ticket.vercel.app`
- [ ] Compte marchand Wave (clé API + secret webhook)
