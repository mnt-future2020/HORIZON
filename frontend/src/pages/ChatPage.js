import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { chatAPI, userSearchAPI, socialAPI, groupAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Loader2, Search, MessageCircle,
  User, Plus, Check, CheckCheck, X, Trash2, Reply,
  MoreVertical, Phone, Video, Users, UserPlus, ContactRound, Share2,
  Paperclip, FileText, Mic, Play, Pause, Square,
  Pin, PinOff, BarChart3, Image, BellOff, Bell, Forward, Vote, Eraser,
  Inbox, ShieldCheck, ShieldX
} from "lucide-react";
import { toast } from "sonner";

const EMOJI_MAP = { thumbsup: "\uD83D\uDC4D", heart: "\u2764\uFE0F", laugh: "\uD83D\uDE02", wow: "\uD83D\uDE2E", fire: "\uD83D\uDD25", clap: "\uD83D\uDC4F" };
const EMOJI_LIST = Object.entries(EMOJI_MAP);

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

  // Message requests (Instagram-style)
  const [requestCount, setRequestCount] = useState(0);
  const [messageRequests, setMessageRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

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

  // File upload + voice + search + reactions
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [hoverReaction, setHoverReaction] = useState(null);

  // Pin, Polls, Media, Mute, Forward
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardConvos, setForwardConvos] = useState([]);

  const reactionPickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  // WebSocket
  const { connected: wsConnected, sendTyping: wsSendTyping, on: wsOn, off: wsOff } = useChatWebSocket();

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.conversations();
      const data = res.data || {};
      const convos = data.conversations || data || [];
      setConversations(Array.isArray(convos) ? convos : []);
      setFilteredConvos(Array.isArray(convos) ? convos : []);
      if (typeof data.request_count === "number") setRequestCount(data.request_count);
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

  // WebSocket event handlers
  useEffect(() => {
    wsOn("new_message", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      loadConversations();
    });
    wsOn("typing", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    });
    wsOn("online_status", (data) => {
      if (activeConvo?.other_user?.id === data.user_id) {
        setOnlineStatus(prev => ({ ...prev, online: data.online }));
      }
    });
    wsOn("message_deleted", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: "", deleted: true } : m));
      }
    });
    wsOn("messages_read", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setMessages(prev => prev.map(m => ({ ...m, read: true })));
      }
    });
    wsOn("message_reaction", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        loadMessages(activeConvo.id);
      }
    });
    wsOn("request_accepted", (data) => {
      // Requester gets notified their request was accepted
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setActiveConvo(prev => ({ ...prev, status: "active" }));
      }
      toast.success(`${data.accepted_by} accepted your message request`);
      loadConversations();
    });
    return () => { ["new_message","typing","online_status","message_deleted","messages_read","message_reaction","request_accepted"].forEach(t => wsOff(t)); };
  }, [activeConvo, wsOn, wsOff, loadConversations, loadMessages]);

  // Poll messages (fallback when WS disconnected)
  useEffect(() => {
    if (!activeConvo || wsConnected) return;
    const interval = setInterval(() => loadMessages(activeConvo.id), 3000);
    return () => clearInterval(interval);
  }, [activeConvo, loadMessages, wsConnected]);

  // Poll conversation list (fallback)
  useEffect(() => {
    if (activeConvo || wsConnected) return;
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [activeConvo, loadConversations, wsConnected]);

  // Online heartbeat (keep for DB presence even with WS)
  useEffect(() => {
    chatAPI.heartbeat().catch(() => {});
    const interval = setInterval(() => chatAPI.heartbeat().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  // Check other user's online status (fallback)
  useEffect(() => {
    if (!activeConvo?.other_user?.id) { setOnlineStatus(null); return; }
    if (wsConnected) return; // WS handles this
    const check = () => chatAPI.onlineStatus(activeConvo.other_user.id)
      .then(res => setOnlineStatus(res.data))
      .catch(() => {});
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [activeConvo, wsConnected]);

  // Check typing status (fallback)
  useEffect(() => {
    if (!activeConvo?.id || wsConnected) return;
    const check = () => chatAPI.getTyping(activeConvo.id)
      .then(res => setIsTyping(res.data?.typing || false))
      .catch(() => {});
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [activeConvo, wsConnected]);

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

  // Close emoji reaction picker on outside click
  useEffect(() => {
    if (!hoverReaction) return;
    const handleClickOutside = (e) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
        setHoverReaction(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [hoverReaction]);

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
    if ((!msgText.trim() && !pendingFile) || sending || !activeConvo) return;
    const text = msgText.trim();
    setMsgText("");
    setSending(true);
    const reply = replyTo;
    setReplyTo(null);
    const file = pendingFile;
    setPendingFile(null);

    // Upload file first if present
    let mediaUrl = "", mediaType = "", fileName = "";
    if (file) {
      setUploading(true);
      try {
        const uploadRes = await chatAPI.uploadFile(file);
        mediaUrl = uploadRes.data.url;
        mediaType = uploadRes.data.file_type;
        fileName = uploadRes.data.filename;
      } catch { toast.error("Upload failed"); setSending(false); setUploading(false); return; }
      setUploading(false);
    }

    const tempMsg = {
      id: "temp-" + Date.now(),
      conversation_id: activeConvo.id,
      sender_id: user?.id,
      sender_name: user?.name,
      content: text,
      media_url: mediaUrl,
      media_type: mediaType,
      file_name: fileName,
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
      if (mediaUrl) { payload.media_url = mediaUrl; payload.media_type = mediaType; payload.file_name = fileName; }
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
    if (wsConnected) {
      wsSendTyping(activeConvo.id);
    } else {
      chatAPI.setTyping(activeConvo.id).catch(() => {});
    }
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

  // Reactions
  const handleReaction = async (msg, emoji) => {
    try {
      await chatAPI.reactToMessage(activeConvo.id, msg.id, emoji);
      await loadMessages(activeConvo.id);
    } catch { toast.error("Failed to react"); }
    setHoverReaction(null);
  };

  // File select
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = file.type.startsWith("image/") ? 10 : 25;
    if (file.size > maxMB * 1024 * 1024) { toast.error(`Max file size is ${maxMB}MB`); return; }
    setPendingFile(file);
    e.target.value = "";
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    const recorder = mediaRecorderRef.current;
    const duration = recordingDuration;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);

    recorder.onstop = async () => {
      const mime = recorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mime });
      const ext = mime.includes("webm") ? ".webm" : ".ogg";
      const file = new File([blob], `voice_${Date.now()}${ext}`, { type: mime });
      recorder.stream.getTracks().forEach(t => t.stop());
      if (blob.size < 1000) return; // too short

      setSending(true);
      try {
        const uploadRes = await chatAPI.uploadFile(file);
        await chatAPI.sendMessage(activeConvo.id, {
          content: "", media_url: uploadRes.data.url, media_type: "voice", file_name: "Voice message", duration,
        });
        await loadMessages(activeConvo.id);
        loadConversations();
      } catch { toast.error("Failed to send voice message"); }
      finally { setSending(false); }
    };
    recorder.stop();
  };

  const cancelRecording = () => {
    if (!isRecording) return;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {};
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // Audio playback
  const togglePlayAudio = (msgId, url) => {
    if (playingAudio === msgId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingAudio(msgId);
  };

  // Message search
  const handleMsgSearch = async (q) => {
    setMsgSearchQuery(q);
    if (q.length < 2) { setMsgSearchResults([]); return; }
    try {
      const res = await chatAPI.searchMessages(activeConvo.id, q);
      setMsgSearchResults(res.data?.results || []);
    } catch {}
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
    }
    setShowMsgSearch(false);
    setMsgSearchQuery("");
    setMsgSearchResults([]);
  };

  // ─── Pin Messages ──────────────────────────────────────────────────────────
  const handlePinMessage = async (msg) => {
    try {
      await chatAPI.pinMessage(activeConvo.id, msg.id);
      toast.success("Message pinned");
      setLongPressMsg(null);
      await loadMessages(activeConvo.id);
    } catch { toast.error("Failed to pin"); }
  };

  const handleUnpinMessage = async (msg) => {
    try {
      await chatAPI.unpinMessage(activeConvo.id, msg.id);
      toast.success("Unpinned");
      setPinnedMessages(prev => prev.filter(m => m.id !== msg.id));
      await loadMessages(activeConvo.id);
    } catch { toast.error("Failed to unpin"); }
  };

  const loadPinnedMessages = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.getPinned(activeConvo.id);
      setPinnedMessages(res.data || []);
      setShowPinned(true);
    } catch { toast.error("Failed to load pinned messages"); }
  };

  // ─── Polls ────────────────────────────────────────────────────────────────
  const handleCreatePoll = async () => {
    const validOpts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOpts.length < 2) {
      toast.error("Need a question and at least 2 options");
      return;
    }
    try {
      await chatAPI.createPoll(activeConvo.id, { question: pollQuestion.trim(), options: validOpts });
      setShowPollCreate(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      await loadMessages(activeConvo.id);
      loadConversations();
    } catch { toast.error("Failed to create poll"); }
  };

  const handleVotePoll = async (msg, optionIndex) => {
    try {
      await chatAPI.votePoll(activeConvo.id, msg.id, optionIndex);
      await loadMessages(activeConvo.id);
    } catch { toast.error("Failed to vote"); }
  };

  // ─── Media Gallery ────────────────────────────────────────────────────────
  const loadMediaGallery = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.getMedia(activeConvo.id);
      setMediaItems(res.data?.media || res.data || []);
      setShowMediaGallery(true);
    } catch { toast.error("Failed to load media"); }
  };

  // ─── Mute ─────────────────────────────────────────────────────────────────
  const handleToggleMute = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.toggleMute(activeConvo.id);
      const muted = res.data?.muted ?? !isMuted;
      setIsMuted(muted);
      toast.success(muted ? "Conversation muted" : "Conversation unmuted");
    } catch { toast.error("Failed to toggle mute"); }
  };

  // ─── Forward ──────────────────────────────────────────────────────────────
  const openForwardModal = (msg) => {
    setForwardMsg(msg);
    setLongPressMsg(null);
    // Load conversations list for forwarding
    setForwardConvos(conversations.filter(c => c.id !== activeConvo?.id));
    setShowForwardModal(true);
  };

  const handleForwardToConvo = async (targetConvo) => {
    if (!forwardMsg) return;
    try {
      await groupAPI.forwardMessage({
        source_type: "dm",
        source_id: activeConvo.id,
        message_id: forwardMsg.id,
        target_type: "dm",
        target_id: targetConvo.id,
      });
      toast.success(`Forwarded to ${targetConvo.other_user?.name}`);
      setShowForwardModal(false);
      setForwardMsg(null);
    } catch { toast.error("Failed to forward"); }
  };

  // ─── Clear Chat (per-user) ──────────────────────────────────────────────────
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearChat = async () => {
    if (!activeConvo) return;
    try {
      await chatAPI.clearChat(activeConvo.id);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success("Chat cleared for you");
    } catch { toast.error("Failed to clear chat"); }
  };

  // ─── Message Requests ──────────────────────────────────────────────────────
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await chatAPI.getRequests();
      setMessageRequests(res.data || []);
    } catch { toast.error("Failed to load requests"); }
    finally { setRequestsLoading(false); }
  };

  const handleAcceptRequest = async (convo) => {
    try {
      await chatAPI.acceptRequest(convo.id);
      toast.success(`Accepted ${convo.other_user?.name}'s request`);
      // Move to active — reload both lists
      setMessageRequests(prev => prev.filter(r => r.id !== convo.id));
      setRequestCount(prev => Math.max(0, prev - 1));
      // Open the now-active conversation
      setActiveConvo({ ...convo, status: "active" });
      await loadMessages(convo.id);
      setShowRequests(false);
      loadConversations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to accept"); }
  };

  const handleDeclineRequest = async (convo) => {
    try {
      await chatAPI.declineRequest(convo.id);
      toast.success("Request declined");
      setMessageRequests(prev => prev.filter(r => r.id !== convo.id));
      setRequestCount(prev => Math.max(0, prev - 1));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to decline"); }
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
        {u.avatar ? <img src={mediaUrl(u.avatar)} alt="" className="h-11 w-11 rounded-full object-cover" />
          : <User className="h-5 w-5 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold truncate block">{u.name}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground capitalize">{u.role === "player" ? "lobbian" : (u.role || "lobbian")}</span>
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
                  ? <img src={mediaUrl(activeConvo.other_user.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
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
            <button onClick={loadPinnedMessages} className="p-2 rounded-full hover:bg-secondary/50" title="Pinned messages">
              <Pin className="h-4 w-4 text-foreground/70" />
            </button>
            <button onClick={loadMediaGallery} className="p-2 rounded-full hover:bg-secondary/50" title="Media gallery">
              <Image className="h-4 w-4 text-foreground/70" />
            </button>
            <button onClick={handleToggleMute} className="p-2 rounded-full hover:bg-secondary/50" title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <BellOff className="h-4 w-4 text-orange-400" /> : <Bell className="h-4 w-4 text-foreground/70" />}
            </button>
            <button onClick={() => { setShowMsgSearch(!showMsgSearch); setMsgSearchQuery(""); setMsgSearchResults([]); }}
              className="p-2 rounded-full hover:bg-secondary/50" title="Search messages">
              <Search className="h-4 w-4 text-foreground/70" />
            </button>
            <button onClick={() => setShowClearConfirm(true)} className="p-2 rounded-full hover:bg-secondary/50" title="Clear chat">
              <Eraser className="h-4 w-4 text-foreground/70" />
            </button>
          </div>
        </div>

        {/* Message Request Status Banner */}
        {activeConvo.status === "request" && (
          <div className={`px-4 py-2.5 flex-shrink-0 border-b border-border ${
            activeConvo.requester_id === user?.id
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-primary/5 border-primary/20"
          }`}>
            <div className="max-w-3xl mx-auto">
              {activeConvo.requester_id === user?.id ? (
                // Requester sees "waiting" indicator
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                  <span className="text-xs font-medium text-amber-600">
                    Request sent — waiting for {activeConvo.other_user?.name} to accept
                  </span>
                </div>
              ) : (
                // Recipient sees accept/decline
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-foreground/80 flex-1">
                    {activeConvo.other_user?.name} wants to message you
                  </span>
                  <Button size="sm" variant="athletic" className="h-7 text-xs px-3 rounded-full"
                    onClick={() => handleAcceptRequest(activeConvo)}>
                    <ShieldCheck className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-3 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => { handleDeclineRequest(activeConvo); setActiveConvo(null); }}>
                    <ShieldX className="h-3 w-3 mr-1" /> Decline
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clear Chat Confirmation */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowClearConfirm(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-card rounded-2xl p-6 w-full max-w-xs shadow-xl border border-border"
                onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-base mb-2">Clear Chat?</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Messages will be cleared only for you. The other person will still see their chat history.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleClearChat}>Clear</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Search Bar */}
        <AnimatePresence>
          {showMsgSearch && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              className="bg-card border-b border-border overflow-hidden">
              <div className="max-w-3xl mx-auto px-4 py-2">
                <Input value={msgSearchQuery} onChange={e => handleMsgSearch(e.target.value)}
                  placeholder="Search messages..." autoFocus className="h-9 bg-secondary/30 border-border/50 rounded-xl text-sm" />
              </div>
              {msgSearchResults.length > 0 && (
                <div className="max-w-3xl mx-auto px-4 pb-2 max-h-48 overflow-y-auto space-y-0.5">
                  {msgSearchResults.map(r => (
                    <button key={r.id} className="w-full text-left p-2 hover:bg-secondary/30 rounded-lg"
                      onClick={() => scrollToMessage(r.id)}>
                      <span className="text-[10px] text-muted-foreground">{r.sender_name} · {formatTime(r.created_at)}</span>
                      <p className="text-xs truncate">{r.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
                    <div key={msg.id} id={`msg-${msg.id}`}
                      className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? "mt-2" : "mt-0.5"} transition-all`}
                      onContextMenu={(e) => { e.preventDefault(); if (!isDeleted) setLongPressMsg(msg); }}
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
                            <span className="text-xs">{"\uD83D\uDEAB"} This message was deleted</span>
                          ) : (
                            <>
                              {msg.content && <span>{msg.content}</span>}
                              {/* Image */}
                              {msg.media_url && (!msg.media_type || msg.media_type === "image") && !msg.media_type?.startsWith("voice") && !msg.media_type?.startsWith("audio") && !msg.media_type?.startsWith("document") && (
                                <img src={mediaUrl(msg.media_url)} alt="" className="rounded-lg mt-1 max-h-52 object-cover cursor-pointer" onClick={() => window.open(mediaUrl(msg.media_url), "_blank")} />
                              )}
                              {/* Document */}
                              {msg.media_url && msg.media_type === "document" && (
                                <a href={mediaUrl(msg.media_url)} target="_blank" rel="noopener noreferrer"
                                  className={`flex items-center gap-2 mt-1 p-2 rounded-lg ${isMe ? "bg-white/10" : "bg-secondary/30"}`}>
                                  <FileText className="h-5 w-5 flex-shrink-0" />
                                  <span className="text-xs truncate">{msg.file_name || "Document"}</span>
                                </a>
                              )}
                              {/* Voice message */}
                              {msg.media_url && (msg.media_type === "voice" || msg.media_type === "audio") && (
                                <div className="flex items-center gap-2 mt-1 min-w-[180px]">
                                  <button onClick={() => togglePlayAudio(msg.id, mediaUrl(msg.media_url))}
                                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? "bg-white/20" : "bg-secondary/50"}`}>
                                    {playingAudio === msg.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                                  </button>
                                  <div className={`flex-1 h-1 rounded-full ${isMe ? "bg-white/20" : "bg-secondary/50"}`}>
                                    <div className={`h-1 rounded-full ${isMe ? "bg-white/60" : "bg-primary/60"}`} style={{ width: playingAudio === msg.id ? "60%" : "0%" }} />
                                  </div>
                                  <span className="text-[10px] opacity-70">
                                    {msg.duration ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}` : "0:00"}
                                  </span>
                                </div>
                              )}
                              {/* Poll */}
                              {msg.message_type === "poll" && msg.poll && (
                                <div className="mt-1 min-w-[200px]">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    <span className="font-bold text-xs">{msg.poll.question}</span>
                                  </div>
                                  {msg.poll.options?.map((opt, oi) => {
                                    const totalVotes = msg.poll.options.reduce((s, o) => s + (o.votes || 0), 0);
                                    const pct = totalVotes > 0 ? Math.round((opt.votes || 0) / totalVotes * 100) : 0;
                                    const voted = opt.voter_ids?.includes(user?.id);
                                    return (
                                      <button key={oi} onClick={() => handleVotePoll(msg, oi)}
                                        className={`w-full text-left mb-1 rounded-lg px-2.5 py-1.5 text-[11px] relative overflow-hidden border transition-all ${
                                          voted ? "border-primary/50 font-bold" : isMe ? "border-white/20 hover:border-white/40" : "border-border hover:border-primary/30"
                                        }`}>
                                        <div className={`absolute inset-0 ${voted ? "bg-primary/20" : isMe ? "bg-white/5" : "bg-primary/5"}`}
                                          style={{ width: `${pct}%` }} />
                                        <div className="relative flex justify-between">
                                          <span>{opt.text}</span>
                                          <span className="ml-2 opacity-70">{pct}%</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                  <span className="text-[9px] opacity-60">{msg.poll.options.reduce((s, o) => s + (o.votes || 0), 0)} votes</span>
                                </div>
                              )}
                              {/* Forwarded indicator */}
                              {msg.forwarded && (
                                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                  <Forward className="h-2.5 w-2.5" />
                                  <span className="text-[9px] italic">Forwarded</span>
                                </div>
                              )}
                              {/* Pin indicator */}
                              {msg.pinned && (
                                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                  <Pin className="h-2.5 w-2.5" />
                                  <span className="text-[9px] italic">Pinned</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Reaction pills */}
                        {msg.reactions?.length > 0 && (
                          <div className={`flex flex-wrap gap-0.5 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                            {Object.entries(msg.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, count]) => (
                              <button key={emoji} onClick={() => handleReaction(msg, emoji)}
                                className="px-1.5 py-0.5 rounded-full bg-secondary/60 text-[10px] hover:bg-secondary border border-border/30">
                                {EMOJI_MAP[emoji]} {count > 1 ? count : ""}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Time + read receipt */}
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                          <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.created_at)}</span>
                          {isMe && !isDeleted && (
                            msg.read
                              ? <CheckCheck className="h-3 w-3 text-blue-400" />
                              : <Check className="h-3 w-3 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Quick actions on hover (reply + react) */}
                        {!isDeleted && (
                          <div className="absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                            style={isMe ? { left: -60 } : { right: -60 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setHoverReaction(hoverReaction === msg.id ? null : msg.id); }}
                              className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]">
                              {"\uD83D\uDE00"}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                              className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground">
                              <Reply className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* Emoji reaction picker popup */}
                        {hoverReaction === msg.id && (
                          <div ref={reactionPickerRef} className={`absolute -top-8 z-10 flex gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg ${isMe ? "right-0" : "left-0"}`}>
                            {EMOJI_LIST.map(([key, emoji]) => (
                              <button key={key} onClick={() => handleReaction(msg, key)}
                                className="h-6 w-6 rounded-full hover:bg-secondary/50 flex items-center justify-center text-sm hover:scale-125 transition-transform">
                                {emoji}
                              </button>
                            ))}
                          </div>
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
                  <MessageCircle className="h-8 w-8 text-primary" />
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

        {/* Recording indicator */}
        {isRecording && (
          <div className="bg-red-500/10 border-t border-red-500/20 px-4 py-2 flex items-center gap-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-3 w-full">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">
                Recording {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
              </span>
              <button onClick={cancelRecording} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* File preview */}
        <AnimatePresence>
          {pendingFile && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="bg-card border-t border-border overflow-hidden">
              <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-2">
                <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {pendingFile.type.startsWith("image/") ? (
                    <img src={URL.createObjectURL(pendingFile)} alt="" className="h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs truncate">{pendingFile.name}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Input — WhatsApp style */}
        {activeConvo.status === "request" && activeConvo.requester_id !== user?.id ? (
          // Recipient can't type until they accept
          <div className="bg-background border-t border-border px-3 py-3 flex-shrink-0 text-center"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)" }}>
            <p className="text-xs text-muted-foreground">Accept the request to reply</p>
          </div>
        ) : (
        <div className="bg-background border-t border-border px-3 py-2 flex-shrink-0"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)" }}>
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            {/* Attachment button */}
            <input ref={fileInputRef} type="file" className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
            <button onClick={() => fileInputRef.current?.click()}
              className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-secondary/50 text-muted-foreground">
              <Paperclip className="h-5 w-5" />
            </button>
            {/* Poll button */}
            <button onClick={() => setShowPollCreate(true)}
              className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-secondary/50 text-muted-foreground"
              title="Create poll">
              <BarChart3 className="h-5 w-5" />
            </button>

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

            {/* Send or Mic button */}
            {msgText.trim() || pendingFile ? (
              <button onClick={handleSend} disabled={sending || uploading}
                className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-primary-foreground shadow-lg transition-all">
                {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => { if (isRecording) stopRecording(); }}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isRecording ? "bg-red-500 text-white animate-pulse scale-110" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}>
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        )}

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
                {/* Quick reactions */}
                <div className="flex justify-center gap-2 mb-4">
                  {EMOJI_LIST.map(([key, emoji]) => (
                    <button key={key} onClick={() => { handleReaction(longPressMsg, key); setLongPressMsg(null); }}
                      className="h-10 w-10 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center text-lg hover:scale-110 transition-transform">
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-secondary/30 mb-4 text-sm line-clamp-2">
                  {longPressMsg.content || (longPressMsg.media_type === "voice" ? "Voice message" : longPressMsg.file_name || "Media")}
                </div>
                <div className="space-y-1">
                  <button onClick={() => { setReplyTo(longPressMsg); setLongPressMsg(null); inputRef.current?.focus(); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    <Reply className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Reply</span>
                  </button>
                  {/* Pin / Unpin */}
                  <button onClick={() => { longPressMsg.pinned ? handleUnpinMessage(longPressMsg) : handlePinMessage(longPressMsg); setLongPressMsg(null); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    {longPressMsg.pinned ? <PinOff className="h-5 w-5 text-muted-foreground" /> : <Pin className="h-5 w-5 text-muted-foreground" />}
                    <span className="text-sm font-medium">{longPressMsg.pinned ? "Unpin Message" : "Pin Message"}</span>
                  </button>
                  {/* Forward */}
                  <button onClick={() => openForwardModal(longPressMsg)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    <Forward className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Forward</span>
                  </button>
                  {longPressMsg.content && (
                    <button onClick={() => { navigator.clipboard.writeText(longPressMsg.content); setLongPressMsg(null); toast.success("Copied!"); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                      <MessageCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Copy Text</span>
                    </button>
                  )}
                  {longPressMsg.sender_id === user?.id && (
                    <button onClick={() => handleDeleteMessage(longPressMsg)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 transition-colors text-left text-destructive">
                      <Trash2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Delete Message</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ PINNED MESSAGES MODAL ═══ */}
        <AnimatePresence>
          {showPinned && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
              onClick={() => setShowPinned(false)}>
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8 max-h-[60vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Pin className="h-4 w-4" /> Pinned Messages</h3>
                  <button onClick={() => setShowPinned(false)}><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {pinnedMessages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No pinned messages</p>
                  ) : pinnedMessages.map(msg => (
                    <div key={msg.id} className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-primary">{msg.sender_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                          <button onClick={() => handleUnpinMessage(msg)} className="text-muted-foreground hover:text-destructive">
                            <PinOff className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs">{msg.content || (msg.media_type === "voice" ? "Voice message" : "Media")}</p>
                      <button onClick={() => { scrollToMessage(msg.id); setShowPinned(false); }}
                        className="text-[10px] text-primary mt-1 hover:underline">Jump to message</button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ POLL CREATE MODAL ═══ */}
        <AnimatePresence>
          {showPollCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
              onClick={() => setShowPollCreate(false)}>
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Create Poll</h3>
                <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..." className="mb-3 bg-secondary/30 border-border/50 rounded-xl" />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <Input value={opt} onChange={e => { const opts = [...pollOptions]; opts[i] = e.target.value; setPollOptions(opts); }}
                      placeholder={`Option ${i + 1}`} className="bg-secondary/30 border-border/50 rounded-xl" />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs text-primary font-medium mb-3 hover:underline">+ Add option</button>
                )}
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setShowPollCreate(false)} className="flex-1">Cancel</Button>
                  <Button variant="athletic" size="sm" onClick={handleCreatePoll} className="flex-1">Create Poll</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ MEDIA GALLERY MODAL ═══ */}
        <AnimatePresence>
          {showMediaGallery && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
              onClick={() => setShowMediaGallery(false)}>
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8 max-h-[70vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Image className="h-4 w-4" /> Shared Media</h3>
                  <button onClick={() => setShowMediaGallery(false)}><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {mediaItems.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No shared media yet</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {mediaItems.map((item, i) => (
                        <button key={i} onClick={() => window.open(mediaUrl(item.media_url || item.url), "_blank")}
                          className="aspect-square rounded-lg overflow-hidden bg-secondary/30 hover:opacity-80 transition-opacity">
                          {(item.media_type === "image" || !item.media_type) ? (
                            <img src={mediaUrl(item.media_url || item.url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground mt-1 block">{item.media_type}</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ FORWARD MESSAGE MODAL ═══ */}
        <AnimatePresence>
          {showForwardModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
              onClick={() => { setShowForwardModal(false); setForwardMsg(null); }}>
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8 max-h-[60vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
                <h3 className="font-bold text-sm mb-1 flex items-center gap-2"><Forward className="h-4 w-4" /> Forward Message</h3>
                <p className="text-[10px] text-muted-foreground mb-3 truncate">"{forwardMsg?.content || "Media"}"</p>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {forwardConvos.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No other conversations</p>
                  ) : forwardConvos.map(convo => (
                    <button key={convo.id} onClick={() => handleForwardToConvo(convo)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors text-left">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {convo.other_user?.avatar
                          ? <img src={mediaUrl(convo.other_user.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                          : <User className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold truncate block">{convo.other_user?.name || "Unknown"}</span>
                      </div>
                      <Forward className="h-4 w-4 text-primary" />
                    </button>
                  ))}
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 h-10 bg-secondary/30 border-border/50 rounded-xl text-sm"
            value={convoSearch}
            onChange={e => setConvoSearch(e.target.value)}
          />
        </div>

        {/* Message Requests Banner */}
        {requestCount > 0 && (
          <button onClick={() => { setShowRequests(true); loadRequests(); }}
            className="w-full flex items-center gap-3 p-3.5 mb-3 rounded-2xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-all text-left">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm">Message Requests</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requestCount} pending {requestCount === 1 ? "request" : "requests"}
              </p>
            </div>
            <span className="h-6 min-w-[24px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
              {requestCount}
            </span>
          </button>
        )}

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
                    ? <img src={mediaUrl(convo.other_user.avatar)} alt="" className="rounded-full object-cover" style={{ width: 52, height: 52 }} />
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
            <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No conversations match "{convoSearch}"</p>
          </div>
        )}

        {conversations.length === 0 && !showNewChat && (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <MessageCircle className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-display text-xl font-bold text-muted-foreground">No conversations yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-2 mb-6">Message Lobbians, coaches, and friends</p>
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
                            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
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
                            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
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
                            <ContactRound className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
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

        {/* ═══ MESSAGE REQUESTS MODAL ═══ */}
        <AnimatePresence>
          {showRequests && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
              onClick={() => setShowRequests(false)}>
              <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-primary" /> Message Requests
                  </h2>
                  <button onClick={() => setShowRequests(false)}
                    className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                <p className="px-4 pt-3 text-[11px] text-muted-foreground">
                  These people want to message you. Accept to start chatting.
                </p>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {requestsLoading && (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  )}
                  {!requestsLoading && messageRequests.length === 0 && (
                    <div className="text-center py-12">
                      <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No message requests</p>
                    </div>
                  )}
                  {!requestsLoading && messageRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/20 border border-border/50">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/player-card/${req.other_user?.id}`)}>
                        {req.other_user?.avatar
                          ? <img src={mediaUrl(req.other_user.avatar)} alt="" className="h-12 w-12 rounded-full object-cover" />
                          : <User className="h-6 w-6 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-sm truncate block">{req.other_user?.name || "Unknown"}</span>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {req.last_message || "Wants to message you"}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleAcceptRequest(req)}
                          className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                          title="Accept">
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeclineRequest(req)}
                          className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                          title="Decline">
                          <ShieldX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
