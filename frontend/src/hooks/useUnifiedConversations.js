import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { chatAPI } from "@/lib/api";

export function useUnifiedConversations(user, ws) {
  const [conversations, setConversations] = useState([]);
  const [filteredConvos, setFilteredConvos] = useState([]);
  const [convoSearch, setConvoSearch] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestCount, setRequestCount] = useState(0);
  const [searchParams] = useSearchParams();

  // ── Load unified conversation list ──────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.unifiedConversations();
      const data = res.data || {};
      const convos = data.conversations || [];
      setConversations(Array.isArray(convos) ? convos : []);
      setFilteredConvos(Array.isArray(convos) ? convos : []);
      if (typeof data.request_count === "number")
        setRequestCount(data.request_count);
    } catch {}
  }, []);

  // ── Open a conversation or group ────────────────────────────────────
  const openItem = useCallback((item) => {
    setActiveItem(item);
    setActiveType(item?.type || null);
  }, []);

  // ── Go back to conversation list ────────────────────────────────────
  const goBack = useCallback(() => {
    setActiveItem(null);
    setActiveType(null);
    loadConversations();
  }, [loadConversations]);

  // ── Patch active item in place (e.g. status change) ───────────────
  const updateActiveItem = useCallback((patch) => {
    setActiveItem((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // ── 1. Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // ── 2. Deep link support: ?user=xxx or ?group=xxx ───────────────────
  useEffect(() => {
    if (loading) return;
    const groupId = searchParams.get("group");
    const userId = searchParams.get("user");

    if (groupId) {
      const found = conversations.find(
        (c) => c.type === "group" && c.id === groupId
      );
      if (found) {
        openItem(found);
      } else {
        openItem({ id: groupId, type: "group" });
      }
    } else if (userId) {
      const found = conversations.find(
        (c) => c.type === "dm" && c.other_user?.id === userId
      );
      if (found) openItem(found);
    }
  }, [loading, searchParams, conversations, openItem]);

  // ── 3. Filter conversations by search ───────────────────────────────
  useEffect(() => {
    if (!convoSearch.trim()) {
      setFilteredConvos(conversations);
    } else {
      const q = convoSearch.toLowerCase();
      setFilteredConvos(
        conversations.filter((c) => c.display_name?.toLowerCase().includes(q))
      );
    }
  }, [convoSearch, conversations]);

  // ── 4. WS events to refresh list ───────────────────────────────────
  useEffect(() => {
    const { on: wsOn, off: wsOff } = ws;

    const refreshOnDm = () => loadConversations();
    const refreshOnGroup = () => loadConversations();

    const refreshOnRequest = () => loadConversations();

    wsOn("new_message", refreshOnDm);
    wsOn("group_message", refreshOnGroup);
    wsOn("request_accepted", refreshOnRequest);

    return () => {
      wsOff("new_message", refreshOnDm);
      wsOff("group_message", refreshOnGroup);
      wsOff("request_accepted", refreshOnRequest);
    };
  }, [ws, loadConversations]);

  // ── 5. Polling fallback (no active item + WS disconnected) ─────────
  useEffect(() => {
    if (activeItem || ws.connected) return;
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [activeItem, ws.connected, loadConversations]);

  // ── 6. Online heartbeat ─────────────────────────────────────────────
  useEffect(() => {
    chatAPI.heartbeat().catch(() => {});
    const interval = setInterval(
      () => chatAPI.heartbeat().catch(() => {}),
      15000
    );
    return () => clearInterval(interval);
  }, []);

  return {
    conversations,
    filteredConvos,
    convoSearch,
    setConvoSearch,
    activeItem,
    activeType,
    openItem,
    goBack,
    updateActiveItem,
    loading,
    requestCount,
    refreshConversations: loadConversations,
  };
}
