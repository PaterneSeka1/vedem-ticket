import { Module } from '@nestjs/common';
import { EventSettingsController } from './event-settings.controller.js';
import { EventSettingsService } from './event-settings.service.js';

@Module({
  controllers: [EventSettingsController],
  providers: [EventSettingsService],
  exports: [EventSettingsService],
})
export class EventSettingsModule {}
