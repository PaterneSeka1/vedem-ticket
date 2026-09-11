# Déploiement — VEDEM Ticket

Ce document décrit comment déployer l'application :

- **Frontend** (Next.js, [frontend/](frontend/)) → **Vercel**
- **Backend** (NestJS, [backend/](backend/)) → **o2switch** (hébergement mutualisé, module *Node.js* de cPanel / Passenger)
- **Base de données** → MongoDB Atlas (déjà en place, aucun changement nécessaire)

Les valeurs entre `<...>` sont des informations pas encore connues (domaines,
identifiants cPanel, clés Wave, etc.) — à remplacer une fois disponibles.
Aucune valeur réelle (secrets, domaines définitifs) n'est présente dans ce
dépôt ; elles se configurent uniquement dans les interfaces Vercel / cPanel.

## Vue d'ensemble et ordre de déploiement

Le backend et le frontend référencent chacun l'URL de l'autre
(`CORS_ORIGIN`/`FRONTEND_BASE_URL` côté backend, `NEXT_PUBLIC_API_URL` côté
frontend), d'où l'ordre recommandé :

1. **Déployer le backend sur o2switch en premier**, avec `CORS_ORIGIN` non
   défini (= tout le monde autorisé, comme en dev) et `FRONTEND_BASE_URL`
   provisoire. Noter l'URL de l'API (ex. `https://api.<domaine>`).
2. **Déployer le frontend sur Vercel**, avec `NEXT_PUBLIC_API_URL` pointant
   vers cette URL d'API. Noter l'URL Vercel définitive (domaine `vercel.app`
   ou domaine personnalisé).
3. **Revenir sur o2switch** et resserrer `CORS_ORIGIN` + `FRONTEND_BASE_URL`
   sur l'URL réelle du frontend, puis redémarrer l'app Node.

## 1. Backend sur o2switch

### 1.1 Prérequis

- Accès cPanel + SSH sur l'hébergement o2switch.
- Un (sous-)domaine pour l'API, ex. `api.<domaine>`, avec SSL actif
  (AutoSSL/Let's Encrypt, gratuit et automatique sur o2switch) — Wave exige
  des URLs HTTPS pour le webhook et les `success_url`/`error_url`.
- Module **"Setup Node.js App"** de cPanel (CloudLinux Node.js Selector /
  Passenger), avec une version Node ≥ 20 disponible.

### 1.2 Créer l'application Node.js (cPanel → Setup Node.js App)

| Champ | Valeur |
|---|---|
| Node.js version | La plus récente version LTS proposée (≥ 20) |
| Application mode | `Production` |
| Application root | `<chemin choisi, ex. ticket-backend>` |
| Application URL | `<api.domaine>` |
| Application startup file | `dist/main.js` |

Passenger fournit le port d'écoute via la variable `PORT`, déjà lue par
[`backend/src/main.ts`](backend/src/main.ts) (`app.listen(process.env.PORT ?? 3000)`) —
aucune modification de code n'est nécessaire pour ça.

### 1.3 Variables d'environnement

À renseigner dans l'onglet *Environment variables* de l'app Node (mêmes clés
que [`backend/.env.example`](backend/.env.example)) :

- `DATABASE_URL` — chaîne de connexion MongoDB Atlas de production.
- `JWT_SECRET` — secret dédié à la prod, différent de celui du dev
  (`openssl rand -base64 48`).
- `JWT_EXPIRES_IN` — optionnel, défaut `12h`.
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` — identifiants réels du compte
  marchand Wave (`<à compléter>`).
- `FRONTEND_BASE_URL` — URL du frontend Vercel (voir étape 3 de l'ordre de
  déploiement ci-dessus).
- `CORS_ORIGIN` — domaine(s) du frontend Vercel, séparés par des virgules.
- `TRUST_PROXY="1"` — l'app tourne derrière le reverse proxy Apache/Passenger
  d'o2switch, qui est de confiance ; nécessaire pour que `req.ip` (utilisé par
  le rate-limiting) reflète l'IP réelle du client.
- `SWAGGER_ENABLED="0"` — à mettre si on ne veut pas exposer `/docs`
  publiquement en prod (optionnel).
- **Ne pas définir** `PORT` (géré par Passenger) ni `WAVE_SIMULATE` (dev
  uniquement, cf. CLAUDE.md §4).

### 1.4 Installer, builder, démarrer

Le module Node.js Selector n'installe que les dépendances ; le build
(`nest build`) doit être lancé explicitement. Par SSH, après avoir activé le
virtualenv indiqué par cPanel (bouton *"Enter to the virtual environment"* de
l'app, commande du type `source /home/<user>/nodevenv/<app>/20/bin/activate`) :

```bash
cd <chemin de l'application>
npm install
npm run build
npm run seed:admin   # une seule fois, pour créer le compte admin en prod
```

Puis redémarrer l'app depuis cPanel (bouton *Restart*), ou en touchant
`tmp/restart.txt` dans le dossier de l'app (mécanisme standard de Passenger).

### 1.5 Déploiement continu via Git (optionnel)

Un fichier [`.cpanel.yml`](.cpanel.yml) est fourni à la racine du dépôt. Il
permet d'utiliser *cPanel → Git Version Control* : cPanel clone ce dépôt puis,
à chaque *"Deploy HEAD Commit"*, copie `backend/`, réinstalle les dépendances,
rebuild, et déclenche le redémarrage de l'app.

**À compléter dans `.cpanel.yml` avant la première utilisation** : le chemin
de déploiement (`DEPLOYPATH`) et la commande d'activation du virtualenv Node,
tous deux visibles dans cPanel → *Setup Node.js App* une fois l'app créée
(étape 1.2).

### 1.6 Vérification

```bash
curl https://api.<domaine>/docs        # si SWAGGER_ENABLED != "0"
curl https://api.<domaine>/ticket-categories
```

Puis enregistrer l'URL de webhook Wave :
`https://api.<domaine>/payments/wave/webhook`.

## 2. Frontend sur Vercel

### 2.1 Importer le projet

- Vercel → *Add New → Project* → importer ce dépôt Git.
- **Root Directory : `frontend`** (dépôt monorepo — indispensable, sinon
  Vercel cherche un `package.json` à la racine).
- Framework Preset : *Next.js* (auto-détecté), build/output par défaut.

### 2.2 Variables d'environnement

Dans *Project Settings → Environment Variables* :

- `NEXT_PUBLIC_API_URL` = `https://api.<domaine>` (URL du backend o2switch,
  étape 1). À définir pour *Production* (et *Preview* si des previews doivent
  pouvoir appeler l'API).

### 2.3 Domaine personnalisé (optionnel)

*Project Settings → Domains* → ajouter `<domaine>` puis mettre à jour les DNS
chez le registrar. Une fois le domaine définitif connu, mettre à jour
`CORS_ORIGIN`/`FRONTEND_BASE_URL` côté backend (étape 1.3).

## 3. Checklist finale

- [ ] `DATABASE_URL` Atlas de production configuré et testé
- [ ] `JWT_SECRET` de production distinct de celui du dev
- [ ] `WAVE_API_KEY` / `WAVE_WEBHOOK_SECRET` réels renseignés, `WAVE_SIMULATE` absent
- [ ] `CORS_ORIGIN` restreint au(x) domaine(s) Vercel définitifs
- [ ] `FRONTEND_BASE_URL` = domaine Vercel définitif
- [ ] `TRUST_PROXY="1"` sur o2switch
- [ ] Webhook Wave enregistré avec l'URL o2switch (`/payments/wave/webhook`)
- [ ] `npm run seed:admin` exécuté une fois en production
- [ ] `NEXT_PUBLIC_API_URL` (Vercel) = URL du backend o2switch

## À compléter

- [ ] Nom de domaine définitif (frontend et/ou API)
- [ ] Identifiants cPanel / chemin de l'app Node sur o2switch
- [ ] Version Node choisie sur o2switch
- [ ] Compte marchand Wave (clé API + secret webhook)
