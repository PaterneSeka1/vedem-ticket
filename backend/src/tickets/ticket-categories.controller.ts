import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto.js';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto.js';
import { TicketCategoriesService } from './ticket-categories.service.js';

@ApiTags('ticket-categories')
@Controller('ticket-categories')
export class TicketCategoriesController {
  constructor(private readonly ticketCategoriesService: TicketCategoriesService) {}

  /** Public — l'acheteur consulte les catégories disponibles avant de commander. */
  @ApiOperation({ summary: 'Lister les catégories de tickets (public)' })
  @Get()
  findAll() {
    return this.ticketCategoriesService.findAll();
  }

  /** Admin — configuration des catégories pour l'événement. */
  @ApiOperation({ summary: 'Créer une catégorie de tickets (admin)' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateTicketCategoryDto) {
    return this.ticketCategoriesService.create(body);
  }

  @ApiOperation({ summary: 'Modifier une catégorie de tickets (admin)' })
  @ApiParam({ name: 'id', description: 'ObjectId de la catégorie' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTicketCategoryDto) {
    return this.ticketCategoriesService.update(id, body);
  }

  @ApiOperation({ summary: 'Supprimer une catégorie de tickets (admin)' })
  @ApiParam({ name: 'id', description: 'ObjectId de la catégorie' })
  @ApiBearerAuth('admin-jwt')
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketCategoriesService.remove(id);
  }
}
