// Doit être importé avant tout module qui lit process.env (ex: AuthModule/JwtModule).
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { IdNormalizeInterceptor } from './common/id-normalize.interceptor.js';

/**
 * Variables sans lesquelles le backend ne peut pas fonctionner en toute
 * sécurité — on préfère échouer immédiatement au démarrage, avec un message
 * clair, plutôt que de laisser l'app tourner et échouer plus tard sur la
 * première requête (JWT_SECRET) ou la première requête DB (DATABASE_URL).
 */
function assertRequiredEnv(): void {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(', ')}. Voir backend/.env.example.`,
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    // Body parser global désactivé : le webhook Wave a besoin du corps brut
    // (Buffer) pour vérifier sa signature HMAC, donc on le monte à la main
    // avant le parseur JSON générique — voir PaymentsController.waveWebhook.
    bodyParser: false,
  });

  // Nécessaire derrière un reverse proxy (OVH, etc.) pour que `req.ip` (utilisé
  // par le rate-limiting) reflète l'IP réelle du client plutôt que celle du
  // proxy. À activer uniquement quand un proxy de confiance est réellement en
  // place — sinon un client pourrait usurper son IP via X-Forwarded-For.
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      // Swagger UI a besoin d'exécuter un petit script inline pour
      // s'initialiser ; sans ça, le CSP par défaut de Helmet le bloque et la
      // page /docs reste blanche. Les vraies routes de l'API ne renvoient que
      // du JSON, donc cet assouplissement ne les concerne pas.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
  });

  app.use('/payments/wave/webhook', express.raw({ type: '*/*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // whitelist + forbidNonWhitelisted : un champ inconnu dans le body fait
  // échouer la requête (400) plutôt que d'être silencieusement ignoré.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Uniformise les réponses JSON : `_id` (document Mongo brut) -> `id`,
  // partout (objets, tableaux, objets imbriqués) — voir le commentaire de
  // l'interceptor. Consommé par le frontend et documenté implicitement par
  // Swagger (les `@ApiParam({ name: 'id' })` supposent ce nom de champ).
  app.useGlobalInterceptors(new IdNormalizeInterceptor());

  // Activée par défaut (utile au dev frontend) ; SWAGGER_ENABLED=0 la coupe,
  // par exemple en production si l'on préfère ne pas exposer la carte des
  // routes publiquement.
  if (process.env.SWAGGER_ENABLED !== '0') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VEDEM Ticket API')
      .setDescription(
        "API du backend de vente et gestion de tickets pour un événement (achat sans compte, " +
          "paiement Wave ou espèces, validation à l'entrée par QR code). " +
          'Les routes admin (cadenas ci-dessous) requièrent le token obtenu via `POST /auth/login`.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-jwt')
      .addTag('auth', "Authentification de l'administrateur")
      .addTag('ticket-categories', 'Catégories de tickets (consultation publique, gestion admin)')
      .addTag('orders', 'Commandes (création publique, suivi admin)')
      .addTag('payments', 'Paiements Wave et espèces')
      .addTag('tickets', "Validation des tickets à l'entrée (scan, admin)")
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
