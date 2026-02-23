import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { groupAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Send, Loader2, Settings, Crown,
  User, Lock, Globe, LogOut, Plus, Image, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [tab, setTab] = useState("chat");

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

  // Poll for new messages every 3s
  useEffect(() => {
    if (!group?.is_member) return;
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [group?.is_member, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!msgText.trim() || sending) return;
    setSending(true);
    try {
      const res = await groupAPI.sendMessage(groupId, { content: msgText.trim() });
      setMessages(prev => [...prev, res.data]);
      setMsgText("");
    } catch {
      toast.error("Failed to send message");
    } finally { setSending(false); }
  };

  const handleJoin = async () => {
    try {
      await groupAPI.join(groupId);
      toast.success("Joined group!");
      loadGroup();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleLeave = async () => {
    try {
      await groupAPI.leave(groupId);
      toast.success("Left group");
      navigate("/communities");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to leave"); }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].date !== date) {
      acc.push({ date, messages: [msg] });
    } else {
      acc[acc.length - 1].messages.push(msg);
    }
    return acc;
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!group) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/communities")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {group.avatar_url ? (
              <img src={mediaUrl(group.avatar_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-sm truncate">{group.name}</h2>
              {group.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
            </div>
            <p className="text-[10px] text-muted-foreground">{group.member_count} members</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTab(tab === "chat" ? "info" : "chat")}
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${tab === "info" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              <Users className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {tab === "info" ? (
        /* Group Info Panel */
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {/* Description */}
            <div className="p-5 rounded-2xl border-2 border-border/50 bg-card">
              <h3 className="font-bold text-sm mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{group.description || "No description provided."}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="sport" className="text-[10px]">{group.group_type}</Badge>
                {group.sport && <Badge variant="outline" className="text-[10px] capitalize">{group.sport}</Badge>}
              </div>
            </div>

            {/* Members */}
            <div className="p-5 rounded-2xl border-2 border-border/50 bg-card">
              <h3 className="font-bold text-sm mb-3">Members ({group.member_count})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(group.member_details || []).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer"
                    onClick={() => navigate(`/player-card/${m.id}`)}>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <User className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.id === group.created_by && <Crown className="inline h-3 w-3 text-amber-500 ml-1" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.skill_rating || 1500} SR</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {group.is_member && (
              <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleLeave}>
                <LogOut className="h-4 w-4 mr-2" /> Leave Group
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Chat Area */
        <>
          {!group.is_member ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-display text-xl font-bold text-muted-foreground mb-2">Join to chat</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Become a member to send and read messages</p>
                <Button variant="athletic" onClick={handleJoin}>
                  <Plus className="h-4 w-4 mr-2" /> Join Group
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
                <div className="max-w-3xl mx-auto space-y-1">
                  {groupedMessages.map((dateGroup, di) => (
                    <div key={dateGroup.date}>
                      {/* Date divider */}
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 rounded-full bg-secondary/50 text-[10px] font-bold text-muted-foreground">
                          {dateGroup.date}
                        </span>
                      </div>
                      {dateGroup.messages.map((msg, mi) => {
                        const isMe = msg.sender_id === user?.id;
                        const showAvatar = mi === 0 || dateGroup.messages[mi - 1]?.sender_id !== msg.sender_id;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${showAvatar ? "mt-3" : "mt-0.5"}`}>
                            {!isMe && showAvatar ? (
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer"
                                onClick={() => navigate(`/player-card/${msg.sender_id}`)}>
                                {msg.sender_avatar ? <img src={mediaUrl(msg.sender_avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                                  : <User className="h-3.5 w-3.5 text-primary" />}
                              </div>
                            ) : !isMe ? <div className="w-7 flex-shrink-0" /> : null}
                            <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                              {!isMe && showAvatar && (
                                <span className="text-[10px] font-bold text-primary ml-1 mb-0.5 block">{msg.sender_name}</span>
                              )}
                              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-secondary/50 text-foreground rounded-bl-md"
                              }`}>
                                {msg.content}
                                {msg.media_url && (
                                  <img src={mediaUrl(msg.media_url)} alt="" className="rounded-lg mt-2 max-h-48 object-cover" />
                                )}
                              </div>
                              <span className={`text-[9px] text-muted-foreground/60 mt-0.5 block ${isMe ? "text-right mr-1" : "ml-1"}`}>
                                {formatTime(msg.created_at)}
                              </span>
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

              {/* Message Input */}
              <div className="sticky bottom-0 bg-card backdrop-blur-xl border-t border-border px-4 py-3">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <Input
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 bg-secondary/30 border-border/50"
                  />
                  <Button variant="athletic" size="icon" onClick={handleSend} disabled={!msgText.trim() || sending}
                    className="h-10 w-10 flex-shrink-0">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Use MessageCircle from lucide (already imported above but used here for clarity)
const MessageCircle2 = MessageCircle;
