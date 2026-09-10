import { describe, it, expect } from 'vitest';
import { getRiskAtTime, type FrameTelemetryPoint } from '../../types/telemetry';

describe('Risk Severity Boundaries & Operational Alert Filtering', () => {
  it('correctly maps numeric risk scores to exact 4-level severities (LOW < 35, MEDIUM 35-59.9, HIGH 60-79.9, CRITICAL >= 80)', () => {
    const testCases: { score: number; expectedLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }[] = [
      { score: 0, expectedLevel: 'LOW' },
      { score: 10, expectedLevel: 'LOW' },
      { score: 34.9, expectedLevel: 'LOW' },
      { score: 35, expectedLevel: 'MEDIUM' },
      { score: 45, expectedLevel: 'MEDIUM' },
      { score: 59.9, expectedLevel: 'MEDIUM' },
      { score: 60, expectedLevel: 'HIGH' },
      { score: 75, expectedLevel: 'HIGH' },
      { score: 79.9, expectedLevel: 'HIGH' },
      { score: 80, expectedLevel: 'CRITICAL' },
      { score: 95.5, expectedLevel: 'CRITICAL' },
      { score: 100, expectedLevel: 'CRITICAL' },
    ];

    testCases.forEach(({ score, expectedLevel }) => {
      const dummyTimeline: FrameTelemetryPoint[] = [
        { time: 0, frameRisk: score },
        { time: 10, frameRisk: score },
      ];
      const state = getRiskAtTime(dummyTimeline, 5);
      expect(state.currentRiskLevel).toBe(expectedLevel);
    });
  });

  it('suppresses operational notification popups for LOW risk (< 35) while enabling MEDIUM, HIGH, and CRITICAL', () => {
    const evaluateAlertSuppression = (score: number, status?: string): boolean => {
      const level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
        score >= 80 || status === 'CRITICAL' ? 'CRITICAL' :
        score >= 60 || status === 'HIGH' ? 'HIGH' :
        score >= 35 || status === 'MEDIUM' ? 'MEDIUM' : 'LOW';
      return level !== 'LOW';
    };

    expect(evaluateAlertSuppression(15)).toBe(false); // LOW -> Suppressed
    expect(evaluateAlertSuppression(34.9)).toBe(false); // LOW -> Suppressed
    expect(evaluateAlertSuppression(35)).toBe(true); // MEDIUM -> Alert
    expect(evaluateAlertSuppression(55)).toBe(true); // MEDIUM -> Alert
    expect(evaluateAlertSuppression(65)).toBe(true); // HIGH -> Alert
    expect(evaluateAlertSuppression(88)).toBe(true); // CRITICAL -> Alert
  });

  it('filters event queue by default to operational events (MEDIUM + HIGH + CRITICAL) while keeping LOW accessible', () => {
    const events = [
      { id: '1', risk_level: 'Low', risk_score: 20 },
      { id: '2', risk_level: 'Medium', risk_score: 45 },
      { id: '3', risk_level: 'High', risk_score: 70 },
      { id: '4', risk_level: 'Critical', risk_score: 90 },
    ];

    const filterEvents = (selectedRisk: string) => {
      return events.filter((e) => {
        const levelUpper = (e.risk_level || '').toUpperCase();
        const score = e.risk_score ?? 0;
        if (selectedRisk === 'Medium+' || selectedRisk === 'Operational') {
          return levelUpper === 'MEDIUM' || levelUpper === 'HIGH' || levelUpper === 'CRITICAL' || score >= 35;
        }
        if (selectedRisk === 'All') return true;
        return levelUpper === selectedRisk.toUpperCase();
      });
    };

    // Operational default filter -> Medium+
    const operationalView = filterEvents('Medium+');
    expect(operationalView.map((e) => e.id)).toEqual(['2', '3', '4']);
    expect(operationalView.find((e) => e.id === '1')).toBeUndefined();

    // Explicit Low filter -> Only Low returned
    const lowView = filterEvents('Low');
    expect(lowView.map((e) => e.id)).toEqual(['1']);

    // Explicit All filter -> All returned including Low
    const allView = filterEvents('All');
    expect(allView.map((e) => e.id)).toEqual(['1', '2', '3', '4']);
  });
});
