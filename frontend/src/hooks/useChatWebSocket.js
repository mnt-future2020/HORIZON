import { useState, useEffect, useRef, useCallback } from "react";

const WS_BASE = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
  process.env.REACT_APP_BACKEND_URL
    ? new URL(process.env.REACT_APP_BACKEND_URL).host
    : window.location.host
}/api/chat/ws`;

export function useChatWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);
  const handlersRef = useRef({});

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const token = localStorage.getItem("horizon_token");
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
        if (msg.type === "pong") return;
        const arr = handlersRef.current[msg.type];
        if (arr) arr.forEach((h) => h(msg));
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      retryRef.current += 1;
      setTimeout(() => { if (mountedRef.current) connect(); }, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  const sendTyping = useCallback((conversationId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversation_id: conversationId }));
    }
  }, []);

  const sendGroupTyping = useCallback((groupId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "group_typing", group_id: groupId }));
    }
  }, []);

  const on = useCallback((type, handler) => {
    if (!handlersRef.current[type]) handlersRef.current[type] = [];
    handlersRef.current[type].push(handler);
  }, []);

  const off = useCallback((type, handler) => {
    if (!handler) {
      delete handlersRef.current[type];
      return;
    }
    const arr = handlersRef.current[type];
    if (arr) handlersRef.current[type] = arr.filter((h) => h !== handler);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    // Ping keepalive every 25s
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    return () => {
      mountedRef.current = false;
      clearInterval(ping);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [connect]);

  return { connected, sendTyping, sendGroupTyping, on, off };
}
