import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { groupAPI, chatAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Send, Loader2, Crown, Trash2,
  User, Lock, Globe, LogOut, Plus, Image, MessageCircle,
  Settings, ShieldCheck, ShieldOff, UserMinus, Camera, X, Check,
  Pin, Search, Smile, Mic, MicOff, Copy, Link2, BarChart3,
  Forward, Volume2, VolumeX, ChevronDown, MoreVertical, Share2,
  BellOff, Bell, Eye, ImageIcon, Eraser
} from "lucide-react";
import { toast } from "sonner";

const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table-tennis", "swimming"];
const REACTIONS = [
  { emoji: "thumbsup", display: "👍" },
  { emoji: "heart", display: "❤️" },
  { emoji: "laugh", display: "😂" },
  { emoji: "wow", display: "😮" },
  { emoji: "fire", display: "🔥" },
  { emoji: "clap", display: "👏" },
];
const ROLE_PRESETS = ["Captain", "Vice Captain", "Coach", "Goalkeeper", "Striker", "Manager", "Organizer"];

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

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
  const typingTimeout = useRef(null);

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
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

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
  const [mentionMap, setMentionMap] = useState({}); // { "player2": "uuid" }
  const inputRef = useRef(null);

  // Render @mentions as styled tags
  const renderContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\[([^\]]+)\]\(([^)]+)\))/g);
    if (parts.length === 1) return text;
    const result = [];
    let i = 0;
    while (i < parts.length) {
      // Check if this is a full match (pattern produces 3 capture groups)
      if (i + 3 < parts.length && parts[i + 1] && parts[i + 1].startsWith("@[")) {
        result.push(<span key={i}>{parts[i]}</span>);
        const name = parts[i + 2];
        const uid = parts[i + 3];
        result.push(
          <span key={`m-${i}`} className="font-bold text-brand-300 cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); navigate(`/player-card/${uid}`); }}>
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
  };

  const loadGroup = useCallback(async () => {
    try {
      const res = await groupAPI.get(groupId);
      setGroup(res.data);
    } catch {
      toast.error("Group not found");
      navigate("/communities");
    }
  }, [groupId, navigate]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await groupAPI.getMessages(groupId);
      setMessages(res.data || []);
    } catch {}
  }, [groupId]);

  useEffect(() => {
    Promise.all([loadGroup(), loadMessages()]).finally(() => setLoading(false));
  }, [loadGroup, loadMessages]);

  // Poll for messages + typing every 3s
  useEffect(() => {
    if (!group?.is_member) return;
    const interval = setInterval(() => {
      loadMessages();
      groupAPI.getTyping(groupId).then(res => setTypingUsers(res.data?.typing || [])).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [group?.is_member, loadMessages, groupId]);

  // Mark as read when messages load
  useEffect(() => {
    if (group?.is_member && messages.length > 0) {
      groupAPI.markRead(groupId).catch(() => {});
    }
  }, [messages.length, group?.is_member, groupId]);

  // Load mute status
  useEffect(() => {
    if (group?.is_member) {
      groupAPI.getMute(groupId).then(res => setIsMuted(res.data?.muted || false)).catch(() => {});
    }
  }, [group?.is_member, groupId]);

  // Load online members periodically
  useEffect(() => {
    if (!group?.is_member) return;
    const load = () => groupAPI.getOnline(groupId).then(res => setOnlineMembers(res.data?.online || [])).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [group?.is_member, groupId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──
  const handleSend = async () => {
    if ((!msgText.trim() && !pendingFile) || sending) return;
    setSending(true);
    try {
      let mediaUrlVal = "", mediaType = "";
      if (pendingFile) {
        setUploading(true);
        const upRes = await chatAPI.uploadFile(pendingFile);
        mediaUrlVal = upRes.data.url;
        mediaType = upRes.data.file_type;
        setUploading(false);
      }
      // Convert @displayName to @[name](id) format before sending
      let content = msgText.trim();
      Object.entries(mentionMap).forEach(([displayName, { id, name }]) => {
        content = content.replace(new RegExp(`@${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), `@[${name}](${id})`);
      });
      const res = await groupAPI.sendMessage(groupId, {
        content, media_url: mediaUrlVal, media_type: mediaType,
      });
      setMessages(prev => [...prev, res.data]);
      setMsgText("");
      setMentionMap({});
      setPendingFile(null);
    } catch { toast.error("Failed to send message"); }
    finally { setSending(false); setUploading(false); }
  };

  // ── Typing indicator ──
  const handleTyping = () => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    groupAPI.setTyping(groupId).catch(() => {});
    typingTimeout.current = setTimeout(() => {}, 3000);
  };

  // ── @Mention autocomplete ──
  const handleMsgChange = (e) => {
    const val = e.target.value;
    setMsgText(val);
    handleTyping();

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      setMentionQuery(query);
      const members = (group?.member_details || []).filter(m =>
        m.id !== user?.id && m.name?.toLowerCase().includes(query)
      );
      setMentionResults(members.slice(0, 6));
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  const selectMention = (member) => {
    const cursorPos = inputRef.current?.selectionStart || msgText.length;
    const textBefore = msgText.slice(0, cursorPos);
    const textAfter = msgText.slice(cursorPos);
    // Show clean @name in input, store mapping for send time
    const displayName = member.name.replace(/\s+/g, "_");
    const newBefore = textBefore.replace(/@(\w*)$/, `@${displayName} `);
    setMsgText(newBefore + textAfter);
    setMentionMap(prev => ({ ...prev, [displayName]: { id: member.id, name: member.name } }));
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleMentionKeyDown = (e) => {
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionResults.length) % mentionResults.length);
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
  };

  // ── File select ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Only images supported"); return; }
    setPendingFile(file);
    e.target.value = "";
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        setSending(true);
        try {
          const upRes = await chatAPI.uploadFile(file);
          await groupAPI.sendMessage(groupId, { content: "", media_url: upRes.data.url, media_type: "voice", duration: recordingTime });
          loadMessages();
        } catch { toast.error("Failed to send voice"); }
        finally { setSending(false); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(recordTimerRef.current);
  };

  // ── Reactions ──
  const handleReact = async (msgId, emoji) => {
    setReactionMsgId(null);
    try {
      await groupAPI.reactMessage(groupId, msgId, emoji);
      loadMessages();
    } catch { toast.error("Failed to react"); }
  };

  // ── Delete message ──
  const handleDeleteMsg = async (msgId) => {
    setContextMsg(null);
    try {
      await groupAPI.deleteMessage(groupId, msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, content: "", media_url: "" } : m));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  // ── Pin message ──
  const handlePin = async (msgId, currentlyPinned) => {
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
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // ── Search ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await groupAPI.searchMessages(groupId, searchQuery);
      setSearchResults(res.data?.results || []);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  // ── Polls ──
  const handleCreatePoll = async () => {
    const opts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) { toast.error("Need question + 2 options"); return; }
    try {
      await groupAPI.createPoll(groupId, { question: pollQuestion, options: opts });
      setShowPollCreate(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      loadMessages();
    } catch { toast.error("Failed to create poll"); }
  };

  const handleVote = async (msgId, optIdx) => {
    try {
      const res = await groupAPI.votePoll(groupId, msgId, optIdx);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, poll: res.data.poll } : m));
    } catch { toast.error("Vote failed"); }
  };

  // ── Mute ──
  const handleToggleMute = async () => {
    try {
      const res = await groupAPI.toggleMute(groupId);
      setIsMuted(res.data.muted);
      toast.success(res.data.muted ? "Group muted" : "Group unmuted");
    } catch { toast.error("Failed"); }
  };

  // ── Clear Chat (per-user) ──
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearChat = async () => {
    try {
      await groupAPI.clearChat(groupId);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success("Chat cleared for you");
    } catch { toast.error("Failed to clear chat"); }
  };

  // ── Invite link ──
  const handleGetInvite = async () => {
    try {
      const res = await groupAPI.getInviteLink(groupId);
      setInviteCode(res.data.invite_code);
      setShowInvite(true);
    } catch { toast.error("Failed to generate link"); }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/communities/${groupId}?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied!");
  };

  // ── Join requests ──
  const loadJoinRequests = async () => {
    try {
      const res = await groupAPI.getJoinRequests(groupId);
      setJoinRequests(res.data || []);
      setShowRequests(true);
    } catch { toast.error("Failed to load requests"); }
  };

  const handleApproveRequest = async (reqId) => {
    try {
      await groupAPI.approveJoinRequest(groupId, reqId);
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
      loadGroup();
      toast.success("Approved");
    } catch { toast.error("Failed"); }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await groupAPI.rejectJoinRequest(groupId, reqId);
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    } catch { toast.error("Failed"); }
  };

  // ── Pinned messages ──
  const loadPinned = async () => {
    try {
      const res = await groupAPI.getPinned(groupId);
      setPinnedMsgs(res.data || []);
      setShowPinned(true);
    } catch { toast.error("Failed"); }
  };

  // ── Media gallery ──
  const loadGallery = async () => {
    try {
      const res = await groupAPI.getMedia(groupId);
      setGalleryMedia(res.data?.media || []);
      setShowGallery(true);
    } catch { toast.error("Failed"); }
  };

  // ── Forward ──
  const handleForward = async (targetGroupId) => {
    if (!forwardMsg) return;
    try {
      await groupAPI.forwardMessage({
        source_type: "group", source_id: groupId,
        message_id: forwardMsg.id, target_type: "group", target_id: targetGroupId,
      });
      toast.success("Forwarded!");
      setShowForward(false);
      setForwardMsg(null);
    } catch { toast.error("Forward failed"); }
  };

  // ── Member roles ──
  const handleSetRole = async (memberId, role) => {
    try {
      await groupAPI.setMemberRole(groupId, memberId, role);
      setRoleEditMember(null);
      setRoleInput("");
      loadGroup();
      toast.success(role ? `Role set: ${role}` : "Role removed");
    } catch { toast.error("Failed"); }
  };

  // ── Admin actions ──
  const handleJoin = async () => {
    try { await groupAPI.join(groupId); toast.success("Joined!"); loadGroup(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleLeave = async () => {
    try { await groupAPI.leave(groupId); toast.success("Left group"); navigate("/communities"); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handlePromote = async (id) => {
    try { await groupAPI.promote(groupId, id); toast.success("Promoted"); loadGroup(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleDemote = async (id) => {
    try { await groupAPI.demote(groupId, id); toast.success("Demoted"); loadGroup(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleRemoveMember = async (id) => {
    try { await groupAPI.removeMember(groupId, id); toast.success("Removed"); loadGroup(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try { await groupAPI.remove(groupId); toast.success("Deleted"); navigate("/communities"); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setDeleting(false); }
  };

  // ── Edit group ──
  const openEdit = () => {
    setEditForm({ name: group.name || "", description: group.description || "", sport: group.sport || "", is_private: group.is_private || false, max_members: group.max_members || 500, avatar_url: group.avatar_url || "", cover_url: group.cover_url || "" });
    setShowEdit(true);
  };
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingAvatar(true);
    try { const res = await chatAPI.uploadFile(file); setEditForm(p => ({ ...p, avatar_url: res.data.url })); }
    catch { toast.error("Upload failed"); } finally { setUploadingAvatar(false); e.target.value = ""; }
  };
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingCover(true);
    try { const res = await chatAPI.uploadFile(file); setEditForm(p => ({ ...p, cover_url: res.data.url })); }
    catch { toast.error("Upload failed"); } finally { setUploadingCover(false); e.target.value = ""; }
  };
  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) { toast.error("Name required"); return; }
    setSavingEdit(true);
    try { await groupAPI.update(groupId, editForm); toast.success("Updated"); setShowEdit(false); loadGroup(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); } finally { setSavingEdit(false); }
  };

  // ── Helpers ──
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d) => {
    const dt = new Date(d), today = new Date();
    if (dt.toDateString() === today.toDateString()) return "Today";
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (dt.toDateString() === y.toDateString()) return "Yesterday";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].date !== date) acc.push({ date, messages: [msg] });
    else acc[acc.length - 1].messages.push(msg);
    return acc;
  }, []);
  const isCreator = group?.created_by === user?.id;
  const isAdmin = group?.is_admin;
  const admins = group?.admins || [];
  const memberRoles = group?.member_roles || {};

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;
  if (!group) return null;

  // ── Render poll message ──
  const renderPoll = (msg) => {
    const poll = msg.poll;
    if (!poll) return null;
    const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
    return (
      <div className="mt-2 p-3 rounded-[28px] bg-background/80 border border-border/40 shadow-sm space-y-2">
        <div className="font-medium text-xs text-foreground">{poll.question}</div>
        {poll.options.map((opt, i) => {
          const votes = opt.votes?.length || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const voted = opt.votes?.includes(user?.id);
          return (
            <button key={i} onClick={() => handleVote(msg.id, i)}
              className={`w-full text-left p-2.5 rounded-xl text-xs transition-all ${voted ? "bg-brand-600/20 border border-brand-600/40" : "bg-secondary/30 hover:bg-secondary/50"}`}>
              <div className="flex justify-between mb-1">
                <span>{opt.text}</span>
                <span className="text-muted-foreground">{votes} ({pct}%)</span>
              </div>
              <div className="h-1 rounded-full bg-secondary/50 overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
        <div className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</div>
      </div>
    );
  };

  // ── Render reactions ──
  const renderReactions = (msg) => {
    const reacts = msg.reactions || [];
    if (!reacts.length) return null;
    const grouped = {};
    reacts.forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });
    return (
      <div className="flex gap-1 mt-1 flex-wrap">
        {Object.entries(grouped).map(([emoji, count]) => {
          const r = REACTIONS.find(r => r.emoji === emoji);
          const myReact = reacts.some(rx => rx.user_id === user?.id && rx.emoji === emoji);
          return (
            <button key={emoji} onClick={() => handleReact(msg.id, emoji)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${myReact ? "bg-brand-600/20 border-brand-600/40" : "bg-secondary/30 border-border/30 hover:bg-secondary/50"}`}>
              {r?.display || emoji} {count}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-card backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/communities")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
            {group.avatar_url ? <img src={mediaUrl(group.avatar_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
              : <Users className="h-5 w-5 text-brand-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-sm truncate">{group.name}</h2>
              {group.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {group.member_count} members{onlineMembers.length > 0 && ` · ${onlineMembers.length} online`}
            </p>
          </div>
          <div className="flex gap-1">
            {group.is_member && (
              <>
                <button onClick={() => setShowSearch(!showSearch)} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <button onClick={loadPinned} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                  <Pin className="h-4 w-4" />
                </button>
              </>
            )}
            {isAdmin && (
              <button onClick={openEdit} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setTab(tab === "chat" ? "info" : "chat")}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${tab === "info" ? "bg-brand-600 text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              <Users className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="max-w-3xl mx-auto overflow-hidden">
              <div className="flex gap-2 mt-3">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Search messages..." className="flex-1 bg-secondary/30 border-border/40 h-8 text-sm" />
                <Button size="sm" onClick={handleSearch} disabled={searching} className="h-8 px-3 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl text-xs">
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {searchResults.map(r => (
                    <div key={r.id} className="text-xs p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors">
                      <span className="font-bold text-brand-600">{r.sender_name}:</span> {r.content?.substring(0, 100)}
                      <span className="text-muted-foreground ml-2">{formatTime(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {tab === "info" ? (
        /* ═══ Info Panel ═══ */
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {group.cover_url && (
              <div className="rounded-[28px] overflow-hidden h-40">
                <img src={mediaUrl(group.cover_url)} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* About + Quick actions */}
            <div className="p-5 rounded-[28px] border border-border/40 bg-card shadow-sm">
              <h3 className="admin-heading mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{group.description || "No description."}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="sport" className="text-[10px]">{group.group_type}</Badge>
                {group.sport && <Badge variant="outline" className="text-[10px] capitalize">{group.sport}</Badge>}
                <span className="text-[10px] text-muted-foreground ml-auto">Max {group.max_members || 500}</span>
              </div>
              {/* Quick action buttons */}
              {group.is_member && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={handleToggleMute}>
                    {isMuted ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={() => setShowClearConfirm(true)}>
                    <Eraser className="h-3 w-3 mr-1" /> Clear Chat
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={loadGallery}>
                    <ImageIcon className="h-3 w-3 mr-1" /> Media
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={handleGetInvite}>
                        <Link2 className="h-3 w-3 mr-1" /> Invite Link
                      </Button>
                      {group.is_private && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={loadJoinRequests}>
                          <Users className="h-3 w-3 mr-1" /> Requests
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="p-5 rounded-[28px] border border-border/40 bg-card shadow-sm">
              <h3 className="admin-heading mb-3">Members ({group.member_count})</h3>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(group.member_details || []).map(m => {
                  const isMemberAdmin = admins.includes(m.id);
                  const isMemberCreator = m.id === group.created_by;
                  const isMe = m.id === user?.id;
                  const isOnline = onlineMembers.includes(m.id);
                  const customRole = memberRoles[m.id];
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group/member">
                      <div className="relative">
                        <div className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center cursor-pointer"
                          onClick={() => navigate(`/player-card/${m.id}`)}>
                          {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                            : <User className="h-4 w-4 text-brand-600" />}
                        </div>
                        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-400 border-2 border-card" />}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/player-card/${m.id}`)}>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-sm font-medium truncate">{m.name}</span>
                          {isMemberCreator && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                          {isMemberAdmin && !isMemberCreator && <ShieldCheck className="h-3 w-3 text-brand-400 shrink-0" />}
                          {customRole && <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">{customRole}</Badge>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{m.skill_rating || 1500} SR</span>
                      </div>
                      {isAdmin && !isMe && !isMemberCreator && (
                        <div className="flex gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                          <button onClick={() => { setRoleEditMember(m.id); setRoleInput(customRole || ""); }} title="Set role"
                            className="h-7 w-7 rounded-md flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                            <Crown className="h-3.5 w-3.5" />
                          </button>
                          {!isMemberAdmin ? (
                            <button onClick={() => handlePromote(m.id)} title="Promote"
                              className="h-7 w-7 rounded-md flex items-center justify-center bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"><ShieldCheck className="h-3.5 w-3.5" /></button>
                          ) : isCreator ? (
                            <button onClick={() => handleDemote(m.id)} title="Demote"
                              className="h-7 w-7 rounded-md flex items-center justify-center bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"><ShieldOff className="h-3.5 w-3.5" /></button>
                          ) : null}
                          <button onClick={() => handleRemoveMember(m.id)} title="Remove"
                            className="h-7 w-7 rounded-md flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20"><UserMinus className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role edit inline */}
            {roleEditMember && (
              <div className="p-4 rounded-[28px] border border-border/40 bg-card shadow-sm space-y-3">
                <h4 className="text-xs font-medium text-foreground">Set Custom Role</h4>
                <div className="flex gap-1 flex-wrap">
                  {ROLE_PRESETS.map(r => (
                    <button key={r} onClick={() => setRoleInput(r)}
                      className={`px-2 py-1 rounded-full text-[10px] admin-btn transition-all active:scale-95 ${roleInput === r ? "bg-brand-600 text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <Input value={roleInput} onChange={e => setRoleInput(e.target.value)} placeholder="Custom role..." className="h-8 text-sm bg-secondary/20 border-border/40 rounded-xl" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRoleEditMember(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => handleSetRole(roleEditMember, roleInput)} className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 text-xs px-3"><Check className="h-3 w-3 mr-1" /> Set</Button>
                  {memberRoles[roleEditMember] && <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleSetRole(roleEditMember, "")}>Remove</Button>}
                </div>
              </div>
            )}

            {group.is_member && !isCreator && (
              <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleLeave}>
                <LogOut className="h-4 w-4 mr-2" /> Leave Group
              </Button>
            )}
            {isCreator && (
              !showDeleteConfirm ? (
                <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Group
                </Button>
              ) : (
                <div className="p-4 rounded-[28px] border border-destructive/30 bg-destructive/5 space-y-3">
                  <p className="text-sm font-medium text-destructive">Delete permanently? All messages will be lost.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={handleDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />} Confirm
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* ═══ Chat Area ═══ */
        <>
          {!group.is_member ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="admin-heading text-muted-foreground mb-2">
                  {group.is_private ? "Private Group" : "Join to chat"}
                </h3>
                <p className="text-sm text-muted-foreground/70 mb-4">
                  {group.is_private ? "Request to join this private group" : "Become a member to send messages"}
                </p>
                <button className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-10 px-4 flex items-center gap-2 shadow-lg shadow-brand-600/20" onClick={group.is_private ? async () => {
                  try { await groupAPI.requestJoin(groupId); toast.success("Join request sent!"); }
                  catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
                } : handleJoin}>
                  <Plus className="h-4 w-4" /> {group.is_private ? "Request to Join" : "Join Group"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
                <div className="max-w-3xl mx-auto space-y-1">
                  {groupedMessages.map((dg) => (
                    <div key={dg.date}>
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 rounded-full bg-secondary/50 text-[10px] admin-btn text-muted-foreground">{dg.date}</span>
                      </div>
                      {dg.messages.map((msg, mi) => {
                        const isMe = msg.sender_id === user?.id;
                        const showAvatar = mi === 0 || dg.messages[mi - 1]?.sender_id !== msg.sender_id;
                        if (msg.deleted) {
                          return (
                            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} mt-1`}>
                              {!isMe ? <div className="w-7 flex-shrink-0" /> : null}
                              <div className="px-3 py-2 rounded-2xl text-xs italic text-muted-foreground bg-secondary/20">Message deleted</div>
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${showAvatar ? "mt-3" : "mt-0.5"} group/msg`}>
                            {!isMe && showAvatar ? (
                              <div className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer"
                                onClick={() => navigate(`/player-card/${msg.sender_id}`)}>
                                {msg.sender_avatar ? <img src={mediaUrl(msg.sender_avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                                  : <User className="h-3.5 w-3.5 text-brand-600" />}
                              </div>
                            ) : !isMe ? <div className="w-7 flex-shrink-0" /> : null}
                            <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                              {!isMe && showAvatar && (
                                <span className="text-[10px] font-medium text-brand-600 ml-1 mb-0.5 block">{msg.sender_name}</span>
                              )}
                              <div className="relative">
                                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-brand-600 text-white rounded-br-md" : "bg-secondary/50 text-foreground rounded-bl-md"}`}>
                                  {msg.forwarded_from && <div className="text-[10px] opacity-70 mb-1">Forwarded from {msg.forwarded_from}</div>}
                                  {msg.pinned && <Pin className="inline h-3 w-3 mr-1 opacity-50" />}
                                  {renderContent(msg.content)}
                                  {msg.media_url && msg.media_type === "voice" ? (
                                    <div className="flex items-center gap-2 mt-1">
                                      <button onClick={(e) => { const a = e.currentTarget.nextSibling; a.paused ? a.play() : a.pause(); }}
                                        className="h-8 w-8 rounded-full bg-background/20 flex items-center justify-center"><Volume2 className="h-4 w-4" /></button>
                                      <audio src={mediaUrl(msg.media_url)} className="hidden" />
                                      <span className="text-[10px] opacity-70">{msg.duration ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}` : "Voice"}</span>
                                    </div>
                                  ) : msg.media_url ? (
                                    <img src={mediaUrl(msg.media_url)} alt="" className="rounded-xl mt-2 max-h-48 object-cover cursor-pointer"
                                      onClick={() => window.open(mediaUrl(msg.media_url), "_blank")} />
                                  ) : null}
                                  {msg.message_type === "poll" && renderPoll(msg)}
                                </div>
                                {/* Hover actions */}
                                <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full" : "right-0 translate-x-full"} opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-0.5 px-1`}>
                                  <button onClick={() => setReactionMsgId(reactionMsgId === msg.id ? null : msg.id)}
                                    className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]">
                                    <Smile className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => setContextMsg(contextMsg?.id === msg.id ? null : msg)}
                                    className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-3 w-3" />
                                  </button>
                                </div>
                                {/* Reaction picker */}
                                {reactionMsgId === msg.id && (
                                  <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-8 flex gap-0.5 bg-card border border-border rounded-full px-2 py-1 shadow-lg z-10`}>
                                    {REACTIONS.map(r => (
                                      <button key={r.emoji} onClick={() => handleReact(msg.id, r.emoji)} className="hover:scale-125 transition-transform text-sm">{r.display}</button>
                                    ))}
                                  </div>
                                )}
                                {/* Context menu */}
                                {contextMsg?.id === msg.id && (
                                  <div className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg z-10 py-1 min-w-[140px]`}>
                                    {isAdmin && (
                                      <button onClick={() => handlePin(msg.id, msg.pinned)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2">
                                        <Pin className="h-3 w-3" /> {msg.pinned ? "Unpin" : "Pin"}
                                      </button>
                                    )}
                                    <button onClick={() => { setForwardMsg(msg); setShowForward(true); setContextMsg(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2">
                                      <Forward className="h-3 w-3" /> Forward
                                    </button>
                                    {(isMe || isAdmin) && (
                                      <button onClick={() => handleDeleteMsg(msg.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2 text-destructive">
                                        <Trash2 className="h-3 w-3" /> Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {renderReactions(msg)}
                              <span className={`text-[10px] text-muted-foreground/60 mt-0.5 block ${isMe ? "text-right mr-1" : "ml-1"}`}>{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center py-20">
                      <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1">
                  <div className="max-w-3xl mx-auto">
                    <span className="text-[10px] text-muted-foreground italic">
                      {typingUsers.map(t => t.user_name).join(", ")} typing...
                    </span>
                  </div>
                </div>
              )}

              {/* Pending file preview */}
              {pendingFile && (
                <div className="px-4 py-2 bg-card border-t border-border">
                  <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <img src={URL.createObjectURL(pendingFile)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{pendingFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="sticky bottom-0 bg-card backdrop-blur-xl border-t border-border/40 px-4 py-3">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/30 text-muted-foreground hover:text-brand-600 hover:bg-secondary/50 transition-colors">
                    <Image className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowPollCreate(true)}
                    className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/30 text-muted-foreground hover:text-brand-600 hover:bg-secondary/50 transition-colors">
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  {!recording ? (
                    <>
                      <div className="flex-1 relative">
                        <Input ref={inputRef} value={msgText} onChange={handleMsgChange}
                          onKeyDown={handleMentionKeyDown}
                          placeholder="Type a message..." className="bg-secondary/30 border-border/40" />
                        {/* @Mention dropdown */}
                        <AnimatePresence>
                          {mentionResults.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                              className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border/40 rounded-[28px] shadow-sm overflow-hidden z-50 max-h-48 overflow-y-auto">
                              {mentionResults.map((m, i) => (
                                <button key={m.id} onClick={() => selectMention(m)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                                    i === mentionIndex ? "bg-brand-600/10" : "hover:bg-secondary/30"
                                  }`}>
                                  <div className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                                      : <User className="h-3.5 w-3.5 text-brand-600" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate block">{m.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{m.skill_rating || 1500} SR</span>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {msgText.trim() || pendingFile ? (
                        <button onClick={handleSend} disabled={sending} className="h-10 w-10 flex-shrink-0 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center transition-all active:scale-95">
                          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      ) : (
                        <button onClick={startRecording}
                          className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-brand-600 text-white hover:bg-brand-500 transition-colors">
                          <Mic className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3 px-3">
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-mono text-red-400">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}</span>
                        <span className="text-xs text-muted-foreground">Recording...</span>
                      </div>
                      <button onClick={() => { mediaRecorderRef.current?.stop(); setRecording(false); clearInterval(recordTimerRef.current); }}
                        className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground"><X className="h-4 w-4" /></button>
                      <button onClick={stopRecording}
                        className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-brand-600 text-white">
                        <Send className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ MODALS ═══ */}
      <AnimatePresence>
        {/* Edit Group Modal */}
        {showEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowEdit(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="admin-heading">Edit Group</h2>
                <button onClick={() => setShowEdit(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Avatar</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="relative h-16 w-16 rounded-xl bg-brand-600/10 flex items-center justify-center overflow-hidden group/av cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}>
                      {editForm.avatar_url ? <img src={mediaUrl(editForm.avatar_url)} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <Users className="h-8 w-8 text-brand-600" />}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity rounded-xl">
                        {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                      </div>
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cover Image</Label>
                  <div className="mt-1 relative h-28 rounded-xl bg-secondary/30 border border-dashed border-border/40 flex items-center justify-center overflow-hidden group/cv cursor-pointer"
                    onClick={() => coverInputRef.current?.click()}>
                    {editForm.cover_url ? <img src={mediaUrl(editForm.cover_url)} alt="" className="w-full h-full object-cover" />
                      : <div className="text-center"><Camera className="h-6 w-6 mx-auto text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Upload cover</span></div>}
                    {editForm.cover_url && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cv:opacity-100 transition-opacity">
                      {uploadingCover ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                    </div>}
                  </div>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>
                <div><Label className="text-xs text-muted-foreground">Name *</Label>
                  <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" /></div>
                <div><Label className="text-xs text-muted-foreground">Description</Label>
                  <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3}
                    className="mt-1 w-full rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm resize-none focus:outline-none" /></div>
                <div><Label className="text-xs text-muted-foreground">Sport</Label>
                  <select value={editForm.sport} onChange={e => setEditForm(p => ({ ...p, sport: e.target.value }))} className="mt-1 w-full rounded-xl h-11 border border-border/40 bg-secondary/20 px-3 py-2 text-sm">
                    <option value="">Any Sport</option>{SPORTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editForm.is_private || false} onChange={e => setEditForm(p => ({ ...p, is_private: e.target.checked }))} className="rounded border-border" /><span className="text-sm">Private</span></label>
                  <div><Label className="text-xs text-muted-foreground">Max Members</Label>
                    <Input type="number" min={2} max={5000} value={editForm.max_members} onChange={e => setEditForm(p => ({ ...p, max_members: parseInt(e.target.value) || 500 }))} className="mt-1 bg-secondary/20 border-border/40 rounded-xl" /></div>
                </div>
                <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all">
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Poll Create Modal */}
        {showPollCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPollCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="admin-heading">Create Poll</h2>
                <button onClick={() => setShowPollCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Question</Label>
                  <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask something..." className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" /></div>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                      placeholder={`Option ${i + 1}`} className="bg-secondary/20 border-border/40 rounded-xl" />
                    {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
                {pollOptions.length < 10 && (
                  <Button variant="outline" size="sm" className="admin-btn" onClick={() => setPollOptions([...pollOptions, ""])}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                )}
                <Button onClick={handleCreatePoll} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"><BarChart3 className="h-4 w-4 mr-2" /> Create Poll</Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Pinned Messages Modal */}
        {showPinned && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPinned(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="admin-heading flex items-center gap-2"><Pin className="h-4 w-4" /> Pinned Messages</h2>
                <button onClick={() => setShowPinned(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {pinnedMsgs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No pinned messages</p> : (
                <div className="space-y-2">
                  {pinnedMsgs.map(m => (
                    <div key={m.id} className="p-3 rounded-2xl bg-secondary/20 border border-border/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-brand-600">{m.sender_name}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                      </div>
                      <p className="text-sm">{m.content}</p>
                      {m.media_url && <img src={mediaUrl(m.media_url)} alt="" className="rounded-lg mt-2 max-h-32 object-cover" />}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Invite Link Modal */}
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowInvite(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
              <h2 className="admin-heading mb-4 flex items-center gap-2"><Link2 className="h-4 w-4" /> Invite Link</h2>
              <div className="p-3 rounded-xl bg-secondary/30 text-xs font-mono break-all mb-4">
                {window.location.origin}/communities/{groupId}?invite={inviteCode}
              </div>
              <Button onClick={copyInviteLink} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl active:scale-[0.98] transition-all"><Copy className="h-4 w-4 mr-2" /> Copy Link</Button>
            </motion.div>
          </motion.div>
        )}

        {/* Join Requests Modal */}
        {showRequests && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowRequests(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="admin-heading">Join Requests</h2>
                <button onClick={() => setShowRequests(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {joinRequests.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No pending requests</p> : (
                <div className="space-y-2">
                  {joinRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20">
                      <div className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center">
                        {r.user_avatar ? <img src={mediaUrl(r.user_avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <User className="h-4 w-4 text-brand-600" />}
                      </div>
                      <span className="flex-1 text-sm font-medium">{r.user_name}</span>
                      <Button size="sm" className="h-7 text-[10px] admin-btn rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-3" onClick={() => handleApproveRequest(r.id)}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleRejectRequest(r.id)}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Media Gallery Modal */}
        {showGallery && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowGallery(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="admin-heading flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media Gallery</h2>
                <button onClick={() => setShowGallery(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {galleryMedia.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No media shared yet</p> : (
                <div className="grid grid-cols-3 gap-2">
                  {galleryMedia.map(m => (
                    <div key={m.id} className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(mediaUrl(m.media_url), "_blank")}>
                      <img src={mediaUrl(m.media_url)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Forward Modal */}
        {showForward && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowForward(false); setForwardMsg(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
              <h2 className="admin-heading mb-4">Forward to Group</h2>
              <p className="text-xs text-muted-foreground mb-3">Select a group:</p>
              <ForwardGroupList onSelect={handleForward} currentGroupId={groupId} />
            </motion.div>
          </motion.div>
        )}

        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowClearConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card rounded-[28px] p-6 w-full max-w-xs shadow-xl border border-border/40"
              onClick={e => e.stopPropagation()}>
              <h3 className="admin-heading mb-2">Clear Chat?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Messages will be cleared only for you. Other members will still see their chat history.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleClearChat}>Clear</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for forward modal
function ForwardGroupList({ onSelect, currentGroupId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    groupAPI.myGroups().then(res => setGroups((res.data || []).filter(g => g.id !== currentGroupId))).catch(() => {}).finally(() => setLoading(false));
  }, [currentGroupId]);
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>;
  if (!groups.length) return <p className="text-sm text-muted-foreground text-center py-4">No other groups</p>;
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {groups.map(g => (
        <button key={g.id} onClick={() => onSelect(g.id)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left">
          <div className="h-8 w-8 rounded-xl bg-brand-600/10 flex items-center justify-center">
            {g.avatar_url ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-8 w-8 rounded-xl object-cover" /> : <Users className="h-4 w-4 text-brand-600" />}
          </div>
          <span className="text-sm font-medium truncate">{g.name}</span>
        </button>
      ))}
    </div>
  );
}
