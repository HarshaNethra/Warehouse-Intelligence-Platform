import { useState, useEffect, useCallback, useRef } from 'react';
import { getAnalyticsSummary, getBehaviourAnalytics } from '../api/analytics';
import { mockAnalytics } from '../api/mockData';
import type { AnalyticsData } from '../types/analytics';

const DEFAULT_SUMMARY = {
  totalEvents: 0,
  criticalEvents: 0,
  highRiskEvents: 0,
  mediumRiskEvents: 0,
  lowRiskEvents: 0,
};

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData>(mockAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  const loadAnalytics = useCallback(async () => {
    const currentReqId = ++requestIdRef.current;

    try {
      const [summaryRes, behavioursRes] = await Promise.all([
        getAnalyticsSummary(),
        getBehaviourAnalytics()
      ]);

      if (!isMountedRef.current || currentReqId !== requestIdRef.current) {
        return;
      }

      setError(null);

      const safeSummary = {
        totalEvents: Number(summaryRes?.summary?.totalEvents ?? mockAnalytics.summary.totalEvents ?? DEFAULT_SUMMARY.totalEvents),
        criticalEvents: Number(summaryRes?.summary?.criticalEvents ?? mockAnalytics.summary.criticalEvents ?? DEFAULT_SUMMARY.criticalEvents),
        highRiskEvents: Number(summaryRes?.summary?.highRiskEvents ?? mockAnalytics.summary.highRiskEvents ?? DEFAULT_SUMMARY.highRiskEvents),
        mediumRiskEvents: Number(summaryRes?.summary?.mediumRiskEvents ?? mockAnalytics.summary.mediumRiskEvents ?? DEFAULT_SUMMARY.mediumRiskEvents),
        lowRiskEvents: Number(summaryRes?.summary?.lowRiskEvents ?? mockAnalytics.summary.lowRiskEvents ?? DEFAULT_SUMMARY.lowRiskEvents),
      };

      setAnalytics({
        summary: safeSummary,
        behaviours: Array.isArray(behavioursRes) && behavioursRes.length > 0 ? behavioursRes : mockAnalytics.behaviours
      });
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.warn('Error fetching analytics, using safe fallback data:', err);
      if (isMountedRef.current && currentReqId === requestIdRef.current) {
        setError(err?.message || 'Failed to fetch analytics');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const currentReqId = ++requestIdRef.current;

    Promise.all([getAnalyticsSummary(), getBehaviourAnalytics()])
      .then(([summaryRes, behavioursRes]) => {
        if (!isMountedRef.current || currentReqId !== requestIdRef.current) return;

        const safeSummary = {
          totalEvents: Number(summaryRes?.summary?.totalEvents ?? mockAnalytics.summary.totalEvents ?? DEFAULT_SUMMARY.totalEvents),
          criticalEvents: Number(summaryRes?.summary?.criticalEvents ?? mockAnalytics.summary.criticalEvents ?? DEFAULT_SUMMARY.criticalEvents),
          highRiskEvents: Number(summaryRes?.summary?.highRiskEvents ?? mockAnalytics.summary.highRiskEvents ?? DEFAULT_SUMMARY.highRiskEvents),
          mediumRiskEvents: Number(summaryRes?.summary?.mediumRiskEvents ?? mockAnalytics.summary.mediumRiskEvents ?? DEFAULT_SUMMARY.mediumRiskEvents),
          lowRiskEvents: Number(summaryRes?.summary?.lowRiskEvents ?? mockAnalytics.summary.lowRiskEvents ?? DEFAULT_SUMMARY.lowRiskEvents),
        };

        setAnalytics({
          summary: safeSummary,
          behaviours: Array.isArray(behavioursRes) && behavioursRes.length > 0 ? behavioursRes : mockAnalytics.behaviours,
        });
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        console.warn('Error fetching analytics, using safe fallback data:', err);
        if (isMountedRef.current && currentReqId === requestIdRef.current) {
          setError(err?.message || 'Failed to fetch analytics');
          setLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    return loadAnalytics();
  }, [loadAnalytics]);

  return { analytics, loading, error, refetch };
}

