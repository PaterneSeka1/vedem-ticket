import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

/**
 * Rend `AuthModuleOptions` disponible globalement, pour que `JwtAuthGuard`
 * (@UseGuards(JwtAuthGuard)) puisse être utilisé depuis n'importe quel
 * module — Tickets, Orders, Payments... — sans que chacun ait besoin
 * d'importer PassportModule lui-même.
 */
@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  exports: [PassportModule],
})
export class GlobalPassportModule {}
