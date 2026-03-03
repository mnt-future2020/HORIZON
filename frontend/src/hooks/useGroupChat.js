import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { groupAPI, chatAPI } from "@/lib/api";
import { toast } from "sonner";

/**
 * useGroupChat — extracts ALL group chat state and handlers from GroupDetailPage.
 *
 * @param {Object} params
 * @param {string|null} params.groupId       — active group ID (null when none)
 * @param {Object}      params.user          — current user from AuthContext
 * @param {Function}    params.wsOn          — subscribe to WS event (multi-handler)
 * @param {Function}    params.wsOff         — unsubscribe specific handler
 * @param {boolean}     params.wsConnected   — WebSocket connection status
 * @param {Function}    params.sendGroupTyping — send group typing via WS
 * @param {Function}    params.refreshConversations — refresh unified conversation list
 */
export default function useGroupChat({
  groupId,
  user,
  wsOn,
  wsOff,
  wsConnected,
  sendGroupTyping,
  refreshConversations,
}) {
  const navigate = useNavigate();

  // ── Refs ──
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // ── Core state ──
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState("chat");
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Edit mode
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reactions
  const [reactionMsgId, setReactionMsgId] = useState(null);

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState([]);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Pinned messages
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMsgs, setPinnedMsgs] = useState([]);

  // Polls
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Mute
  const [isMuted, setIsMuted] = useState(false);

  // Invite link
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // Join requests
  const [joinRequests, setJoinRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Online members
  const [onlineMembers, setOnlineMembers] = useState([]);

  // Context menu
  const [contextMsg, setContextMsg] = useState(null);

  // Forward
  const [showForward, setShowForward] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);

  // Media gallery
  const [showGallery, setShowGallery] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState([]);

  // Member roles
  const [roleEditMember, setRoleEditMember] = useState(null);
  const [roleInput, setRoleInput] = useState("");

  // @Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionMap, setMentionMap] = useState({});

  // Clear chat confirm
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════

  const formatTime = useCallback(
    (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    []
  );

  const formatDate = useCallback((d) => {
    const dt = new Date(d);
    const today = new Date();
    if (dt.toDateString() === today.toDateString()) return "Today";
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    if (dt.toDateString() === y.toDateString()) return "Yesterday";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, []);

  // ── Render @mentions as styled tags ──
  const renderContent = useCallback(
    (text) => {
      if (!text) return null;
      const parts = text.split(/(@\[([^\]]+)\]\(([^)]+)\))/g);
      if (parts.length === 1) return text;
      const result = [];
      let i = 0;
      while (i < parts.length) {
        if (i + 3 < parts.length && parts[i + 1] && parts[i + 1].startsWith("@[")) {
          result.push(<span key={i}>{parts[i]}</span>);
          const name = parts[i + 2];
          const uid = parts[i + 3];
          result.push(
            <span
              key={`m-${i}`}
              className="font-bold text-brand-300 cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/player-card/${uid}`);
              }}
            >
              @{name}
            </span>
          );
          i += 4;
        } else {
          if (parts[i]) result.push(<span key={i}>{parts[i]}</span>);
          i++;
        }
      }
      return result;
    },
    [navigate]
  );

  // ════════════════════════════════════════════════════════════════
  // Data loading
  // ════════════════════════════════════════════════════════════════

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await groupAPI.get(groupId);
      setGroup(res.data);
    } catch {
      toast.error("Group not found");
      setGroup(null);
    }
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await groupAPI.getMessages(groupId);
      setMessages(res.data || []);
    } catch {
      // silently fail
    }
  }, [groupId]);

  // ── Effect 1: When groupId changes ──
  useEffect(() => {
    if (!groupId) {
      // Reset all state when no group is active
      setGroup(null);
      setMessages([]);
      setLoading(false);
      setMsgText("");
      setSending(false);
      setTab("chat");
      setPendingFile(null);
      setUploading(false);
      setShowEdit(false);
      setEditForm({});
      setSavingEdit(false);
      setUploadingAvatar(false);
      setUploadingCover(false);
      setShowDeleteConfirm(false);
      setDeleting(false);
      setReactionMsgId(null);
      setTypingUsers([]);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearching(false);
      setShowPinned(false);
      setPinnedMsgs([]);
      setShowPollCreate(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setIsMuted(false);
      setShowInvite(false);
      setInviteCode("");
      setJoinRequests([]);
      setShowRequests(false);
      setRecording(false);
      setRecordingTime(0);
      setOnlineMembers([]);
      setContextMsg(null);
      setShowForward(false);
      setForwardMsg(null);
      setShowGallery(false);
      setGalleryMedia([]);
      setRoleEditMember(null);
      setRoleInput("");
      setMentionQuery(null);
      setMentionResults([]);
      setMentionIndex(0);
      setMentionMap({});
      setShowClearConfirm(false);
      return;
    }
    setLoading(true);
    Promise.all([loadGroup(), loadMessages()]).finally(() => setLoading(false));
  }, [groupId, loadGroup, loadMessages]);

  // ── Effect 2: WebSocket event handlers ──
  useEffect(() => {
    if (!groupId || !group?.is_member) return;

    const handleGroupMsg = (data) => {
      if (data.group_id === groupId) {
        setMessages((prev) => [...prev, data]);
        refreshConversations();
      }
    };

    const handleGroupReaction = (data) => {
      if (data.group_id === groupId) {
        loadMessages();
      }
    };

    const handleGroupMessageDeleted = (data) => {
      if (data.group_id === groupId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id
              ? { ...m, deleted: true, content: "", media_url: "" }
              : m
          )
        );
      }
    };

    const handleGroupTyping = (data) => {
      if (data.group_id === groupId) {
        setTypingUsers(data.typing || (data.user_name ? [data.user_name] : []));
        // Clear typing after 3s
        setTimeout(() => {
          setTypingUsers([]);
        }, 3000);
      }
    };

    const handleGroupPollUpdate = (data) => {
      if (data.group_id === groupId) {
        loadMessages();
      }
    };

    wsOn("group_message", handleGroupMsg);
    wsOn("group_reaction", handleGroupReaction);
    wsOn("group_message_deleted", handleGroupMessageDeleted);
    wsOn("group_typing", handleGroupTyping);
    wsOn("group_poll_update", handleGroupPollUpdate);

    return () => {
      wsOff("group_message", handleGroupMsg);
      wsOff("group_reaction", handleGroupReaction);
      wsOff("group_message_deleted", handleGroupMessageDeleted);
      wsOff("group_typing", handleGroupTyping);
      wsOff("group_poll_update", handleGroupPollUpdate);
    };
  }, [groupId, group?.is_member, wsOn, wsOff, loadMessages, refreshConversations]);

  // ── Effect 3: Polling fallback when WS is disconnected ──
  useEffect(() => {
    if (!groupId || !group?.is_member || wsConnected) return;
    const interval = setInterval(() => {
      loadMessages();
      groupAPI
        .getTyping(groupId)
        .then((res) => setTypingUsers(res.data?.typing || []))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [groupId, group?.is_member, wsConnected, loadMessages]);

  // ── Effect 4: Online members polling every 15s ──
  useEffect(() => {
    if (!groupId || !group?.is_member) return;
    const load = () =>
      groupAPI
        .getOnline(groupId)
        .then((res) => setOnlineMembers(res.data?.online || []))
        .catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [groupId, group?.is_member]);

  // ── Effect 5: Mark read when messages change ──
  useEffect(() => {
    if (group?.is_member && messages.length > 0 && groupId) {
      groupAPI.markRead(groupId).catch(() => {});
    }
  }, [messages.length, group?.is_member, groupId]);

  // ── Effect 6: Check mute status on load ──
  useEffect(() => {
    if (group?.is_member && groupId) {
      groupAPI
        .getMute(groupId)
        .then((res) => setIsMuted(res.data?.muted || false))
        .catch(() => {});
    }
  }, [group?.is_member, groupId]);

  // ── Effect 7: Auto scroll on messages change ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ════════════════════════════════════════════════════════════════
  // Handlers
  // ════════════════════════════════════════════════════════════════

  // ── Typing indicator ──
  const handleTyping = useCallback(() => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (wsConnected) {
      sendGroupTyping(groupId);
    } else {
      groupAPI.setTyping(groupId).catch(() => {});
    }
    typingTimeout.current = setTimeout(() => {}, 3000);
  }, [groupId, wsConnected, sendGroupTyping]);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    if ((!msgText.trim() && !pendingFile) || sending) return;
    setSending(true);
    try {
      let mediaUrlVal = "";
      let mediaType = "";
      if (pendingFile) {
        setUploading(true);
        const upRes = await chatAPI.uploadFile(pendingFile);
        mediaUrlVal = upRes.data.url;
        mediaType = upRes.data.file_type;
        setUploading(false);
      }
      let content = msgText.trim();
      Object.entries(mentionMap).forEach(([displayName, { id, name }]) => {
        content = content.replace(
          new RegExp(
            `@${displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "g"
          ),
          `@[${name}](${id})`
        );
      });
      const res = await groupAPI.sendMessage(groupId, {
        content,
        media_url: mediaUrlVal,
        media_type: mediaType,
      });
      setMessages((prev) => [...prev, res.data]);
      setMsgText("");
      setMentionMap({});
      setPendingFile(null);
      refreshConversations();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [msgText, pendingFile, sending, mentionMap, groupId, refreshConversations]);

  // ── @Mention autocomplete ──
  const handleMsgChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMsgText(val);
      handleTyping();
      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);
      const atMatch = textBefore.match(/@(\w*)$/);
      if (atMatch) {
        const query = atMatch[1].toLowerCase();
        setMentionQuery(query);
        const members = (group?.member_details || []).filter(
          (m) => m.id !== user?.id && m.name?.toLowerCase().includes(query)
        );
        setMentionResults(members.slice(0, 6));
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
        setMentionResults([]);
      }
    },
    [handleTyping, group?.member_details, user?.id]
  );

  const selectMention = useCallback(
    (member) => {
      const cursorPos = inputRef.current?.selectionStart || msgText.length;
      const textBefore = msgText.slice(0, cursorPos);
      const textAfter = msgText.slice(cursorPos);
      const displayName = member.name.replace(/\s+/g, "_");
      const newBefore = textBefore.replace(/@(\w*)$/, `@${displayName} `);
      setMsgText(newBefore + textAfter);
      setMentionMap((prev) => ({
        ...prev,
        [displayName]: { id: member.id, name: member.name },
      }));
      setMentionQuery(null);
      setMentionResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [msgText]
  );

  const handleMentionKeyDown = useCallback(
    (e) => {
      if (mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionResults.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex(
            (i) => (i - 1 + mentionResults.length) % mentionResults.length
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectMention(mentionResults[mentionIndex]);
          return;
        }
        if (e.key === "Escape") {
          setMentionQuery(null);
          setMentionResults([]);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        handleSend();
      }
    },
    [mentionResults, mentionIndex, selectMention, handleSend]
  );

  // ── File select ──
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only images supported");
      return;
    }
    setPendingFile(file);
    e.target.value = "";
  }, []);

  // ── Voice recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        setSending(true);
        try {
          const upRes = await chatAPI.uploadFile(file);
          await groupAPI.sendMessage(groupId, {
            content: "",
            media_url: upRes.data.url,
            media_type: "voice",
            duration: recordingTime,
          });
          loadMessages();
        } catch {
          toast.error("Failed to send voice");
        } finally {
          setSending(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000
      );
    } catch {
      toast.error("Microphone access denied");
    }
  }, [groupId, recordingTime, loadMessages]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(recordTimerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(recordTimerRef.current);
  }, []);

  // ── Reactions ──
  const handleReact = useCallback(
    async (msgId, emoji) => {
      setReactionMsgId(null);
      try {
        await groupAPI.reactMessage(groupId, msgId, emoji);
        loadMessages();
      } catch {
        toast.error("Failed to react");
      }
    },
    [groupId, loadMessages]
  );

  // ── Delete message ──
  const handleDeleteMsg = useCallback(
    async (msgId) => {
      setContextMsg(null);
      try {
        await groupAPI.deleteMessage(groupId, msgId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, deleted: true, content: "", media_url: "" }
              : m
          )
        );
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to delete");
      }
    },
    [groupId]
  );

  // ── Pin message ──
  const handlePin = useCallback(
    async (msgId, currentlyPinned) => {
      setContextMsg(null);
      try {
        if (currentlyPinned) {
          await groupAPI.unpinMessage(groupId, msgId);
          toast.success("Unpinned");
        } else {
          await groupAPI.pinMessage(groupId, msgId);
          toast.success("Pinned");
        }
        loadMessages();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed");
      }
    },
    [groupId, loadMessages]
  );

  // ── Search ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await groupAPI.searchMessages(groupId, searchQuery);
      setSearchResults(res.data?.results || []);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }, [groupId, searchQuery]);

  // ── Polls ──
  const handleCreatePoll = useCallback(async () => {
    const opts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) {
      toast.error("Need question + 2 options");
      return;
    }
    try {
      await groupAPI.createPoll(groupId, {
        question: pollQuestion,
        options: opts,
      });
      setShowPollCreate(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      loadMessages();
    } catch {
      toast.error("Failed to create poll");
    }
  }, [groupId, pollQuestion, pollOptions, loadMessages]);

  const handleVote = useCallback(
    async (msgId, optIdx) => {
      try {
        const res = await groupAPI.votePoll(groupId, msgId, optIdx);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, poll: res.data.poll } : m
          )
        );
      } catch {
        toast.error("Vote failed");
      }
    },
    [groupId]
  );

  // ── Mute ──
  const handleToggleMute = useCallback(async () => {
    try {
      const res = await groupAPI.toggleMute(groupId);
      setIsMuted(res.data.muted);
      toast.success(res.data.muted ? "Group muted" : "Group unmuted");
    } catch {
      toast.error("Failed");
    }
  }, [groupId]);

  // ── Clear Chat ──
  const handleClearChat = useCallback(async () => {
    try {
      await groupAPI.clearChat(groupId);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success("Chat cleared for you");
    } catch {
      toast.error("Failed to clear chat");
    }
  }, [groupId]);

  // ── Invite link ──
  const handleGetInvite = useCallback(async () => {
    try {
      const res = await groupAPI.getInviteLink(groupId);
      setInviteCode(res.data.invite_code);
      setShowInvite(true);
    } catch {
      toast.error("Failed to generate link");
    }
  }, [groupId]);

  const copyInviteLink = useCallback(() => {
    const link = `${window.location.origin}/communities/${groupId}?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied!");
  }, [groupId, inviteCode]);

  // ── Join requests ──
  const loadJoinRequests = useCallback(async () => {
    try {
      const res = await groupAPI.getJoinRequests(groupId);
      setJoinRequests(res.data || []);
      setShowRequests(true);
    } catch {
      toast.error("Failed to load requests");
    }
  }, [groupId]);

  const handleApproveRequest = useCallback(
    async (reqId) => {
      try {
        await groupAPI.approveJoinRequest(groupId, reqId);
        setJoinRequests((prev) => prev.filter((r) => r.id !== reqId));
        loadGroup();
        toast.success("Approved");
      } catch {
        toast.error("Failed");
      }
    },
    [groupId, loadGroup]
  );

  const handleRejectRequest = useCallback(
    async (reqId) => {
      try {
        await groupAPI.rejectJoinRequest(groupId, reqId);
        setJoinRequests((prev) => prev.filter((r) => r.id !== reqId));
      } catch {
        toast.error("Failed");
      }
    },
    [groupId]
  );

  // ── Pinned messages ──
  const loadPinned = useCallback(async () => {
    try {
      const res = await groupAPI.getPinned(groupId);
      setPinnedMsgs(res.data || []);
      setShowPinned(true);
    } catch {
      toast.error("Failed");
    }
  }, [groupId]);

  // ── Media gallery ──
  const loadGallery = useCallback(async () => {
    try {
      const res = await groupAPI.getMedia(groupId);
      setGalleryMedia(res.data?.media || []);
      setShowGallery(true);
    } catch {
      toast.error("Failed");
    }
  }, [groupId]);

  // ── Forward ──
  const handleForward = useCallback(
    async (targetGroupId) => {
      if (!forwardMsg) return;
      try {
        await groupAPI.forwardMessage({
          source_type: "group",
          source_id: groupId,
          message_id: forwardMsg.id,
          target_type: "group",
          target_id: targetGroupId,
        });
        toast.success("Forwarded!");
        setShowForward(false);
        setForwardMsg(null);
      } catch {
        toast.error("Forward failed");
      }
    },
    [groupId, forwardMsg]
  );

  // ── Member roles ──
  const handleSetRole = useCallback(
    async (memberId, role) => {
      try {
        await groupAPI.setMemberRole(groupId, memberId, role);
        setRoleEditMember(null);
        setRoleInput("");
        loadGroup();
        toast.success(role ? `Role set: ${role}` : "Role removed");
      } catch {
        toast.error("Failed");
      }
    },
    [groupId, loadGroup]
  );

  // ── Admin actions ──
  const handleJoin = useCallback(async () => {
    try {
      await groupAPI.join(groupId);
      toast.success("Joined!");
      loadGroup();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  }, [groupId, loadGroup]);

  const handleLeave = useCallback(async () => {
    try {
      await groupAPI.leave(groupId);
      toast.success("Left group");
      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  }, [groupId, navigate]);

  const handlePromote = useCallback(
    async (id) => {
      try {
        await groupAPI.promote(groupId, id);
        toast.success("Promoted");
        loadGroup();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed");
      }
    },
    [groupId, loadGroup]
  );

  const handleDemote = useCallback(
    async (id) => {
      try {
        await groupAPI.demote(groupId, id);
        toast.success("Demoted");
        loadGroup();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed");
      }
    },
    [groupId, loadGroup]
  );

  const handleRemoveMember = useCallback(
    async (id) => {
      try {
        await groupAPI.removeMember(groupId, id);
        toast.success("Removed");
        loadGroup();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed");
      }
    },
    [groupId, loadGroup]
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await groupAPI.remove(groupId);
      toast.success("Deleted");
      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setDeleting(false);
    }
  }, [groupId, navigate]);

  // ── Edit group ──
  const openEdit = useCallback(() => {
    setEditForm({
      name: group.name || "",
      description: group.description || "",
      sport: group.sport || "",
      is_private: group.is_private || false,
      max_members: group.max_members || 500,
      avatar_url: group.avatar_url || "",
      cover_url: group.cover_url || "",
    });
    setShowEdit(true);
  }, [group]);

  const handleAvatarUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await chatAPI.uploadFile(file);
      setEditForm((p) => ({ ...p, avatar_url: res.data.url }));
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }, []);

  const handleCoverUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await chatAPI.uploadFile(file);
      setEditForm((p) => ({ ...p, cover_url: res.data.url }));
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editForm.name?.trim()) {
      toast.error("Name required");
      return;
    }
    setSavingEdit(true);
    try {
      await groupAPI.update(groupId, editForm);
      toast.success("Updated");
      setShowEdit(false);
      loadGroup();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSavingEdit(false);
    }
  }, [groupId, editForm, loadGroup]);

  // ════════════════════════════════════════════════════════════════
  // Derived / Computed
  // ════════════════════════════════════════════════════════════════

  const groupedMessages = useMemo(
    () =>
      messages.reduce((acc, msg) => {
        const date = formatDate(msg.created_at);
        if (!acc.length || acc[acc.length - 1].date !== date)
          acc.push({ date, messages: [msg] });
        else acc[acc.length - 1].messages.push(msg);
        return acc;
      }, []),
    [messages, formatDate]
  );

  const isCreator = group?.created_by === user?.id;
  const isAdmin = group?.is_admin;
  const admins = group?.admins || [];
  const memberRoles = group?.member_roles || {};

  // ════════════════════════════════════════════════════════════════
  // Return
  // ════════════════════════════════════════════════════════════════

  return {
    // Core
    group,
    loading,
    messages,
    groupedMessages,
    // Message input
    msgText,
    handleMsgChange,
    handleMentionKeyDown,
    handleSend,
    sending,
    uploading,
    pendingFile,
    setPendingFile: () => setPendingFile(null),
    handleFileSelect,
    // Refs
    messagesEndRef,
    chatContainerRef,
    fileInputRef,
    avatarInputRef,
    coverInputRef,
    inputRef,
    // Tab
    tab,
    setTab,
    // Mention
    mentionResults,
    mentionIndex,
    selectMention,
    // Reactions
    reactionMsgId,
    setReactionMsgId,
    handleReact,
    // Message actions
    handleDeleteMsg,
    handlePin,
    // Context menu
    contextMsg,
    setContextMsg,
    // Typing
    typingUsers,
    // Search
    showSearch,
    setShowSearch,
    searchQuery,
    setSearchQuery,
    handleSearch,
    searching,
    searchResults,
    // Pinned
    showPinned,
    setShowPinned: (v) => setShowPinned(v),
    pinnedMsgs,
    loadPinned,
    // Polls
    showPollCreate,
    setShowPollCreate,
    pollQuestion,
    setPollQuestion,
    pollOptions,
    setPollOptions,
    handleCreatePoll,
    handleVote,
    // Mute
    isMuted,
    handleToggleMute,
    // Invite
    showInvite,
    setShowInvite,
    inviteCode,
    handleGetInvite,
    copyInviteLink,
    // Join requests
    showRequests,
    setShowRequests,
    joinRequests,
    loadJoinRequests,
    handleApproveRequest,
    handleRejectRequest,
    // Voice
    recording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    // Online
    onlineMembers,
    // Forward
    showForward,
    setShowForward,
    forwardMsg,
    setForwardMsg,
    handleForward,
    // Gallery
    showGallery,
    setShowGallery,
    galleryMedia,
    loadGallery,
    // Edit
    showEdit,
    setShowEdit,
    editForm,
    setEditForm,
    openEdit,
    handleAvatarUpload,
    handleCoverUpload,
    handleSaveEdit,
    savingEdit,
    uploadingAvatar,
    uploadingCover,
    // Member management
    roleEditMember,
    setRoleEditMember,
    roleInput,
    setRoleInput,
    handleSetRole,
    handleJoin,
    handleLeave,
    handlePromote,
    handleDemote,
    handleRemoveMember,
    // Delete
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDelete,
    deleting,
    // Clear chat
    showClearConfirm,
    setShowClearConfirm,
    handleClearChat,
    // Derived
    isCreator,
    isAdmin,
    admins,
    memberRoles,
    // Helpers
    formatTime,
    renderContent,
  };
}
