import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mediaUrl } from "@/lib/utils";
import {
  User, MessageCircle, Pin, Smile, MoreVertical,
  Trash2, Forward, Volume2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const REACTIONS = [
  { emoji: "thumbsup", display: "\ud83d\udc4d" },
  { emoji: "heart", display: "\u2764\ufe0f" },
  { emoji: "laugh", display: "\ud83d\ude02" },
  { emoji: "wow", display: "\ud83d\ude2e" },
  { emoji: "fire", display: "\ud83d\udd25" },
  { emoji: "clap", display: "\ud83d\udc4f" },
];

export default function GroupMessageList({
  group,
  user,
  groupedMessages,
  typingUsers,
  chatContainerRef,
  messagesEndRef,
  reactionMsgId,
  onToggleReaction,
  onReact,
  contextMsg,
  onToggleContext,
  onPin,
  onDeleteMsg,
  onForwardMsg,
  isAdmin,
  renderContent,
  formatTime,
  onVote,
}) {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState(null);

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
            <button key={i} onClick={() => onVote(msg.id, i)}
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
            <button key={emoji} onClick={() => onReact(msg.id, emoji)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${myReact ? "bg-brand-600/20 border-brand-600/40" : "bg-secondary/30 border-border/30 hover:bg-secondary/50"}`}>
              {r?.display || emoji} {count}
            </button>
          );
        })}
      </div>
    );
  };

  return (
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
                          <button onClick={() => onToggleReaction(reactionMsgId === msg.id ? null : msg.id)}
                            className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]">
                            <Smile className="h-3 w-3" />
                          </button>
                          <button onClick={() => onToggleContext(contextMsg?.id === msg.id ? null : msg)}
                            className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-3 w-3" />
                          </button>
                        </div>
                        {/* Reaction picker */}
                        {reactionMsgId === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-8 flex gap-0.5 bg-card border border-border rounded-full px-2 py-1 shadow-lg z-10`}>
                            {REACTIONS.map(r => (
                              <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)} className="hover:scale-125 transition-transform text-sm">{r.display}</button>
                            ))}
                          </div>
                        )}
                        {/* Context menu */}
                        {contextMsg?.id === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border/40 rounded-xl shadow-lg z-10 py-1 min-w-[140px]`}>
                            {isAdmin && (
                              <button onClick={() => onPin(msg.id, msg.pinned)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2">
                                <Pin className="h-3 w-3" /> {msg.pinned ? "Unpin" : "Pin"}
                              </button>
                            )}
                            <button onClick={() => onForwardMsg(msg)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2">
                              <Forward className="h-3 w-3" /> Forward
                            </button>
                            {(isMe || isAdmin) && (
                              <button onClick={() => setDeleteTarget({ id: msg.id, type: "message" })} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2 text-destructive">
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
          {groupedMessages.length === 0 && (
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>This message will be permanently deleted. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (deleteTarget) onDeleteMsg(deleteTarget.id);
              setDeleteTarget(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
