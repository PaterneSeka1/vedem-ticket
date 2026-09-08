import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../common/rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedAdmin } from './jwt.strategy.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Un seul compte admin : on limite les tentatives pour freiner le brute-force.
  @UseGuards(RateLimit(10, 5 * 60_000))
  @Post('login')
  async login(@Body() body: LoginDto) {
    const { accessToken, admin } = await this.authService.login(body.username, body.password);
    return { accessToken, admin };
  }

  /**
   * Vérifie qu'un token valide est présent — utilisé par le dashboard pour
   * confirmer la session admin en cours.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return { username: admin.username };
  }
}
