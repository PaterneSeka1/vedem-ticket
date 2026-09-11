import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateEventSettingsDto } from './dto/update-event-settings.dto.js';
import { EventSettingsService } from './event-settings.service.js';

@ApiTags('event-settings')
@Controller('event-settings')
export class EventSettingsController {
  constructor(private readonly eventSettingsService: EventSettingsService) {}

  /**
   * Public — consulté par le site (accueil, checkout) et par les tickets pour
   * afficher la date/le lieu à jour, sans exception (voir CLAUDE.md).
   */
  @ApiOperation({ summary: "Consulter la date et le lieu de l'événement (public)" })
  @Get()
  getSettings() {
    return this.eventSettingsService.getSettings();
  }

  @ApiOperation({ summary: "Modifier la date et/ou le lieu de l'événement (admin)" })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Patch()
  updateSettings(@Body() body: UpdateEventSettingsDto) {
    return this.eventSettingsService.updateSettings(body);
  }
}
