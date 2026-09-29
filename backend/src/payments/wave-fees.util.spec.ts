import { describe, expect, it } from 'vitest';
import { computeWaveFees } from './wave-fees.util.js';

describe('computeWaveFees', () => {
  it('charges 1% of the amount', () => {
    expect(computeWaveFees(5000)).toBe(50);
    expect(computeWaveFees(0)).toBe(0);
  });

  it('rounds up to the next unit', () => {
    expect(computeWaveFees(2550)).toBe(26);
  });
});
