import { useState, useEffect, useRef } from "react";

export interface TelemetryFrame {
  frame_id: number;
  timestamp: number;
  epoch_timestamp: number;
  bay_id: string;
  risk_score: number;
  status: "CRITICAL" | "HIGH" | "NOMINAL";
}

export const useRealtimeTelemetry = (wsUrl?: string) => {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState<TelemetryFrame | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  const targetUrl = wsUrl || (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000/ws/telemetry`
    : "ws://localhost:8000/ws/telemetry");

  useEffect(() => {
    let ws: WebSocket;
    let isMounted = true;

    try {
      ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) setIsConnected(true);
      };

      ws.onclose = () => {
        if (isMounted) setIsConnected(false);
      };

      ws.onerror = (err) => {
        console.warn("WebSocket telemetry error:", err);
        if (isMounted) setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const frame: TelemetryFrame = JSON.parse(event.data);
          if (isMounted) {
            setCurrentFrame(frame);
            setTelemetryHistory((prev) => {
              const updated = [...prev, frame];
              return updated.length > 60 ? updated.slice(updated.length - 60) : updated;
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket telemetry packet:", err);
        }
      };
    } catch (e) {
      console.warn("Failed to create WebSocket connection:", e);
      setIsConnected(false);
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [targetUrl]);

  return { telemetryHistory, currentFrame, isConnected };
};
