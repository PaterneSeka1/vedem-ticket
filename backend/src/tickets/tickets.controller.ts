import { Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedAdmin } from '../auth/jwt.strategy.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Admin — validation à l'entrée. `code` est la valeur décodée du QR code
   * scanné. Un ticket ne peut être validé qu'une seule fois (409 sinon).
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':code/scan')
  scan(@Param('code') code: string, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.ticketsService.scan(code, admin.userId);
  }
}
