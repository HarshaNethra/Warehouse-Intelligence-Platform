import { useState, useEffect, useCallback, useRef } from 'react';
import type { Event, EventFilterParams } from '../types/event';
import { getEvents } from '../api/events';

export function useEvents(params?: EventFilterParams) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Serialized representation of params for stable dependency tracking
  const risk = params?.risk_level;
  const behaviour = params?.behaviour;
  const bay = params?.bay_id;
  const camera = params?.camera_id;
  const search = params?.search;
  const limit = params?.limit;
  const skip = params?.skip;

  const loadEvents = useCallback(async () => {
    // 1. Cancel previous in-flight request
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentReqId = ++requestIdRef.current;

    try {
      const data = await getEvents(
        {
          risk_level: risk,
          behaviour,
          bay_id: bay,
          camera_id: camera,
          search,
          limit,
          skip,
        },
        { signal: controller.signal }
      );

      // 2. Discard if unmounted, superseded by a newer request, or aborted
      if (!isMountedRef.current || currentReqId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setEvents(data);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      // 3. Silently swallow aborted requests
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      // 4. Only update state if this request is still the newest active one
      if (isMountedRef.current && currentReqId === requestIdRef.current) {
        setError(err?.message || 'Failed to fetch events');
        setLoading(false);
      }
    }
  }, [risk, behaviour, bay, camera, search, limit, skip]);

  useEffect(() => {
    isMountedRef.current = true;
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentReqId = ++requestIdRef.current;

    getEvents(
      {
        risk_level: risk,
        behaviour,
        bay_id: bay,
        camera_id: camera,
        search,
        limit,
        skip,
      },
      { signal: controller.signal }
    )
      .then((data) => {
        if (!isMountedRef.current || currentReqId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }
        setEvents(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        if (isMountedRef.current && currentReqId === requestIdRef.current) {
          setError(err?.message || 'Failed to fetch events');
          setLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [risk, behaviour, bay, camera, search, limit, skip]);

  const refetch = useCallback(() => {
    setLoading(true);
    return loadEvents();
  }, [loadEvents]);

  return { events, loading, error, refetch };
}

