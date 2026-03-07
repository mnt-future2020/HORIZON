import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import {
  User, MessageCircle, Pin, Smile, MoreVertical,
  Trash2, Forward, Volume2,
} from "lucide-react";

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
      <div className="mt-2 p-3 rounded-xl bg-background/60 border border-border/20 space-y-2">
        <div className="font-medium text-[12px] text-foreground">{poll.question}</div>
        {poll.options.map((opt, i) => {
          const votes = opt.votes?.length || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const voted = opt.votes?.includes(user?.id);
          return (
            <button
              key={i}
              onClick={() => onVote(msg.id, i)}
              className={`w-full text-left p-2.5 rounded-lg text-[12px] transition-all ${
                voted
                  ? "bg-brand-600/15 border border-brand-600/30"
                  : "bg-secondary/20 hover:bg-secondary/40 border border-transparent"
              }`}
            >
              <div className="flex justify-between mb-1">
                <span>{opt.text}</span>
                <span className="text-muted-foreground/60">{votes} ({pct}%)</span>
              </div>
              <div className="h-1 rounded-full bg-secondary/40 overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
        <div className="text-[10px] text-muted-foreground/50">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</div>
      </div>
    );
  };

  const renderReactions = (msg) => {
    const reacts = msg.reactions || [];
    if (!reacts.length) return null;
    const grouped = {};
    reacts.forEach((r) => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });
    return (
      <div className="flex gap-1 mt-1 flex-wrap">
        {Object.entries(grouped).map(([emoji, count]) => {
          const r = REACTIONS.find((r) => r.emoji === emoji);
          const myReact = reacts.some((rx) => rx.user_id === user?.id && rx.emoji === emoji);
          return (
            <button
              key={emoji}
              onClick={() => onReact(msg.id, emoji)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                myReact
                  ? "bg-brand-600/15 border-brand-600/30"
                  : "bg-secondary/20 border-border/20 hover:bg-secondary/40"
              }`}
            >
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
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
        style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        <div className="max-w-5xl mx-auto px-1 sm:px-2 py-3 flex flex-col gap-0">
          {groupedMessages.map((dg) => (
            <div key={dg.date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4 sticky top-2 z-20 pointer-events-none">
                <span className="px-3 py-1 rounded-lg bg-card/90 backdrop-blur-sm text-[11px] font-medium text-muted-foreground/60 shadow-sm border border-border/10 pointer-events-auto">
                  {dg.date}
                </span>
              </div>

              {dg.messages.map((msg, mi) => {
                const isMe = msg.sender_id === user?.id;
                const prevMsg = mi > 0 ? dg.messages[mi - 1] : null;
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                if (msg.deleted) {
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} px-2 sm:px-3 ${showAvatar ? "mt-2" : "mt-[2px]"}`}>
                      {!isMe && <div className="w-7 flex-shrink-0 mr-1.5" />}
                      <div className="px-3 py-1.5 rounded-2xl text-[12px] italic text-muted-foreground/50 bg-secondary/15">
                        Message deleted
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} px-2 sm:px-3 ${showAvatar ? "mt-2" : "mt-[2px]"} group/msg`}
                  >
                    {/* Avatar */}
                    {!isMe && showAvatar ? (
                      <div
                        className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 mt-1 mr-1.5 cursor-pointer"
                        onClick={() => navigate(`/player-card/${msg.sender_id}`)}
                      >
                        {msg.sender_avatar ? (
                          <img src={mediaUrl(msg.sender_avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-brand-600" />
                        )}
                      </div>
                    ) : !isMe ? (
                      <div className="w-7 flex-shrink-0 mr-1.5" />
                    ) : null}

                    <div className={`max-w-[82%] sm:max-w-[70%] md:max-w-[60%] ${isMe ? "items-end" : "items-start"}`}>
                      {/* Sender name */}
                      {!isMe && showAvatar && (
                        <span className="text-[10px] font-semibold text-brand-600 ml-1 mb-0.5 block">{msg.sender_name}</span>
                      )}

                      <div className="relative">
                        {/* Bubble */}
                        <div
                          className={`px-3 py-2 text-[14px] leading-relaxed ${
                            isMe
                              ? `bg-brand-600 text-white rounded-2xl ${showAvatar ? "rounded-br-[4px]" : "rounded-2xl rounded-br-[4px]"}`
                              : `bg-card border border-border/15 text-foreground rounded-2xl ${showAvatar ? "rounded-bl-[4px]" : "rounded-2xl rounded-bl-[4px]"}`
                          }`}
                        >
                          {msg.forwarded_from && (
                            <div className={`text-[10px] mb-1 ${isMe ? "text-white/60" : "text-muted-foreground/50"}`}>
                              Forwarded from {msg.forwarded_from}
                            </div>
                          )}
                          {msg.pinned && <Pin className={`inline h-3 w-3 mr-1 ${isMe ? "text-white/50" : "text-muted-foreground/40"}`} />}
                          {renderContent(msg.content)}

                          {/* Voice message */}
                          {msg.media_url && msg.media_type === "voice" ? (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={(e) => { const a = e.currentTarget.nextSibling; a.paused ? a.play() : a.pause(); }}
                                className={`h-8 w-8 rounded-full flex items-center justify-center ${isMe ? "bg-white/20" : "bg-secondary/40"}`}
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                              <audio src={mediaUrl(msg.media_url)} className="hidden" />
                              <span className={`text-[10px] ${isMe ? "text-white/60" : "text-muted-foreground/50"}`}>
                                {msg.duration ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}` : "Voice"}
                              </span>
                            </div>
                          ) : msg.media_url ? (
                            <img
                              src={mediaUrl(msg.media_url)}
                              alt=""
                              className="rounded-lg mt-2 max-h-48 object-cover cursor-pointer"
                              onClick={() => window.open(mediaUrl(msg.media_url), "_blank")}
                            />
                          ) : null}

                          {msg.message_type === "poll" && renderPoll(msg)}

                          {/* Inline timestamp */}
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? "text-white/50" : "text-muted-foreground/40"}`}>
                            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                          </div>
                        </div>

                        {/* Hover actions */}
                        <div className={`absolute top-1 ${isMe ? "-left-[52px]" : "-right-[52px]"} opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-0.5`}>
                          <button
                            onClick={() => onToggleReaction(reactionMsgId === msg.id ? null : msg.id)}
                            className="h-7 w-7 rounded-full bg-card border border-border/20 shadow-sm flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onToggleContext(contextMsg?.id === msg.id ? null : msg)}
                            className="h-7 w-7 rounded-full bg-card border border-border/20 shadow-sm flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Reaction picker */}
                        <AnimatePresence>
                          {reactionMsgId === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className={`absolute ${isMe ? "right-0" : "left-0"} -top-9 flex gap-0.5 bg-card border border-border/20 rounded-full px-2 py-1 shadow-lg z-10`}
                            >
                              {REACTIONS.map((r) => (
                                <button
                                  key={r.emoji}
                                  onClick={() => onReact(msg.id, r.emoji)}
                                  className="hover:scale-125 transition-transform text-sm p-0.5"
                                >
                                  {r.display}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Context menu */}
                        <AnimatePresence>
                          {contextMsg?.id === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border/20 rounded-xl shadow-lg z-10 py-1.5 min-w-[140px] overflow-hidden`}
                            >
                              {isAdmin && (
                                <button
                                  onClick={() => onPin(msg.id, msg.pinned)}
                                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-secondary/30 flex items-center gap-2.5 transition-colors"
                                >
                                  <Pin className="h-3.5 w-3.5 text-amber-500" /> {msg.pinned ? "Unpin" : "Pin"}
                                </button>
                              )}
                              <button
                                onClick={() => onForwardMsg(msg)}
                                className="w-full text-left px-3 py-2 text-[12px] hover:bg-secondary/30 flex items-center gap-2.5 transition-colors"
                              >
                                <Forward className="h-3.5 w-3.5 text-blue-500" /> Forward
                              </button>
                              {(isMe || isAdmin) && (
                                <button
                                  onClick={() => setDeleteTarget({ id: msg.id, type: "message" })}
                                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-secondary/30 flex items-center gap-2.5 text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {renderReactions(msg)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {groupedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="h-16 w-16 rounded-full bg-secondary/30 flex items-center justify-center">
                <MessageCircle className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-[13px] text-muted-foreground/50">No messages yet. Say hello!</p>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" aria-hidden="true" />
        </div>
      </div>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex justify-start px-3 py-1"
          >
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-[4px] bg-card border border-border/20">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground/50 mr-1">
                  {typingUsers.map((t) => t.user_name).join(", ")}
                </span>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-card rounded-2xl border border-border/30 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-center mb-1.5">Delete Message?</h3>
              <p className="text-[13px] text-muted-foreground/60 text-center leading-relaxed mb-6">
                This message will be permanently deleted. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 rounded-xl font-medium text-[13px] border border-border/40 hover:bg-secondary/40 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteTarget) onDeleteMsg(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  className="h-10 rounded-xl font-semibold text-[13px] bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
