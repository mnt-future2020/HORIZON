import React from "react";
import {
  Slash,
  FileText,
  Play,
  Pause,
  Bookmark,
  Heart,
  Pin,
  Heart as HeartIcon,
  Trash2,
  Reply as ReplyIcon,
  User,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const MessageBubble = ({
  msg,
  isMe,
  showTail,
  onLongPress,
  onReaction,
  onReply,
  onDelete,
  onPin,
  onForward,
  onOpenSharedPost,
  onOpenLightbox,
  onTogglePlayAudio,
  playingAudio,
  linkifyText,
  user,
}) => {
  const isDeleted = msg.deleted;
  const reactions = Object.entries(msg.reactions || {});

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? "mt-4" : "mt-0.5"} transition-all group/msg relative`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isDeleted) onLongPress(msg);
      }}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] relative flex flex-col ${isMe ? "items-end" : "items-start"}`}
      >
        {/* Quick action strip for desktop */}
        {!isDeleted && (
          <div
            className={`absolute -top-6 ${isMe ? "right-0" : "left-0"} hidden group-hover/msg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-card border border-border/40 shadow-sm z-20 transition-all`}
          >
            <button
              onClick={() => onReply(msg)}
              className="p-1 hover:text-brand-600 transition-colors"
              title="Reply"
            >
              <ReplyIcon className="h-3 w-3" />
            </button>
            <button
              onClick={() => onReaction(msg, "heart")}
              className="p-1 hover:text-red-500 transition-colors"
              title="Heart"
            >
              <Heart className="h-3 w-3" />
            </button>
            <button
              onClick={() => onPin(msg)}
              className="p-1 hover:text-orange-500 transition-colors"
              title="Pin"
            >
              <Pin className="h-3 w-3" />
            </button>
            {isMe && (
              <button
                onClick={() => onDelete(msg)}
                className="p-1 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Reply preview */}
        {(msg.reply_preview || msg.reply_to) && !isDeleted && (
          <div
            className={`mx-1 mb-0.5 px-3 py-2 rounded-t-[18px] text-[10px] border-l-4 ${
              isMe
                ? "bg-brand-600/10 border-brand-600/40"
                : "bg-secondary/40 border-muted-foreground/20"
            } max-w-full min-w-[80px] shadow-sm`}
          >
            <span className="font-black block uppercase tracking-tighter opacity-80 mb-0.5 text-foreground/70">
              {msg.reply_sender || "Reply"}
            </span>
            <span className="text-muted-foreground/80 line-clamp-1 italic font-medium">
              {msg.reply_preview || "..."}
            </span>
          </div>
        )}

        {/* Message main bubble */}
        <div
          className={`px-4 py-3 text-[14px] leading-relaxed relative cursor-default shadow-sm transition-all hover:shadow-md border border-transparent ${
            isMe
              ? `bg-brand-600 text-white ${showTail && !msg.reply_preview ? "rounded-[22px] rounded-br-[4px]" : "rounded-[22px]"}`
              : `bg-card border-border/40 text-foreground/90 ${showTail && !msg.reply_preview ? "rounded-[22px] rounded-bl-[4px]" : "rounded-[22px]"}`
          } ${isDeleted ? "italic opacity-60 bg-secondary/10" : "active:scale-[0.99] transition-transform"}`}
        >
          {isDeleted ? (
            <span className="flex items-center gap-2 text-[11px] font-medium py-1">
              <Slash
                className="h-4 w-4 opacity-40 rotate-12"
                aria-hidden="true"
              />
              This message was deleted
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {msg.content && !msg.shared_post && (
                <div className="font-medium whitespace-pre-wrap break-words selection:bg-white/30 selection:text-white">
                  {linkifyText(msg.content)}
                </div>
              )}

              {/* Shared post card */}
              {msg.shared_post && (
                <button
                  onClick={() => onOpenSharedPost(msg.shared_post.id)}
                  className={`block w-full text-left rounded-xl overflow-hidden mt-0.5 mb-0.5 ${isMe ? "bg-black/20" : "bg-secondary/30"} border border-white/5 active:scale-[0.98] transition-all`}
                >
                  {msg.shared_post.media_url && (
                    <img
                      src={mediaUrl(msg.shared_post.media_url)}
                      alt=""
                      className="w-full h-32 object-cover opacity-90 hover:opacity-100 transition-opacity"
                    />
                  )}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      {msg.shared_post.user_avatar ? (
                        <img
                          src={mediaUrl(msg.shared_post.user_avatar)}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <User className="h-4 w-4 opacity-50" />
                      )}
                      <span className="text-[11px] font-black tracking-tight">
                        {msg.shared_post.user_name}
                      </span>
                    </div>
                    {msg.shared_post.content && (
                      <p className="text-[11px] opacity-70 line-clamp-2 leading-snug font-medium italic select-none">
                        {msg.shared_post.content}
                      </p>
                    )}
                  </div>
                </button>
              )}

              {/* Image */}
              {msg.media_url &&
                (!msg.media_type || msg.media_type === "image") && (
                  <img
                    src={mediaUrl(msg.media_url)}
                    alt=""
                    className="rounded-[18px] mt-0.5 max-w-full max-h-64 sm:max-h-80 object-cover cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLightbox(mediaUrl(msg.media_url));
                    }}
                  />
                )}

              {/* Document */}
              {msg.media_url && msg.media_type === "document" && (
                <a
                  href={mediaUrl(msg.media_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 mt-1 p-3 rounded-2xl ${isMe ? "bg-white/10 hover:bg-white/20" : "bg-secondary/30 hover:bg-secondary/50"} border border-white/5 transition-all group/doc`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isMe ? "bg-white/20" : "bg-brand-600/10"}`}
                  >
                    <FileText
                      className={`h-5 w-5 ${isMe ? "text-white" : "text-brand-600"}`}
                    />
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] font-black truncate leading-tight group-hover/doc:text-brand-600 transition-colors">
                      {msg.file_name || "Document"}
                    </p>
                    <p className="text-[9px] opacity-50 uppercase font-black tracking-widest mt-0.5">
                      Download File
                    </p>
                  </div>
                </a>
              )}

              {/* Voice message */}
              {msg.media_url &&
                (msg.media_type === "voice" || msg.media_type === "audio") && (
                  <div className="flex items-center gap-3 mt-1 min-w-[200px] bg-black/5 p-2 rounded-2xl border border-white/5">
                    <button
                      onClick={() =>
                        onTogglePlayAudio(msg.id, mediaUrl(msg.media_url))
                      }
                      className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? "bg-white/20 hover:bg-white/30" : "bg-brand-600/10 hover:bg-brand-600/20"} transition-all active:scale-95`}
                    >
                      {playingAudio === msg.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter opacity-70">
                        <span>
                          {msg.media_type === "voice" ? "Voice Note" : "Audio"}
                        </span>
                        {msg.duration && (
                          <span>
                            {Math.floor(msg.duration / 60)}:
                            {(msg.duration % 60).toString().padStart(2, "0")}
                          </span>
                        )}
                      </div>
                      <div
                        className={`h-1.5 rounded-full ${isMe ? "bg-white/20" : "bg-brand-600/10"} overflow-hidden relative`}
                      >
                        {playingAudio === msg.id && (
                          <motion.div
                            className={`absolute inset-0 ${isMe ? "bg-white" : "bg-brand-600"} opacity-40`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: msg.duration || 10,
                              ease: "linear",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Reaction badge display */}
        {reactions.length > 0 && !isDeleted && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}
          >
            {reactions.map(([emoji, count]) => (
              <motion.div
                key={emoji}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border border-border/40 bg-card hover:scale-110 transition-transform cursor-default ${isMe ? "mr-1" : "ml-1"}`}
              >
                <span>{emoji}</span>
                {count > 1 && (
                  <span className="opacity-60 text-[10px]">{count}</span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
