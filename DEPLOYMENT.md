# Déploiement — VEDEM Ticket

Ce document décrit comment déployer l'application :

- **Frontend** (Next.js, [frontend/](frontend/)) → **Vercel**
- **Backend** (NestJS, [backend/](backend/)) → **serveur OVH** (Ubuntu, accès
  root, Nginx en reverse proxy + systemd)
- **Base de données** → MongoDB Atlas (déjà en place, aucun changement nécessaire)

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
sudo git clone https://github.com/PaterneSeka1/vedem-ticket.git
sudo chown -R $USER:$USER vedem-ticket
cd vedem-ticket/backend
npm install
npm run build
```

### 1.4 Variables d'environnement

Créer `/var/www/vedem-ticket/backend/.env` (lu automatiquement par l'app via
`dotenv/config`, cf. [`backend/src/main.ts`](backend/src/main.ts)) — mêmes
clés que [`backend/.env.example`](backend/.env.example) :

- `DATABASE_URL` — chaîne de connexion MongoDB Atlas de production.
- `JWT_SECRET` — secret dédié à la prod (`openssl rand -base64 48`).
- `PORT` — port interne sur lequel l'app écoute, ex. `3001` (vérifier qu'il
  n'est pas déjà utilisé par un autre site : `ss -ltnp | grep 3001`). Nginx y
  fera suivre le trafic (voir 1.6).
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` — identifiants réels du compte
  marchand Wave (`<à compléter>`).
- `FRONTEND_BASE_URL` — URL du frontend Vercel (voir étape 2 de l'ordre de
  déploiement ci-dessus).
- `CORS_ORIGIN` — domaine(s) du frontend Vercel, séparés par des virgules.
- `TRUST_PROXY="1"` — l'app tourne derrière le reverse proxy Nginx local, de
  confiance ; nécessaire pour que `req.ip` (rate-limiting) reflète l'IP réelle
  du client plutôt que `127.0.0.1`.
- `SWAGGER_ENABLED="0"` — à mettre si on ne veut pas exposer `/docs`
  publiquement en prod (optionnel).
- **Ne pas définir** `WAVE_SIMULATE` (dev uniquement, cf. CLAUDE.md §4).

Protéger le fichier : `chmod 600 /var/www/vedem-ticket/backend/.env`.

### 1.5 Service systemd

Créer `/etc/systemd/system/vedem-ticket-backend.service` :

```ini
[Unit]
Description=VEDEM Ticket - backend NestJS
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/vedem-ticket/backend
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Adapter `User`/`Group` à la convention déjà utilisée sur ce serveur pour les
autres sites si besoin (et `chown -R www-data:www-data /var/www/vedem-ticket`
en conséquence).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vedem-ticket-backend
sudo systemctl status vedem-ticket-backend   # doit afficher "active (running)"
```

Pour voir les logs : `sudo journalctl -u vedem-ticket-backend -f`.

### 1.6 Nginx (reverse proxy) + SSL

Créer `/etc/nginx/sites-available/api-ticketgala.veilleurdesmedias.org` :

```nginx
server {
    listen 80;
    server_name api-ticketgala.veilleurdesmedias.org;

    location / {
        proxy_pass http://127.0.0.1:3001;   # même port que PORT dans .env
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api-ticketgala.veilleurdesmedias.org /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Puis SSL (le DNS doit déjà pointer vers le serveur pour que la validation
Let's Encrypt passe) :

```bash
sudo apt install -y certbot python3-certbot-nginx   # si pas déjà installé
sudo certbot --nginx -d api-ticketgala.veilleurdesmedias.org
```

Certbot modifie le server block pour écouter en 443 (SSL) et rediriger le 80
vers le 443 automatiquement.

### 1.7 Créer le compte admin

```bash
cd /var/www/vedem-ticket/backend
ADMIN_USERNAME="admin" ADMIN_PASSWORD="<mot-de-passe-fort>" npm run seed:admin
```

### 1.8 Vérification

```bash
curl https://api-ticketgala.veilleurdesmedias.org/ticket-categories
```
→ doit renvoyer `[]`.

Puis enregistrer l'URL de webhook Wave :
`https://api-ticketgala.veilleurdesmedias.org/payments/wave/webhook`.

### 1.9 Mises à jour futures

```bash
cd /var/www/vedem-ticket
git pull
cd backend
npm install
npm run build
sudo systemctl restart vedem-ticket-backend
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

- [ ] `DATABASE_URL` Atlas de production configuré et testé
- [ ] `JWT_SECRET` de production distinct de celui du dev
- [ ] `WAVE_API_KEY` / `WAVE_WEBHOOK_SECRET` réels renseignés, `WAVE_SIMULATE` absent
- [ ] `CORS_ORIGIN` restreint au(x) domaine(s) Vercel définitifs
- [ ] `FRONTEND_BASE_URL` = domaine Vercel définitif
- [ ] `TRUST_PROXY="1"` sur le serveur OVH
- [ ] Webhook Wave enregistré avec l'URL OVH (`/payments/wave/webhook`)
- [ ] `npm run seed:admin` exécuté une fois en production
- [ ] `NEXT_PUBLIC_API_URL` (Vercel) = URL du backend OVH
- [ ] Certificat SSL valide sur `api-ticketgala.veilleurdesmedias.org`
- [ ] Service `vedem-ticket-backend` activé au démarrage (`systemctl enable`)

## À compléter

- [ ] Nom de domaine/sous-domaine définitif du **frontend** (Vercel) — l'API
      est déjà fixée sur `https://api-ticketgala.veilleurdesmedias.org`
- [ ] Compte marchand Wave (clé API + secret webhook)
