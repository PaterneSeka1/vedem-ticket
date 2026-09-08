// Doit être importé avant tout module qui lit process.env (ex: AuthModule/JwtModule).
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
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

  app.use(helmet());
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

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
