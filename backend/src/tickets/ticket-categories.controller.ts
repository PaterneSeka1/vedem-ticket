import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto.js';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto.js';
import { TicketCategoriesService } from './ticket-categories.service.js';

@Controller('ticket-categories')
export class TicketCategoriesController {
  constructor(private readonly ticketCategoriesService: TicketCategoriesService) {}

  /** Public — l'acheteur consulte les catégories disponibles avant de commander. */
  @Get()
  findAll() {
    return this.ticketCategoriesService.findAll();
  }

  /** Admin — configuration des catégories pour l'événement. */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateTicketCategoryDto) {
    return this.ticketCategoriesService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTicketCategoryDto) {
    return this.ticketCategoriesService.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketCategoriesService.remove(id);
  }
}
