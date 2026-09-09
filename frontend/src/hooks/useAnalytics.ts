import { useState, useEffect, useCallback, useRef } from 'react';
import { getAnalyticsSummary, getBehaviourAnalytics } from '../api/analytics';
import type { AnalyticsData } from '../types/analytics';

const DEFAULT_SUMMARY = {
  totalEvents: 0,
  criticalEvents: 0,
  highRiskEvents: 0,
  mediumRiskEvents: 0,
  lowRiskEvents: 0,
  preventionIndex: 0.0,
  activeIncidents: 0,
  resolvedIncidents: 0,
  repeatBehaviourPct: 0.0
};

export function useAnalytics(pollingIntervalMs: number = 4000) {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    summary: DEFAULT_SUMMARY,
    behaviours: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const isMountedRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  const loadAnalytics = useCallback(async (isSilent: boolean = false) => {
    const currentReqId = ++requestIdRef.current;

    try {
      if (!isSilent) setLoading(true);

      const [summaryRes, behavioursRes] = await Promise.all([
        getAnalyticsSummary(),
        getBehaviourAnalytics()
      ]);

      if (!isMountedRef.current || currentReqId !== requestIdRef.current) {
        return;
      }

      const safeSummary = {
        totalEvents: Number(summaryRes?.summary?.totalEvents ?? 0),
        criticalEvents: Number(summaryRes?.summary?.criticalEvents ?? 0),
        highRiskEvents: Number(summaryRes?.summary?.highRiskEvents ?? 0),
        mediumRiskEvents: Number(summaryRes?.summary?.mediumRiskEvents ?? 0),
        lowRiskEvents: Number(summaryRes?.summary?.lowRiskEvents ?? 0),
        preventionIndex: Number(summaryRes?.summary?.preventionIndex ?? 0.0),
        activeIncidents: Number(summaryRes?.summary?.activeIncidents ?? 0),
        resolvedIncidents: Number(summaryRes?.summary?.resolvedIncidents ?? 0),
        repeatBehaviourPct: Number(summaryRes?.summary?.repeatBehaviourPct ?? 0.0)
      };

      setAnalytics({
        summary: safeSummary,
        behaviours: Array.isArray(behavioursRes) ? behavioursRes : []
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.warn('Error fetching analytics API:', err);
      if (isMountedRef.current && currentReqId === requestIdRef.current && !isSilent) {
        setError(err?.message || 'Failed to fetch operational analytics');
      }
    } finally {
      if (isMountedRef.current && currentReqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadAnalytics(false);

    let timer: any = null;
    if (pollingIntervalMs > 0) {
      timer = setInterval(() => {
        void loadAnalytics(true);
      }, pollingIntervalMs);
    }

    return () => {
      isMountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [loadAnalytics, pollingIntervalMs]);

  const refetch = useCallback(() => {
    return loadAnalytics(false);
  }, [loadAnalytics]);

  return { analytics, loading, error, refetch, lastUpdated };
}
