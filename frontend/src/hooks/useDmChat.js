import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { chatAPI, groupAPI, socialAPI } from "@/lib/api";
import { toast } from "sonner";

/**
 * useDmChat — extracts ALL DM-specific chat state and handlers from ChatPage.
 *
 * @param {object|null} activeConvo   – the currently-selected DM conversation
 * @param {object}      user          – authenticated user from AuthContext
 * @param {object}      ws            – { connected, sendTyping, on, off } from useChatWebSocket
 * @param {Array}       allConversations – full conversation list (used for forwarding)
 * @param {Function}    refreshConversations – reload the sidebar conversation list
 */
export function useDmChat(activeConvo, user, ws, allConversations, refreshConversations, updateActiveItem) {
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);

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

  // Clear chat
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ─── Refs ───────────────────────────────────────────────────────────────────

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

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    try {
      const res = await chatAPI.getMessages(convoId);
      const msgs = res.data || [];
      // Enrich reply_preview/reply_sender from referenced messages
      const byId = {};
      for (const m of msgs) byId[m.id] = m;
      for (const m of msgs) {
        if (m.reply_to && !m.reply_preview && byId[m.reply_to]) {
          const ref = byId[m.reply_to];
          m.reply_preview = (ref.content || "").slice(0, 80) || (ref.media_url ? "Media" : "\u2026");
          m.reply_sender = ref.sender_name || "Unknown";
          if (ref.media_url) {
            m.reply_media_url = ref.media_url;
            m.reply_media_type = ref.media_type;
          }
        }
      }
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────────

  // 1. Load messages + reset state when activeConvo changes
  useEffect(() => {
    if (activeConvo?.id) {
      loadMessages(activeConvo.id);
    } else {
      setMessages([]);
    }
    // Clear stale state from previous conversation
    setOnlineStatus(null);
    setIsTyping(false);
    setReplyTo(null);
    setLongPressMsg(null);
    setPendingFile(null);
    setMsgText("");
    setShowEmojiPicker(false);
    setShowMsgSearch(false);
    setMsgSearchQuery("");
    setMsgSearchResults([]);
    setShowScrollBtn(false);
    setNewMsgWhileAway(0);
    setPlayingAudio(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    prevMsgLengthRef.current = 0;
    isAtBottomRef.current = true;
  }, [activeConvo?.id, loadMessages]);

  // 2. WebSocket event handlers (use specific handler refs for cleanup)
  useEffect(() => {
    if (!activeConvo) return;
    const { on: wsOn, off: wsOff } = ws;

    const handleNewMsg = (data) => {
      if (data.conversation_id === activeConvo.id) {
        setMessages((prev) => {
          // Skip if we already have this exact message
          if (prev.some((m) => m.id === data.message.id)) return prev;
          // Replace matching temp message (same sender + similar timestamp) if exists
          const isMine = data.message.sender_id === user?.id;
          if (isMine) {
            const tempIdx = prev.findIndex(
              (m) => typeof m.id === "string" && m.id.startsWith("temp-") && m.sender_id === user?.id
            );
            if (tempIdx !== -1) {
              const temp = prev[tempIdx];
              const next = [...prev];
              // Preserve reply data from temp message if WS payload doesn't include it
              next[tempIdx] = {
                ...data.message,
                reply_preview: data.message.reply_preview || temp.reply_preview,
                reply_sender: data.message.reply_sender || temp.reply_sender,
              };
              return next;
            }
          }
          // Enrich reply data from existing messages if missing
          const incoming = data.message;
          if (incoming.reply_to && !incoming.reply_preview) {
            const ref = prev.find((m) => m.id === incoming.reply_to);
            if (ref) {
              return [...prev, {
                ...incoming,
                reply_preview: (ref.content || "").slice(0, 80) || (ref.media_url ? "Media" : "\u2026"),
                reply_sender: ref.sender_name || "Unknown",
                reply_media_url: ref.media_url || undefined,
                reply_media_type: ref.media_type || undefined,
              }];
            }
          }
          return [...prev, incoming];
        });
      }
      refreshConversations();
    };
    const handleTypingWs = (data) => {
      if (data.conversation_id === activeConvo.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    };
    const handleOnline = (data) => {
      if (activeConvo?.other_user?.id === data.user_id) {
        setOnlineStatus((prev) => ({ ...prev, online: data.online }));
      }
    };
    const handleDeleted = (data) => {
      if (data.conversation_id === activeConvo.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id ? { ...m, content: "", deleted: true } : m,
          ),
        );
      }
    };
    const handleRead = (data) => {
      if (data.conversation_id === activeConvo.id) {
        setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      }
    };
    const handleReactionWs = (data) => {
      if (data.conversation_id === activeConvo.id) {
        loadMessages(activeConvo.id);
      }
    };
    const handleRequestAccepted = (data) => {
      if (data.conversation_id === activeConvo.id && updateActiveItem) {
        updateActiveItem({ status: "active" });
      }
      toast.success(`${data.accepted_by} accepted your message request`);
      refreshConversations();
    };

    wsOn("new_message", handleNewMsg);
    wsOn("typing", handleTypingWs);
    wsOn("online_status", handleOnline);
    wsOn("message_deleted", handleDeleted);
    wsOn("messages_read", handleRead);
    wsOn("message_reaction", handleReactionWs);
    wsOn("request_accepted", handleRequestAccepted);

    return () => {
      wsOff("new_message", handleNewMsg);
      wsOff("typing", handleTypingWs);
      wsOff("online_status", handleOnline);
      wsOff("message_deleted", handleDeleted);
      wsOff("messages_read", handleRead);
      wsOff("message_reaction", handleReactionWs);
      wsOff("request_accepted", handleRequestAccepted);
    };
  }, [activeConvo, ws, refreshConversations, loadMessages]);

  // 3. Polling fallbacks (when WS disconnected)

  // Poll messages when WS down
  useEffect(() => {
    if (!activeConvo || ws.connected) return;
    const interval = setInterval(() => loadMessages(activeConvo.id), 3000);
    return () => clearInterval(interval);
  }, [activeConvo, loadMessages, ws.connected]);

  // Check online status fallback
  useEffect(() => {
    if (!activeConvo?.other_user?.id) {
      setOnlineStatus(null);
      return;
    }
    if (ws.connected) return;
    const check = () =>
      chatAPI
        .onlineStatus(activeConvo.other_user.id)
        .then((res) => setOnlineStatus(res.data))
        .catch(() => {});
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [activeConvo, ws.connected]);

  // Check typing fallback
  useEffect(() => {
    if (!activeConvo?.id || ws.connected) return;
    const check = () =>
      chatAPI
        .getTyping(activeConvo.id)
        .then((res) => setIsTyping(res.data?.typing || false))
        .catch(() => {});
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [activeConvo, ws.connected]);

  // 4. Scroll management

  // Scroll to bottom when messages first load for a conversation
  const hasScrolledRef = useRef(null);
  useEffect(() => {
    // Reset scroll tracker when conversation changes
    hasScrolledRef.current = null;
  }, [activeConvo?.id]);

  useEffect(() => {
    if (!activeConvo?.id || messages.length === 0) return;
    // Only auto-scroll on initial load (not on every new message)
    if (hasScrolledRef.current === activeConvo.id) return;
    hasScrolledRef.current = activeConvo.id;
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      isAtBottomRef.current = true;
      setShowScrollBtn(false);
      setNewMsgWhileAway(0);
      prevMsgLengthRef.current = messages.length;
    }, 50);
    return () => clearTimeout(t);
  }, [activeConvo?.id, messages.length]);

  // Auto-scroll on new messages
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

  // Scroll on typing
  useEffect(() => {
    if (isTyping && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isTyping]);

  // 5. Outside click handlers

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

  // ─── Handler Functions ──────────────────────────────────────────────────────

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
    let mediaUrlStr = "",
      mediaType = "",
      fileName = "";
    if (file) {
      setUploading(true);
      try {
        const uploadRes = await chatAPI.uploadFile(file);
        mediaUrlStr = uploadRes.data.url;
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
      media_url: mediaUrlStr,
      media_type: mediaType,
      file_name: fileName,
      reply_to: reply?.id,
      reply_preview: reply?.content?.slice(0, 80) || (reply?.media_url ? "Media" : undefined),
      reply_sender: reply?.sender_name,
      reply_media_url: reply?.media_url || undefined,
      reply_media_type: reply?.media_type || undefined,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const payload = { content: text };
      if (reply?.id) payload.reply_to = reply.id;
      if (mediaUrlStr) {
        payload.media_url = mediaUrlStr;
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
                reply_media_url: tempMsg.reply_media_url,
                reply_media_type: tempMsg.reply_media_type,
              }
            : m,
        ),
      );
      refreshConversations();
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
    if (ws.connected) {
      ws.sendTyping(activeConvo.id);
    } else {
      chatAPI.setTyping(activeConvo.id).catch(() => {});
    }
    // Debounce: don't send another typing signal for 3s
    typingTimeout.current = setTimeout(() => {
      typingTimeout.current = null;
    }, 3000);
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
        refreshConversations();
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

  // Unified toggle: pin if not pinned, unpin if pinned
  const handleTogglePin = async (msg) => {
    if (msg.pinned) {
      await handleUnpinMessage(msg);
    } else {
      await handlePinMessage(msg);
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

  // ─── Polls ──────────────────────────────────────────────────────────────────

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
      refreshConversations();
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

  // ─── Media Gallery ──────────────────────────────────────────────────────────

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

  // ─── Mute ───────────────────────────────────────────────────────────────────

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

  // ─── Forward ────────────────────────────────────────────────────────────────

  const openForwardModal = (msg) => {
    setForwardMsg(msg);
    setLongPressMsg(null);
    // Load conversations list for forwarding
    setForwardConvos(allConversations.filter((c) => c.id !== activeConvo?.id));
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

  // ─── Shared Post ────────────────────────────────────────────────────────────

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

  // ─── Scroll FAB ─────────────────────────────────────────────────────────────

  const handleMsgScroll = useCallback((e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setNewMsgWhileAway(0);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isAtBottomRef.current = true;
    setShowScrollBtn(false);
    setNewMsgWhileAway(0);
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

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

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

  // ─── Return ─────────────────────────────────────────────────────────────────

  return {
    messages,
    groupedMessages,
    msgText,
    setMsgText,
    sending,
    uploading,
    onlineStatus,
    isTyping,
    lastSeenText,
    replyTo,
    setReplyTo,
    longPressMsg,
    setLongPressMsg,
    pendingFile,
    setPendingFile,
    hoverReaction,
    setHoverReaction,
    showMsgSearch,
    setShowMsgSearch: (v) => {
      setShowMsgSearch(v);
      if (!v) {
        setMsgSearchQuery("");
        setMsgSearchResults([]);
      }
    },
    msgSearchQuery,
    msgSearchResults,
    showPinned,
    setShowPinned,
    pinnedMessages,
    showPollCreate,
    setShowPollCreate,
    pollQuestion,
    setPollQuestion,
    pollOptions,
    setPollOptions,
    showMediaGallery,
    setShowMediaGallery,
    mediaItems,
    isMuted,
    showForwardModal,
    setShowForwardModal,
    forwardMsg,
    forwardConvos,
    showClearConfirm,
    setShowClearConfirm,
    showScrollBtn,
    newMsgWhileAway,
    lightboxImage,
    setLightboxImage,
    showEmojiPicker,
    setShowEmojiPicker,
    viewPost,
    setViewPost,
    viewPostComments,
    showComments,
    setShowComments,
    reactionPickerOpen,
    setReactionPickerOpen,
    // Refs
    reactionPickerRef,
    messagesEndRef,
    inputRef,
    mediaRecorderRef,
    audioRef,
    fileInputRef,
    msgContainerRef,
    emojiPickerRef,
    // Handlers
    handleSend,
    handleTyping,
    handleDeleteMessage,
    handleReaction,
    handleFileSelect,
    startRecording,
    stopRecording,
    cancelRecording,
    togglePlayAudio,
    handleMsgSearch,
    scrollToMessage,
    handlePinMessage,
    handleUnpinMessage,
    handleTogglePin,
    loadPinnedMessages,
    handleCreatePoll,
    handleVotePoll,
    loadMediaGallery,
    handleToggleMute,
    openForwardModal,
    handleForwardToConvo,
    handleClearChat,
    openSharedPost,
    handleMsgScroll,
    scrollToBottom,
    linkifyText,
    formatTime,
    isRecording,
    recordingDuration,
  };
}
