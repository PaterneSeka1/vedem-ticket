This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Application installable (PWA)

Le manifeste `/manifest.webmanifest` permet l’installation en application autonome.
Les icônes PWA et Apple sont dérivées du logo existant `public/logo.jpeg`, sans
déformation ; la variante « maskable » ajoute une marge pour le recadrage mobile.
Sur Chrome/Edge, utiliser l’action « Installer l’application » du navigateur ;
sur iPhone/iPad, utiliser Safari → Partager → Sur l’écran d’accueil.
L’installation nécessite HTTPS (ou localhost pour les essais).

Le service worker s’active uniquement en production (`npm run build`, puis
`npm start`). Après une première visite en ligne, une navigation sans réseau
affiche une page de secours autonome. Les API, billets, commandes, paiements et
pages d’administration ne sont jamais stockés par le service worker. Aucune
opération métier n’est synchronisée hors connexion.

Après modification de `public/offline.html`, incrémenter `CACHE_NAME` dans
`public/sw.js`. Une mise à jour s’active après fermeture des anciens onglets.
Vérification ciblée : `node tests/pwa.test.mjs`.

Recette navigateur : ouvrir la production, vérifier le manifeste et le service
worker dans les outils de développement, installer l’application, puis activer
le mode hors connexion et recharger une page. Désactiver le mode hors connexion
et cliquer sur « Réessayer » doit ramener à la page demandée.

## Développement

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
