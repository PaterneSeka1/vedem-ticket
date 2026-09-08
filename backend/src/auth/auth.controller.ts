import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimit } from '../common/rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedAdmin } from './jwt.strategy.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Un seul compte admin : on limite les tentatives pour freiner le brute-force.
  @ApiOperation({
    summary: "Connexion de l'administrateur",
    description: 'Retourne un token JWT (`accessToken`) à envoyer en `Authorization: Bearer <token>` sur les routes admin. Limité à 10 tentatives / 5 min par IP.',
  })
  @ApiUnauthorizedResponse({ description: 'Identifiants invalides.' })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives, réessayer plus tard.' })
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
  @ApiOperation({ summary: 'Session admin en cours (vérifie le token)' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return { username: admin.username };
  }
}
