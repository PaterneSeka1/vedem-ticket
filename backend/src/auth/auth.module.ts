import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GlobalPassportModule } from './global-passport.module.js';
import { JwtStrategy } from './jwt.strategy.js';

const jwtExpiresIn = (process.env['JWT_EXPIRES_IN'] as StringValue | undefined) ?? '12h';

@Module({
  imports: [
    GlobalPassportModule,
    JwtModule.register({
      secret: process.env['JWT_SECRET'],
      signOptions: { expiresIn: jwtExpiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
