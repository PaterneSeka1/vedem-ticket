import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedAdmin } from '../auth/jwt.strategy.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /** Admin — suivi des tickets (dashboard : onglets Tickets/Tombola, comptage des entrées). */
  @ApiOperation({ summary: 'Lister tous les tickets (admin)' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  /**
   * Admin — validation à l'entrée. `code` est la valeur décodée du QR code
   * scanné. Un ticket ne peut être validé qu'une seule fois (409 sinon).
   */
  @ApiOperation({
    summary: "Scanner un ticket à l'entrée (admin)",
    description: 'Marque le ticket comme `used`. `code` est la valeur brute décodée du QR code (pas le QR image).',
  })
  @ApiParam({ name: 'code', description: 'Code unique du ticket (contenu du QR code)' })
  @ApiNotFoundResponse({ description: 'Aucun ticket avec ce code.' })
  @ApiConflictResponse({ description: 'Ticket déjà scanné ou annulé.' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Patch(':code/scan')
  scan(@Param('code') code: string, @Req() req: Request) {
    const admin = req.user as AuthenticatedAdmin;
    return this.ticketsService.scan(code, admin.userId);
  }
}
