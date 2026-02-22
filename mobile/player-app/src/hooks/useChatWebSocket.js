import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Derive WS URL from the same base as the REST API
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const WS_BASE = (() => {
  try {
    const url = new URL(BACKEND_URL);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/api/chat/ws`;
  } catch {
    return 'ws://localhost:8000/api/chat/ws';
  }
})();

export function useChatWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);
  const handlersRef = useRef({});

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    const token = await AsyncStorage.getItem('horizon_token');
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}?token=${token}`);
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
        if (msg.type === 'pong') return;
        const handler = handlersRef.current[msg.type];
        if (handler) handler(msg);
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Exponential backoff: 1s -> 2s -> 4s -> 8s -> max 15s
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      retryRef.current += 1;
      setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendTyping = useCallback((conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'typing', conversation_id: conversationId }),
      );
    }
  }, []);

  const on = useCallback((type, handler) => {
    handlersRef.current[type] = handler;
  }, []);

  const off = useCallback((type) => {
    delete handlersRef.current[type];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Ping keepalive every 25s
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      mountedRef.current = false;
      clearInterval(ping);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, sendTyping, on, off };
}
