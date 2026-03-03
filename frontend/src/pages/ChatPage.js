import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { chatAPI, userSearchAPI, socialAPI, groupAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle, User, Plus, X } from "lucide-react";
import { toast } from "sonner";

// Refactored Components
import NewChatModal from "@/components/chat/NewChatModal";
import MessageRequestsModal from "@/components/chat/MessageRequestsModal";
import ConversationList from "@/components/chat/ConversationList";
import ActiveChat from "@/components/chat/ActiveChat";

const EMOJI_MAP = {
  thumbsup: "\uD83D\uDC4D",
  heart: "\u2764\uFE0F",
  laugh: "\uD83D\uDE02",
  wow: "\uD83D\uDE2E",
  fire: "\uD83D\uDD25",
  clap: "\uD83D\uDC4F",
};
const EMOJI_LIST = Object.entries(EMOJI_MAP);
const REACTION_EMOJI = {
  fire: "\uD83D\uDD25",
  trophy: "\uD83C\uDFC6",
  clap: "\uD83D\uDC4F",
  heart: "\u2764\uFE0F",
  100: "\uD83D\uDCAF",
  muscle: "\uD83D\uDCAA",
};

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startWithUser = searchParams.get("user");

  // Check for reduced motion preference (must be before any conditional returns)
  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

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

  // UX: scroll FAB, image lightbox, emoji picker
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgWhileAway, setNewMsgWhileAway] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Shared post detail modal
  const [viewPost, setViewPost] = useState(null);
  const [viewPostComments, setViewPostComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const openSharedPost = useCallback(async (postId) => {
    try {
      const res = await socialAPI.getPost(postId);
      if (res.data) {
        setViewPost(res.data);
        socialAPI
          .getComments(postId)
          .then((r) => setViewPostComments(r.data || []))
          .catch(() => {});
      }
    } catch (err) {
      toast.error("Post not found or deleted");
    }
  }, []);

  const reactionPickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const msgContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevMsgLengthRef = useRef(0);
  const emojiPickerRef = useRef(null);

  // WebSocket
  const {
    connected: wsConnected,
    sendTyping: wsSendTyping,
    on: wsOn,
    off: wsOff,
  } = useChatWebSocket();

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.conversations();
      const data = res.data || {};
      const convos = data.conversations || data || [];
      setConversations(Array.isArray(convos) ? convos : []);
      setFilteredConvos(Array.isArray(convos) ? convos : []);
      if (typeof data.request_count === "number")
        setRequestCount(data.request_count);
    } catch {}
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    try {
      const res = await chatAPI.getMessages(convoId);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Lock page scroll when in active chat so only the message area scrolls
  useEffect(() => {
    if (activeConvo) {
      window.scrollTo(0, 0);
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [activeConvo]);

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
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
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
        setOnlineStatus((prev) => ({ ...prev, online: data.online }));
      }
    });
    wsOn("message_deleted", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id ? { ...m, content: "", deleted: true } : m,
          ),
        );
      }
    });
    wsOn("messages_read", (data) => {
      if (activeConvo && data.conversation_id === activeConvo.id) {
        setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
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
        setActiveConvo((prev) => ({ ...prev, status: "active" }));
      }
      toast.success(`${data.accepted_by} accepted your message request`);
      loadConversations();
    });
    return () => {
      [
        "new_message",
        "typing",
        "online_status",
        "message_deleted",
        "messages_read",
        "message_reaction",
        "request_accepted",
      ].forEach((t) => wsOff(t));
    };
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
    const interval = setInterval(
      () => chatAPI.heartbeat().catch(() => {}),
      15000,
    );
    return () => clearInterval(interval);
  }, []);

  // Check other user's online status (fallback)
  useEffect(() => {
    if (!activeConvo?.other_user?.id) {
      setOnlineStatus(null);
      return;
    }
    if (wsConnected) return; // WS handles this
    const check = () =>
      chatAPI
        .onlineStatus(activeConvo.other_user.id)
        .then((res) => setOnlineStatus(res.data))
        .catch(() => {});
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [activeConvo, wsConnected]);

  // Check typing status (fallback)
  useEffect(() => {
    if (!activeConvo?.id || wsConnected) return;
    const check = () =>
      chatAPI
        .getTyping(activeConvo.id)
        .then((res) => setIsTyping(res.data?.typing || false))
        .catch(() => {});
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [activeConvo, wsConnected]);

  // Scroll to bottom on initial convo load
  useEffect(() => {
    if (!activeConvo?.id) return;
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      isAtBottomRef.current = true;
      setShowScrollBtn(false);
      setNewMsgWhileAway(0);
      prevMsgLengthRef.current = messages.length;
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvo?.id]);

  // Handle new messages: auto-scroll if at bottom, else show FAB badge
  useEffect(() => {
    const newLen = messages.length;
    if (newLen > prevMsgLengthRef.current) {
      if (isAtBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setNewMsgWhileAway(0);
      } else {
        setNewMsgWhileAway(
          (prev) => prev + (newLen - prevMsgLengthRef.current),
        );
      }
    }
    prevMsgLengthRef.current = newLen;
  }, [messages]);

  // Scroll to bottom when typing indicator appears (only if at bottom)
  useEffect(() => {
    if (isTyping && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isTyping]);

  // Filter conversations
  useEffect(() => {
    if (!convoSearch.trim()) {
      setFilteredConvos(conversations);
    } else {
      setFilteredConvos(
        conversations.filter((c) =>
          c.other_user?.name?.toLowerCase().includes(convoSearch.toLowerCase()),
        ),
      );
    }
  }, [convoSearch, conversations]);

  // Close emoji reaction picker on outside click
  useEffect(() => {
    if (!hoverReaction) return;
    const handleClickOutside = (e) => {
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target)
      ) {
        setHoverReaction(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [hoverReaction]);

  // Close emoji input picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

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
    setShowEmojiPicker(false);
    setSending(true);
    const reply = replyTo;
    setReplyTo(null);
    const file = pendingFile;
    setPendingFile(null);

    // Upload file first if present
    let mediaUrl = "",
      mediaType = "",
      fileName = "";
    if (file) {
      setUploading(true);
      try {
        const uploadRes = await chatAPI.uploadFile(file);
        mediaUrl = uploadRes.data.url;
        mediaType = uploadRes.data.file_type;
        fileName = uploadRes.data.filename;
      } catch {
        toast.error("Upload failed");
        setSending(false);
        setUploading(false);
        return;
      }
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
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const payload = { content: text };
      if (reply?.id) payload.reply_to = reply.id;
      if (mediaUrl) {
        payload.media_url = mediaUrl;
        payload.media_type = mediaType;
        payload.file_name = fileName;
      }
      const res = await chatAPI.sendMessage(activeConvo.id, payload);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempMsg.id
            ? {
                ...res.data,
                reply_preview: tempMsg.reply_preview,
                reply_sender: tempMsg.reply_sender,
              }
            : m,
        ),
      );
      loadConversations();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setMsgText(text);
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
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
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, content: "", deleted: true } : m,
      ),
    );
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
    } catch {
      toast.error("Failed to react");
    }
    setHoverReaction(null);
  };

  // File select
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = file.type.startsWith("image/") ? 10 : 25;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Max file size is ${maxMB}MB`);
      return;
    }
    setPendingFile(file);
    e.target.value = "";
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "",
      });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingDuration((prev) => prev + 1),
        1000,
      );
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = async () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    )
      return;
    const recorder = mediaRecorderRef.current;
    const duration = recordingDuration;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);

    recorder.onstop = async () => {
      const mime = recorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mime });
      const ext = mime.includes("webm") ? ".webm" : ".ogg";
      const file = new File([blob], `voice_${Date.now()}${ext}`, {
        type: mime,
      });
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (blob.size < 1000) return; // too short

      setSending(true);
      try {
        const uploadRes = await chatAPI.uploadFile(file);
        await chatAPI.sendMessage(activeConvo.id, {
          content: "",
          media_url: uploadRes.data.url,
          media_type: "voice",
          file_name: "Voice message",
          duration,
        });
        await loadMessages(activeConvo.id);
        loadConversations();
      } catch {
        toast.error("Failed to send voice message");
      } finally {
        setSending(false);
      }
    };
    recorder.stop();
  };

  const cancelRecording = () => {
    if (!isRecording) return;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {};
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
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
    if (q.length < 2) {
      setMsgSearchResults([]);
      return;
    }
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
    } catch {
      toast.error("Failed to pin");
    }
  };

  const handleUnpinMessage = async (msg) => {
    try {
      await chatAPI.unpinMessage(activeConvo.id, msg.id);
      toast.success("Unpinned");
      setPinnedMessages((prev) => prev.filter((m) => m.id !== msg.id));
      await loadMessages(activeConvo.id);
    } catch {
      toast.error("Failed to unpin");
    }
  };

  const loadPinnedMessages = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.getPinned(activeConvo.id);
      setPinnedMessages(res.data || []);
      setShowPinned(true);
    } catch {
      toast.error("Failed to load pinned messages");
    }
  };

  // ─── Polls ────────────────────────────────────────────────────────────────
  const handleCreatePoll = async () => {
    const validOpts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOpts.length < 2) {
      toast.error("Need a question and at least 2 options");
      return;
    }
    try {
      await chatAPI.createPoll(activeConvo.id, {
        question: pollQuestion.trim(),
        options: validOpts,
      });
      setShowPollCreate(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      await loadMessages(activeConvo.id);
      loadConversations();
    } catch {
      toast.error("Failed to create poll");
    }
  };

  const handleVotePoll = async (msg, optionIndex) => {
    try {
      await chatAPI.votePoll(activeConvo.id, msg.id, optionIndex);
      await loadMessages(activeConvo.id);
    } catch {
      toast.error("Failed to vote");
    }
  };

  // ─── Media Gallery ────────────────────────────────────────────────────────
  const loadMediaGallery = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.getMedia(activeConvo.id);
      setMediaItems(res.data?.media || res.data || []);
      setShowMediaGallery(true);
    } catch {
      toast.error("Failed to load media");
    }
  };

  // ─── Mute ─────────────────────────────────────────────────────────────────
  const handleToggleMute = async () => {
    if (!activeConvo) return;
    try {
      const res = await chatAPI.toggleMute(activeConvo.id);
      const muted = res.data?.muted ?? !isMuted;
      setIsMuted(muted);
      toast.success(muted ? "Conversation muted" : "Conversation unmuted");
    } catch {
      toast.error("Failed to toggle mute");
    }
  };

  // ─── Forward ──────────────────────────────────────────────────────────────
  const openForwardModal = (msg) => {
    setForwardMsg(msg);
    setLongPressMsg(null);
    // Load conversations list for forwarding
    setForwardConvos(conversations.filter((c) => c.id !== activeConvo?.id));
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
    } catch {
      toast.error("Failed to forward");
    }
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
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  // ─── Message Requests ──────────────────────────────────────────────────────
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await chatAPI.getRequests();
      setMessageRequests(res.data || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleAcceptRequest = async (convo) => {
    try {
      await chatAPI.acceptRequest(convo.id);
      toast.success(`Accepted ${convo.other_user?.name}'s request`);
      // Move to active — reload both lists
      setMessageRequests((prev) => prev.filter((r) => r.id !== convo.id));
      setRequestCount((prev) => Math.max(0, prev - 1));
      // Open the now-active conversation
      setActiveConvo({ ...convo, status: "active" });
      await loadMessages(convo.id);
      setShowRequests(false);
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to accept");
    }
  };

  const handleDeclineRequest = async (convo) => {
    try {
      await chatAPI.declineRequest(convo.id);
      toast.success("Request declined");
      setMessageRequests((prev) => prev.filter((r) => r.id !== convo.id));
      setRequestCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to decline");
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (activeTab !== "all") return; // other tabs filter client-side
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await userSearchAPI.search(q);
      setSearchResults(res.data || []);
    } catch {
    } finally {
      setSearching(false);
    }
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
    } catch {
    } finally {
      setTabLoading(false);
    }
  }, [user?.id]);

  const handleSyncContactsInModal = async () => {
    setContactSyncing(true);
    try {
      const supportsContactPicker =
        "contacts" in navigator && "ContactsManager" in window;
      if (!supportsContactPicker) {
        toast.info(
          "Contact Picker not supported on this browser. Visit the Contacts page for manual search.",
        );
        setContactSyncing(false);
        return;
      }
      const contacts = await navigator.contacts.select(["tel", "email"], {
        multiple: true,
      });
      const phones = contacts.flatMap((c) => c.tel || []);
      const emails = contacts.flatMap((c) => c.email || []);
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
        return q.length >= 1
          ? tabFollowers.filter((u) => u.name?.toLowerCase().includes(q))
          : tabFollowers;
      case "following":
        return q.length >= 1
          ? tabFollowing.filter((u) => u.name?.toLowerCase().includes(q))
          : tabFollowing;
      case "contacts":
        return q.length >= 1
          ? syncedContacts.filter((u) => u.name?.toLowerCase().includes(q))
          : syncedContacts;
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

  const linkifyText = (text) => {
    if (!text) return "";
    const urlPattern =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
    return text.split(urlPattern).map((part, i) => {
      if (part && part.match(urlPattern)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

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
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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

  // Scroll FAB handler
  const handleMsgScroll = useCallback((e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setNewMsgWhileAway(0);
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <Loader2
          className="h-10 w-10 animate-spin text-brand-600 mb-4"
          aria-label="Loading conversations"
        />
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Synchronizing Network
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex w-full h-full min-h-0 overflow-hidden bg-background md:bg-card/40 md:backdrop-blur-md md:rounded-[20px] lg:rounded-[28px] md:border border-border/30 pb-16 lg:pb-0">
      {/* Sidebar: Conversation List */}
      <div
        className={`w-full lg:w-[340px] xl:w-[380px] lg:border-r border-border/30 flex-shrink-0 flex flex-col bg-transparent relative z-20 min-h-0 overflow-hidden
          ${activeConvo ? "hidden lg:flex" : "flex"}
        `}
      >
        <ConversationList
          conversations={conversations}
          filteredConvos={filteredConvos}
          convoSearch={convoSearch}
          onConvoSearchChange={setConvoSearch}
          onOpenNewChat={openNewChatModal}
          onOpenConversation={(convo) => {
            setActiveConvo(convo);
            loadMessages(convo.id);
          }}
          activeConvoId={activeConvo?.id}
          requestCount={requestCount}
          onOpenRequests={() => {
            setShowRequests(true);
            loadRequests();
          }}
          user={user}
          timeAgo={timeAgo}
        />
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden
          ${!activeConvo ? "hidden lg:flex" : "flex"}
        `}
      >
        {activeConvo ? (
          <ActiveChat
            activeConvo={activeConvo}
            onBack={() => {
              setActiveConvo(null);
              setOnlineStatus(null);
              setIsTyping(false);
              loadConversations();
            }}
            onlineStatus={onlineStatus}
            isTyping={isTyping}
            lastSeenText={lastSeenText}
            messages={messages}
            groupedMessages={groupedMessages}
            user={user}
            onSend={handleSend}
            msgText={msgText}
            onMsgTextChange={setMsgText}
            onTyping={handleTyping}
            sending={sending}
            loadingMessages={false}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onToggleMute={handleToggleMute}
            isMuted={isMuted}
            showClearConfirm={showClearConfirm}
            setShowClearConfirm={setShowClearConfirm}
            onClearChat={handleClearChat}
            onOpenPinned={loadPinnedMessages}
            onOpenMedia={loadMediaGallery}
            showMsgSearch={showMsgSearch}
            onToggleSearch={() => {
              setShowMsgSearch(!showMsgSearch);
              setMsgSearchQuery("");
              setMsgSearchResults([]);
            }}
            msgSearchQuery={msgSearchQuery}
            onMsgSearch={handleMsgSearch}
            msgSearchResults={msgSearchResults}
            onScrollToMessage={scrollToMessage}
            onLongPress={(msg) => setLongPressMsg(msg)}
            onReaction={handleReaction}
            onReply={(msg) => setReplyTo(msg)}
            onDelete={handleDeleteMessage}
            onPin={handlePinMessage}
            onForward={openForwardModal}
            onOpenSharedPost={openSharedPost}
            onOpenLightbox={(img) => setLightboxImage(img)}
            onTogglePlayAudio={togglePlayAudio}
            playingAudio={playingAudio}
            linkifyText={linkifyText}
            formatTime={formatTime}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            pendingFile={pendingFile}
            onCancelFile={() => setPendingFile(null)}
            onFileSelect={handleFileSelect}
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            showEmojiPicker={showEmojiPicker}
            onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
            emojiPickerRef={emojiPickerRef}
            onAddEmoji={(emojiData) => {
              setMsgText((prev) => prev + emojiData.emoji);
              setShowEmojiPicker(false);
            }}
            inputRef={inputRef}
            msgContainerRef={msgContainerRef}
            messagesEndRef={messagesEndRef}
            handleMsgScroll={handleMsgScroll}
            showScrollBtn={showScrollBtn}
            newMsgWhileAway={newMsgWhileAway}
            scrollToBottom={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              isAtBottomRef.current = true;
              setShowScrollBtn(false);
              setNewMsgWhileAway(0);
            }}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center bg-dot-pattern relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-600/4 rounded-full blur-[80px] pointer-events-none" />

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 max-w-xs"
            >
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-[32px] bg-brand-600/10 flex items-center justify-center mx-auto mb-6 -rotate-6 border border-brand-600/15 shadow-inner">
                <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 text-brand-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3 tracking-tight">
                Select a conversation
              </h2>
              <p className="text-[13px] text-muted-foreground/60 font-medium leading-relaxed mb-8 max-w-[220px] mx-auto">
                Choose a teammate to start chatting.
              </p>
              <Button
                onClick={openNewChatModal}
                className="h-11 px-8 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center font-black uppercase text-[11px] tracking-widest mx-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={closeNewChatModal}
        onStartConvo={handleStartConversation}
        user={user}
      />

      <MessageRequestsModal
        isOpen={showRequests}
        onClose={() => setShowRequests(false)}
        requests={messageRequests}
        loading={requestsLoading}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10"
            onClick={() => setLightboxImage(null)}
          >
            <button
              className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 z-[110]"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              src={lightboxImage}
              alt=""
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Post Detail Modal */}
      <AnimatePresence>
        {viewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
            onClick={() => {
              setViewPost(null);
              setViewPostComments([]);
              setShowComments(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card rounded-[32px] border border-border/40 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl elevation-24"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-5 pb-3 border-b border-border/50">
                <div
                  className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => {
                    setViewPost(null);
                    navigate(`/player-card/${viewPost.user_id}`);
                  }}
                >
                  {viewPost.user_avatar ? (
                    <img
                      src={mediaUrl(viewPost.user_avatar)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    className="font-black text-[15px] hover:text-brand-600 text-left tracking-tight"
                    onClick={() => {
                      setViewPost(null);
                      navigate(`/player-card/${viewPost.user_id}`);
                    }}
                  >
                    {viewPost.user_name}
                  </button>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                    {new Date(viewPost.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setViewPost(null)}
                  className="p-2.5 rounded-2xl hover:bg-secondary/50 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {viewPost.content && (
                  <p className="p-5 pt-4 text-[15px] font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {viewPost.content}
                  </p>
                )}
                {viewPost.media_url && (
                  <div className="px-5 pb-5">
                    <img
                      src={mediaUrl(viewPost.media_url)}
                      alt=""
                      className="w-full rounded-[24px] shadow-lg border border-border/20"
                    />
                  </div>
                )}
                {/* Comments section */}
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
                      Comments ({viewPost.comments_count || 0})
                    </span>
                  </div>
                  {viewPostComments.length > 0 ? (
                    <div className="space-y-4">
                      {viewPostComments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-xl bg-secondary flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold">{c.user_name}</p>
                            <p className="text-[13px] opacity-70">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-[13px] text-muted-foreground font-medium opacity-50 italic">
                      No comments yet
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
