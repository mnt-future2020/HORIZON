import { useState, useEffect, useRef, useCallback } from "react";

const WS_BASE = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
  process.env.REACT_APP_BACKEND_URL
    ? new URL(process.env.REACT_APP_BACKEND_URL).host
    : window.location.host
}/api/live/ws`;

export function useLiveScore(liveMatchId) {
  const [matchData, setMatchData] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!liveMatchId || !mountedRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/${liveMatchId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        setConnected(true);
        retryRef.current = 0;
      }
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "initial_state") {
          setMatchData(msg);
          setEvents(msg.events || []);
          setSpectatorCount(msg.spectator_count || 0);
        } else if (msg.type === "score_update") {
          setMatchData((prev) => prev ? { ...prev, home: msg.home, away: msg.away, status: msg.status, period: msg.period, period_label: msg.period_label } : prev);
          setSpectatorCount(msg.spectator_count || 0);
        } else if (msg.type === "event") {
          setEvents((prev) => [...prev, msg.event]);
          setMatchData((prev) => prev ? { ...prev, home: msg.home, away: msg.away, status: msg.status } : prev);
          setSpectatorCount(msg.spectator_count || 0);
        } else if (msg.type === "period_change") {
          setMatchData((prev) => prev ? { ...prev, period: msg.period, period_label: msg.period_label, status: msg.status } : prev);
          setSpectatorCount(msg.spectator_count || 0);
        } else if (msg.type === "status_change") {
          setMatchData((prev) => prev ? { ...prev, status: msg.status } : prev);
          setSpectatorCount(msg.spectator_count || 0);
        } else if (msg.type === "spectator_count") {
          setSpectatorCount(msg.spectator_count || 0);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      retryRef.current += 1;
      setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [liveMatchId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { matchData, events, connected, spectatorCount };
}
