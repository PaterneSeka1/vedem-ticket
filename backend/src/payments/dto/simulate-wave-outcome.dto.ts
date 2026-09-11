import { IsIn } from 'class-validator';

/** Dev uniquement — voir PaymentsService.simulateWaveOutcome (WAVE_SIMULATE=1). */
export class SimulateWaveOutcomeDto {
  @IsIn(['success', 'failed'])
  outcome!: 'success' | 'failed';
}
