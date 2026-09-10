import { describe, it, expect } from 'vitest';
import { generateTelemetryForVideo, getRiskAtTime } from '../telemetry';

describe('Single Source of Truth Temporal Risk Synchronization Logic', () => {
  const payload = generateTelemetryForVideo(
    'Rolling and dropping carton.mp4',
    15 * 1024 * 1024,
    'Loading Bay 01',
    '/videos/Rolling%20and%20dropping%20carton.mp4',
    15
  );

  it('calculates single peak risk and peak time consistently', () => {
    const stateAt0 = getRiskAtTime(payload.timelineData, 0);
    const stateAt9 = getRiskAtTime(payload.timelineData, 9);

    expect(stateAt0.peakPoint.frameRisk).toBe(stateAt9.peakPoint.frameRisk);
    expect(stateAt0.peakPoint.time).toBe(stateAt9.peakPoint.time);
    expect(stateAt0.peakRisk).toBe(stateAt9.peakRisk);
    expect(stateAt0.peakTime).toBe(stateAt9.peakTime);
  });

  it('interpolates current risk at floating video timestamps without Math.random()', () => {
    const stateAt4_5 = getRiskAtTime(payload.timelineData, 4.5);
    const stateAt4 = getRiskAtTime(payload.timelineData, 4);
    const stateAt5 = getRiskAtTime(payload.timelineData, 5);

    expect(stateAt4_5.currentRisk).toBeGreaterThanOrEqual(Math.min(stateAt4.currentRisk, stateAt5.currentRisk));
    expect(stateAt4_5.currentRisk).toBeLessThanOrEqual(Math.max(stateAt4.currentRisk, stateAt5.currentRisk));
  });

  it('distinguishes current risk from peak risk correctly', () => {
    const peakTime = payload.timelineData.reduce((max, p) => p.frameRisk > max.frameRisk ? p : max).time;
    const nonPeakTime = (peakTime + 5) % 15;

    const stateAtNonPeak = getRiskAtTime(payload.timelineData, nonPeakTime);
    expect(stateAtNonPeak.currentTime).toBe(nonPeakTime);
    expect(stateAtNonPeak.peakTime).toBe(peakTime);
  });

  it('synchronizes playhead, frame, risk score, and risk level across timeline points', () => {
    for (let t = 0; t <= 15; t += 0.5) {
      const state = getRiskAtTime(payload.timelineData, t);
      expect(state.currentTime).toBe(t);
      expect(state.currentFrame).toBe(Math.round(t * 30));
      expect(typeof state.currentRisk).toBe('number');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(state.currentRiskLevel);
    }
  });
});
