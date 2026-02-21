import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { chatAPI, userSearchAPI, socialAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Loader2, Search, MessageCircle,
  User, Plus, Check, CheckCheck, X, Trash2, Reply,
  MoreVertical, Phone, Video, Users, UserPlus, ContactRound, Share2
} from "lucide-react";
import { toast } from "sonner";

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startWithUser = searchParams.get("user");

  const [conversations, setConversations] = useState([]);
  const [filteredConvos, setFilteredConvos] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [convoSearch, setConvoSearch] = useState("");

  // New Message modal tabs
  const [activeTab, setActiveTab] = useState("all");
  const [tabFollowers, setTabFollowers] = useState([]);
  const [tabFollowing, setTabFollowing] = useState([]);
  const [syncedContacts, setSyncedContacts] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [contactSyncing, setContactSyncing] = useState(false);

  // WhatsApp features
  const [onlineStatus, setOnlineStatus] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [longPressMsg, setLongPressMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.conversations();
      const convos = res.data || [];
      setConversations(convos);
      setFilteredConvos(convos);
    } catch {}
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    try {
      const res = await chatAPI.getMessages(convoId);
      setMessages(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Auto-start conversation if ?user= param
  useEffect(() => {
    if (startWithUser && !loading) {
      handleStartConversation(startWithUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWithUser, loading]);

  // Poll messages in active chat
  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(() => loadMessages(activeConvo.id), 3000);
    return () => clearInterval(interval);
  }, [activeConvo, loadMessages]);

  // Poll conversation list
  useEffect(() => {
    if (activeConvo) return;
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [activeConvo, loadConversations]);

  // Online heartbeat
  useEffect(() => {
    chatAPI.heartbeat().catch(() => {});
    const interval = setInterval(() => chatAPI.heartbeat().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  // Check other user's online status
  useEffect(() => {
    if (!activeConvo?.other_user?.id) { setOnlineStatus(null); return; }
    const check = () => chatAPI.onlineStatus(activeConvo.other_user.id)
      .then(res => setOnlineStatus(res.data))
      .catch(() => {});
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [activeConvo]);

  // Check typing status
  useEffect(() => {
    if (!activeConvo?.id) return;
    const check = () => chatAPI.getTyping(activeConvo.id)
      .then(res => setIsTyping(res.data?.typing || false))
      .catch(() => {});
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [activeConvo]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Filter conversations
  useEffect(() => {
    if (!convoSearch.trim()) {
      setFilteredConvos(conversations);
    } else {
      setFilteredConvos(conversations.filter(c =>
        c.other_user?.name?.toLowerCase().includes(convoSearch.toLowerCase())
      ));
    }
  }, [convoSearch, conversations]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleStartConversation = async (userId) => {
    try {
      const res = await chatAPI.startConversation(userId);
      setActiveConvo(res.data);
      await loadMessages(res.data.id);
      setShowNewChat(false);
      setSearchQuery("");
      setSearchResults([]);
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start conversation");
    }
  };

  const handleSend = async () => {
    if (!msgText.trim() || sending || !activeConvo) return;
    const text = msgText.trim();
    setMsgText("");
    setSending(true);
    const reply = replyTo;
    setReplyTo(null);

    const tempMsg = {
      id: "temp-" + Date.now(),
      conversation_id: activeConvo.id,
      sender_id: user?.id,
      sender_name: user?.name,
      content: text,
      reply_to: reply?.id,
      reply_preview: reply?.content?.slice(0, 80),
      reply_sender: reply?.sender_name,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const payload = { content: text };
      if (reply?.id) payload.reply_to = reply.id;
      const res = await chatAPI.sendMessage(activeConvo.id, payload);
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...res.data, reply_preview: tempMsg.reply_preview, reply_sender: tempMsg.reply_sender } : m));
      loadConversations();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setMsgText(text);
      toast.error("Failed to send");
    } finally { setSending(false); }
  };

  const handleTyping = () => {
    if (!activeConvo?.id) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    chatAPI.setTyping(activeConvo.id).catch(() => {});
    typingTimeout.current = setTimeout(() => {}, 3000);
  };

  const handleDeleteMessage = async (msg) => {
    if (!activeConvo) return;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: "", deleted: true } : m));
    setLongPressMsg(null);
    try {
      await chatAPI.deleteMessage(activeConvo.id, msg.id);
    } catch {
      await loadMessages(activeConvo.id);
      toast.error("Failed to delete");
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (activeTab !== "all") return; // other tabs filter client-side
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await userSearchAPI.search(q);
      setSearchResults(res.data || []);
    } catch {} finally { setSearching(false); }
  };

  const loadTabData = useCallback(async () => {
    if (!user?.id) return;
    setTabLoading(true);
    try {
      const [followersRes, followingRes, contactsRes] = await Promise.all([
        socialAPI.getFollowers(user.id),
        socialAPI.getFollowing(user.id),
        socialAPI.getSyncedContacts(),
      ]);
      setTabFollowers(followersRes.data || []);
      setTabFollowing(followingRes.data || []);
      setSyncedContacts(contactsRes.data || []);
    } catch {} finally { setTabLoading(false); }
  }, [user?.id]);

  const handleSyncContactsInModal = async () => {
    setContactSyncing(true);
    try {
      const supportsContactPicker = "contacts" in navigator && "ContactsManager" in window;
      if (!supportsContactPicker) {
        toast.info("Contact Picker not supported on this browser. Visit the Contacts page for manual search.");
        setContactSyncing(false);
        return;
      }
      const contacts = await navigator.contacts.select(["tel", "email"], { multiple: true });
      const phones = contacts.flatMap(c => c.tel || []);
      const emails = contacts.flatMap(c => c.email || []);
      if (phones.length === 0 && emails.length === 0) {
        toast.info("No contacts selected");
        setContactSyncing(false);
        return;
      }
      const res = await socialAPI.syncContacts({ phones, emails });
      const freshContacts = await socialAPI.getSyncedContacts();
      setSyncedContacts(freshContacts.data || []);
      toast.success(`Found ${res.data?.total_found || 0} friends!`);
    } catch (err) {
      if (err.name === "TypeError") {
        toast.info("Contact access not available on this browser.");
      } else {
        toast.error("Failed to sync contacts");
      }
    }
    setContactSyncing(false);
  };

  const handleInviteFromModal = async () => {
    try {
      const res = await socialAPI.getInviteLink();
      const msg = res.data?.message || "Join me on Horizon Sports!";
      if (navigator.share) {
        await navigator.share({ title: "Join Horizon", text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        toast.success("Invite link copied!");
      }
    } catch {}
  };

  const getFilteredTabList = () => {
    const q = searchQuery.toLowerCase();
    switch (activeTab) {
      case "followers":
        return q.length >= 1 ? tabFollowers.filter(u => u.name?.toLowerCase().includes(q)) : tabFollowers;
      case "following":
        return q.length >= 1 ? tabFollowing.filter(u => u.name?.toLowerCase().includes(q)) : tabFollowing;
      case "contacts":
        return q.length >= 1 ? syncedContacts.filter(u => u.name?.toLowerCase().includes(q)) : syncedContacts;
      default:
        return searchResults;
    }
  };

  const openNewChatModal = () => {
    setShowNewChat(true);
    setActiveTab("all");
    setSearchQuery("");
    setSearchResults([]);
    loadTabData();
  };

  const closeNewChatModal = () => {
    setShowNewChat(false);
    setSearchQuery("");
    setSearchResults([]);
    setActiveTab("all");
  };

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    await loadMessages(convo.id);
    inputRef.current?.focus();
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const lastSeenText = () => {
    if (!onlineStatus) return "";
    if (onlineStatus.online) return "online";
    if (!onlineStatus.last_seen) return "";
    return `last seen ${timeAgo(onlineStatus.last_seen)}`;
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].date !== date) {
      acc.push({ date, messages: [msg] });
    } else {
      acc[acc.length - 1].messages.push(msg);
    }
    return acc;
  }, []);

  // Reusable row for the New Message modal
  const UserRow = ({ u, onSelect, badge }) => (
    <button onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 active:bg-secondary/50 transition-all text-left">
      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {u.avatar ? <img src={u.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
          : <User className="h-5 w-5 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold truncate block">{u.name}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground capitalize">{u.role || "player"}</span>
          {u.skill_rating && <span className="text-[10px] text-muted-foreground">{u.skill_rating} SR</span>}
          {badge && <span className="text-[9px] text-primary font-bold capitalize bg-primary/10 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
      </div>
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <MessageCircle className="h-4 w-4 text-primary" />
      </div>
    </button>
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE CHAT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeConvo) {
    return (
      <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
        {/* Chat Header — WhatsApp style */}
        <div className="bg-primary/5 border-b border-border px-3 py-2.5 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => { setActiveConvo(null); setOnlineStatus(null); setIsTyping(false); loadConversations(); }}
              className="text-muted-foreground hover:text-foreground p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative cursor-pointer" onClick={() => navigate(`/player-card/${activeConvo.other_user?.id}`)}>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {activeConvo.other_user?.avatar
                  ? <img src={activeConvo.other_user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <User className="h-5 w-5 text-primary" />}
              </div>
              {onlineStatus?.online && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/player-card/${activeConvo.other_user?.id}`)}>
              <h2 className="font-bold text-sm truncate">{activeConvo.other_user?.name || "Unknown"}</h2>
              <p className="text-[10px] leading-tight">
                {isTyping ? (
                  <span className="text-primary font-semibold">typing...</span>
                ) : onlineStatus?.online ? (
                  <span className="text-green-500 font-semibold">online</span>
                ) : lastSeenText() ? (
                  <span className="text-muted-foreground">{lastSeenText()}</span>
                ) : (
                  <span className="text-muted-foreground">tap for profile</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary-rgb,59,130,246),0.02),transparent_70%)]">
          <div className="max-w-3xl mx-auto space-y-0.5">
            {groupedMessages.map((dateGroup) => (
              <div key={dateGroup.date}>
                <div className="flex items-center justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-secondary/60 text-[10px] font-bold text-muted-foreground shadow-sm">
                    {dateGroup.date}
                  </span>
                </div>
                {dateGroup.messages.map((msg, mi) => {
                  const isMe = msg.sender_id === user?.id;
                  const prevMsg = mi > 0 ? dateGroup.messages[mi - 1] : null;
                  const showTail = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  const isDeleted = msg.deleted;

                  return (
                    <div key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? "mt-2" : "mt-0.5"}`}
                      onContextMenu={(e) => { e.preventDefault(); if (isMe && !isDeleted) setLongPressMsg(msg); }}
                      onClick={() => { if (longPressMsg && longPressMsg.id !== msg.id) setLongPressMsg(null); }}>
                      <div className={`max-w-[78%] relative group ${isMe ? "items-end" : "items-start"}`}>
                        {/* Reply preview */}
                        {(msg.reply_preview || msg.reply_to) && !isDeleted && (
                          <div className={`mx-1 mb-0.5 px-3 py-1.5 rounded-t-xl text-[10px] border-l-2 ${
                            isMe ? "bg-primary/20 border-primary/50" : "bg-secondary/80 border-muted-foreground/30"
                          }`}>
                            <span className="font-bold block">{msg.reply_sender || "Reply"}</span>
                            <span className="text-muted-foreground line-clamp-1">{msg.reply_preview || "..."}</span>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`px-3 py-1.5 text-[13px] leading-relaxed relative ${
                          isMe
                            ? `bg-primary text-primary-foreground ${showTail && !msg.reply_preview ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-r-sm"}`
                            : `bg-card border border-border/50 shadow-sm text-foreground ${showTail && !msg.reply_preview ? "rounded-2xl rounded-bl-sm" : "rounded-2xl rounded-l-sm"}`
                        } ${isDeleted ? "italic opacity-60" : ""}`}>
                          {isDeleted ? (
                            <span className="text-xs">🚫 This message was deleted</span>
                          ) : (
                            <>
                              {msg.content}
                              {msg.media_url && <img src={msg.media_url} alt="" className="rounded-lg mt-1.5 max-h-48 object-cover" />}
                            </>
                          )}
                        </div>

                        {/* Time + read receipt */}
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                          <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.created_at)}</span>
                          {isMe && !isDeleted && (
                            msg.read
                              ? <CheckCheck className="h-3 w-3 text-blue-400" />
                              : <Check className="h-3 w-3 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Quick action on hover (reply) */}
                        {!isDeleted && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                            className="absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            style={isMe ? { left: -28 } : { right: -28 }}>
                            <Reply className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mt-2">
                <div className="bg-card border border-border/50 shadow-sm rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-primary/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Say hello! 👋</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Messages are private between you two</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply preview bar */}
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="bg-card border-t border-border overflow-hidden">
              <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-2">
                <Reply className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                  <div className="text-[10px] font-bold text-primary">{replyTo.sender_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{replyTo.content}</div>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Input — WhatsApp style */}
        <div className="bg-background border-t border-border px-3 py-2 flex-shrink-0"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)" }}>
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <div className="flex-1 bg-card rounded-2xl border border-border/50 px-4 py-2 min-h-[44px] flex items-center">
              <textarea
                ref={inputRef}
                value={msgText}
                onChange={e => { setMsgText(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                className="w-full bg-transparent border-none outline-none resize-none text-sm placeholder:text-muted-foreground max-h-[120px]"
                rows={1}
                style={{ height: "auto" }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              />
            </div>
            <button onClick={handleSend} disabled={!msgText.trim() || sending}
              className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                msgText.trim() ? "bg-primary text-primary-foreground shadow-lg scale-100" : "bg-secondary text-muted-foreground scale-95"
              }`}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Message action sheet (long press) */}
        <AnimatePresence>
          {longPressMsg && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
              onClick={() => setLongPressMsg(null)}>
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-4" />
                <div className="p-3 rounded-xl bg-secondary/30 mb-4 text-sm line-clamp-2">
                  {longPressMsg.content}
                </div>
                <div className="space-y-1">
                  <button onClick={() => { setReplyTo(longPressMsg); setLongPressMsg(null); inputRef.current?.focus(); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    <Reply className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Reply</span>
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(longPressMsg.content); setLongPressMsg(null); toast.success("Copied!"); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Copy Text</span>
                  </button>
                  <button onClick={() => handleDeleteMessage(longPressMsg)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 transition-colors text-left text-destructive">
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Delete Message</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-black tracking-athletic">Chats</h1>
          <Button variant="athletic" size="sm" onClick={openNewChatModal}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>
        </div>

        {/* Search conversations */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 h-10 bg-secondary/30 border-border/50 rounded-xl text-sm"
            value={convoSearch}
            onChange={e => setConvoSearch(e.target.value)}
          />
        </div>

        {/* Conversation List */}
        <div className="space-y-0.5">
          {filteredConvos.map((convo, idx) => (
            <motion.button key={convo.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => openConversation(convo)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-secondary/30 active:bg-secondary/50 transition-all text-left">
              {/* Avatar with online indicator */}
              <div className="relative flex-shrink-0">
                <div className="h-13 w-13 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden"
                  style={{ width: 52, height: 52 }}>
                  {convo.other_user?.avatar
                    ? <img src={convo.other_user.avatar} alt="" className="rounded-full object-cover" style={{ width: 52, height: 52 }} />
                    : <User className="h-6 w-6 text-primary" />}
                </div>
                {convo.unread_count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {convo.unread_count > 9 ? "9+" : convo.unread_count}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm truncate ${convo.unread_count > 0 ? "text-foreground" : ""}`}>
                    {convo.other_user?.name || "Unknown"}
                  </span>
                  <span className={`text-[10px] flex-shrink-0 ml-2 ${convo.unread_count > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {timeAgo(convo.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {convo.last_message_by === user?.name && (
                    <CheckCheck className="h-3 w-3 text-blue-400 flex-shrink-0" />
                  )}
                  <p className={`text-xs truncate ${convo.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {convo.last_message || "No messages yet"}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {filteredConvos.length === 0 && conversations.length > 0 && (
          <div className="text-center py-12">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations match "{convoSearch}"</p>
          </div>
        )}

        {conversations.length === 0 && !showNewChat && (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <MessageCircle className="h-10 w-10 text-primary/50" />
            </div>
            <h3 className="font-display text-xl font-bold text-muted-foreground">No conversations yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-2 mb-6">Message players, coaches, and friends</p>
            <Button variant="athletic" onClick={openNewChatModal}>
              <Plus className="h-4 w-4 mr-2" /> Start a Conversation
            </Button>
          </div>
        )}

        {/* New Chat Modal — Tabbed */}
        <AnimatePresence>
          {showNewChat && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
              onClick={closeNewChatModal}>
              <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <h2 className="font-display font-bold text-lg">New Message</h2>
                  <button onClick={closeNewChatModal}
                    className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mx-4 mt-3 bg-secondary/30 rounded-lg p-1">
                  {[
                    { id: "all", label: "All", icon: Search },
                    { id: "followers", label: "Followers", icon: Users },
                    { id: "following", label: "Following", icon: UserPlus },
                    { id: "contacts", label: "Contacts", icon: ContactRound },
                  ].map(t => (
                    <button key={t.id} onClick={() => { setActiveTab(t.id); setSearchQuery(""); }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        activeTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="px-4 pt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={searchQuery} onChange={e => handleSearch(e.target.value)}
                      placeholder={activeTab === "all" ? "Search by name..." : `Search ${activeTab}...`}
                      className="pl-9 bg-secondary/30 border-border/50 rounded-xl" autoFocus />
                  </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                  {/* Loading */}
                  {(searching || tabLoading) && (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  )}

                  {/* All tab — existing search behavior */}
                  {!searching && !tabLoading && activeTab === "all" && (
                    <>
                      {searchResults.map(u => (
                        <UserRow key={u.id} u={u} onSelect={() => handleStartConversation(u.id)} />
                      ))}
                      {searchQuery.length >= 2 && searchResults.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
                      )}
                      {searchQuery.length < 2 && (
                        <p className="text-center text-sm text-muted-foreground py-8">Type a name to search</p>
                      )}
                    </>
                  )}

                  {/* Followers tab */}
                  {!tabLoading && activeTab === "followers" && (
                    <>
                      {getFilteredTabList().length > 0
                        ? getFilteredTabList().map(u => (
                          <UserRow key={u.id} u={u} onSelect={() => handleStartConversation(u.id)} />
                        ))
                        : <div className="text-center py-8">
                            <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {tabFollowers.length === 0 ? "No followers yet" : "No matches found"}
                            </p>
                          </div>
                      }
                    </>
                  )}

                  {/* Following tab */}
                  {!tabLoading && activeTab === "following" && (
                    <>
                      {getFilteredTabList().length > 0
                        ? getFilteredTabList().map(u => (
                          <UserRow key={u.id} u={u} onSelect={() => handleStartConversation(u.id)} />
                        ))
                        : <div className="text-center py-8">
                            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {tabFollowing.length === 0 ? "Not following anyone yet" : "No matches found"}
                            </p>
                          </div>
                      }
                    </>
                  )}

                  {/* Contacts tab */}
                  {!tabLoading && activeTab === "contacts" && (
                    <>
                      {/* Sync + Invite buttons */}
                      <div className="flex gap-2 mb-3">
                        <Button variant="outline" size="sm" className="flex-1 text-[11px] h-9"
                          onClick={handleSyncContactsInModal} disabled={contactSyncing}>
                          {contactSyncing
                            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            : <ContactRound className="h-3 w-3 mr-1" />}
                          Sync Contacts
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-[11px] h-9"
                          onClick={handleInviteFromModal}>
                          <Share2 className="h-3 w-3 mr-1" /> Invite Friends
                        </Button>
                      </div>
                      {getFilteredTabList().length > 0
                        ? getFilteredTabList().map(u => (
                          <UserRow key={u.id} u={u} onSelect={() => handleStartConversation(u.id)} badge={u.match_type} />
                        ))
                        : <div className="text-center py-8">
                            <ContactRound className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {syncedContacts.length === 0 ? "No synced contacts yet" : "No matches found"}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1">
                              Tap "Sync Contacts" to find friends on Horizon
                            </p>
                          </div>
                      }
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
