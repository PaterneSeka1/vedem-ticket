import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { EventSettingsModule } from './event-settings/event-settings.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { TicketsModule } from './tickets/tickets.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

// Lues une seule fois au démarrage (cf. commentaire dans main.ts) : sans ces
// deux variables, le module est simplement omis des imports plutôt que
// démarré avec des identifiants placeholder qui se feraient rejeter (401) en
// boucle par observe.nestjs.com.
const observeAppKey = process.env['OBSERVE_APP_KEY'];
const observeAppSecret = process.env['OBSERVE_APP_SECRET'];

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ...(observeAppKey && observeAppSecret
      ? [
          ObserveModule.forRoot({
            appKey: observeAppKey,
            appSecret: observeAppSecret,
            serviceId: 'backend',
          }),
        ]
      : []),
    AuthModule,
    EventSettingsModule,
    TicketsModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
