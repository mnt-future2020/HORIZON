import React, { useRef, useCallback } from "react";
import {
  Slash,
  FileText,
  Play,
  Pause,
  Pin,
  PinOff,
  Trash2,
  Reply as ReplyIcon,
  User,
  Download,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { motion } from "framer-motion";

const MessageBubble = ({
  msg,
  isMe,
  showTail,
  onLongPress,
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
  const hasMedia = !!msg.media_url;
  const isImageOnly =
    hasMedia && (!msg.media_type || msg.media_type === "image") && !msg.content;
  const hasReply = (msg.reply_preview || msg.reply_to) && !isDeleted;

  // Long-press for mobile touch
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);
  const handleTouchStart = useCallback(
    (e) => {
      if (isDeleted) return;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        window.getSelection()?.removeAllRanges();
        onLongPress(msg);
      }, 500);
    },
    [msg, isDeleted, onLongPress],
  );
  const handleTouchMove = useCallback((e) => {
    if (longPressTimer.current && touchStartPos.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  // Bubble border radii
  const myRadii = showTail
    ? "rounded-[20px] rounded-br-[5px]"
    : "rounded-[20px]";
  const theirRadii = showTail
    ? "rounded-[20px] rounded-bl-[5px]"
    : "rounded-[20px]";

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex ${isMe ? "justify-end" : "justify-start"} ${
        showTail ? "mt-2 sm:mt-2.5" : "mt-[3px]"
      } group/msg relative px-1 sm:px-2`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isDeleted) onLongPress(msg);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Bubble column */}
      <div
        className={`relative flex flex-col max-w-[85%] sm:max-w-[72%] md:max-w-[65%] ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {/* Hover action strip — desktop only */}
        {!isDeleted && (
          <div
            className={`absolute -top-8 ${
              isMe ? "right-1" : "left-1"
            } hidden sm:group-hover/msg:flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-card/95 backdrop-blur-sm border border-border/40 shadow-lg z-30`}
            role="toolbar"
            aria-label="Message actions"
          >
            {[
              {
                icon: ReplyIcon,
                label: "Reply",
                onClick: () => onReply(msg),
                hoverCls: "hover:text-brand-600",
              },
              {
                icon: msg.pinned ? PinOff : Pin,
                label: msg.pinned ? "Unpin" : "Pin",
                onClick: () => onPin(msg),
                hoverCls: msg.pinned
                  ? "hover:text-muted-foreground"
                  : "hover:text-amber-500",
              },
              ...(isMe
                ? [
                    {
                      icon: Trash2,
                      label: "Delete",
                      onClick: () => onDelete(msg),
                      hoverCls: "hover:text-red-500",
                    },
                  ]
                : []),
            ].map(({ icon: Icon, label, onClick, hoverCls }) => (
              <button
                key={label}
                onClick={onClick}
                aria-label={label}
                className={`p-1.5 rounded-lg text-muted-foreground/60 ${hoverCls} transition-colors`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        {/* Main bubble */}
        <div
          className={`relative shadow-sm transition-all select-text overflow-hidden ${
            isImageOnly
              ? ""
              : hasReply
                ? "pt-0 pb-2.5 px-0"
                : "px-3.5 sm:px-4 py-2.5"
          } ${
            isMe
              ? `bg-brand-600 text-white ${myRadii}`
              : `bg-card border border-border/40 text-foreground/90 ${theirRadii}`
          } ${
            isDeleted
              ? "italic opacity-50 !bg-secondary/20 !border-border/20"
              : "active:scale-[0.99] transition-transform"
          }`}
        >
          {/* Pin indicator */}
          {msg.pinned && !isDeleted && (
            <div
              className={`flex items-center gap-1 ${hasReply ? "px-3.5 pt-2" : ""} mb-1 ${
                isMe ? "text-white/60" : "text-amber-500/70"
              }`}
            >
              <Pin className="h-2.5 w-2.5" />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                Pinned
              </span>
            </div>
          )}

          {isDeleted ? (
            <span className="flex items-center gap-2 text-[12px] font-medium py-0.5 px-3.5 text-muted-foreground">
              <Slash className="h-3.5 w-3.5 opacity-50 rotate-12" />
              Message deleted
            </span>
          ) : (
            <div className="flex flex-col">
              {/* Reply preview — INSIDE the bubble as a quoted block */}
              {hasReply && (
                <div
                  className={`mx-2.5 mt-2.5 mb-2 px-3 py-2 rounded-xl border-l-[3px] cursor-pointer transition-colors ${
                    isMe
                      ? "bg-white/10 hover:bg-white/15 border-white/40"
                      : "bg-secondary/40 hover:bg-secondary/60 border-brand-600/50"
                  }`}
                  onClick={() => {
                    if (msg.reply_to) {
                      const el = document.getElementById(
                        `msg-${msg.reply_to}`,
                      );
                      if (el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        el.classList.add("ring-2", "ring-brand-600/40");
                        setTimeout(
                          () =>
                            el.classList.remove("ring-2", "ring-brand-600/40"),
                          2000,
                        );
                      }
                    }
                  }}
                >
                  <p
                    className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${
                      isMe ? "text-white/70" : "text-brand-600/80"
                    }`}
                  >
                    {msg.reply_sender || "Reply"}
                  </p>
                  <p
                    className={`text-[12px] leading-snug line-clamp-2 font-medium ${
                      isMe ? "text-white/60" : "text-muted-foreground/70"
                    }`}
                  >
                    {msg.reply_preview || "…"}
                  </p>
                </div>
              )}

              {/* Text content */}
              {msg.content &&
                !msg.shared_post &&
                !(msg.shared_post?.type === "story") && (
                  <p
                    className={`text-[14px] sm:text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap break-words ${
                      hasReply ? "px-3.5 sm:px-4" : ""
                    }`}
                  >
                    {linkifyText(msg.content)}
                  </p>
                )}

              {/* Story reply card */}
              {msg.shared_post?.type === "story" && (
                <div
                  className={`w-full rounded-2xl overflow-hidden mb-1 ${hasReply ? "px-2.5" : ""}`}
                >
                  <div className="relative w-full h-36 sm:h-40 rounded-2xl overflow-hidden">
                    {msg.shared_post.media_url ? (
                      <img
                        src={mediaUrl(msg.shared_post.media_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center p-4 bg-gradient-to-br ${
                          msg.shared_post.bg_color ||
                          "from-purple-500 to-pink-600"
                        }`}
                      >
                        {msg.shared_post.content && (
                          <p className="text-white text-xs font-bold text-center line-clamp-3 drop-shadow">
                            {msg.shared_post.content}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5">
                      {msg.shared_post.user_avatar ? (
                        <img
                          src={mediaUrl(msg.shared_post.user_avatar)}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover ring-1 ring-white/30"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                          <User className="h-3 w-3 text-white/70" />
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-white/90 drop-shadow">
                        {isMe
                          ? `${msg.shared_post.user_name}'s story`
                          : "Your story"}
                      </span>
                    </div>
                  </div>
                  {msg.content && (
                    <p className="text-[14px] sm:text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap break-words pt-2 px-1">
                      {linkifyText(msg.content)}
                    </p>
                  )}
                </div>
              )}

              {/* Shared post card */}
              {msg.shared_post && msg.shared_post.type !== "story" && (
                <button
                  onClick={() => onOpenSharedPost(msg.shared_post.id)}
                  className={`block w-full text-left rounded-2xl overflow-hidden ${
                    hasReply ? "mx-2.5 w-[calc(100%-20px)]" : ""
                  } ${
                    isMe
                      ? "bg-black/20 hover:bg-black/30"
                      : "bg-secondary/30 hover:bg-secondary/50"
                  } border border-white/8 active:scale-[0.98] transition-all`}
                >
                  {msg.shared_post.media_url && (
                    <img
                      src={mediaUrl(msg.shared_post.media_url)}
                      alt=""
                      className="w-full h-28 sm:h-32 object-cover"
                    />
                  )}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      {msg.shared_post.user_avatar ? (
                        <img
                          src={mediaUrl(msg.shared_post.user_avatar)}
                          alt=""
                          className="h-4.5 w-4.5 rounded-full object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <User className="h-4 w-4 opacity-40" />
                      )}
                      <span className="text-[11px] font-black truncate">
                        {msg.shared_post.user_name}
                      </span>
                    </div>
                    {msg.shared_post.content && (
                      <p className="text-[11px] opacity-65 line-clamp-2 leading-snug italic">
                        {msg.shared_post.content}
                      </p>
                    )}
                  </div>
                </button>
              )}

              {/* Image */}
              {hasMedia && (!msg.media_type || msg.media_type === "image") && (
                <button
                  onClick={() => onOpenLightbox(mediaUrl(msg.media_url))}
                  aria-label="View image"
                  className={`block overflow-hidden ${
                    isImageOnly
                      ? ""
                      : hasReply
                        ? "mt-1 mx-2.5 rounded-2xl"
                        : "mt-1 rounded-2xl"
                  } ${
                    isImageOnly
                      ? `w-full max-w-[240px] sm:max-w-[280px] ${isMe ? myRadii : theirRadii}`
                      : ""
                  }`}
                >
                  <img
                    src={mediaUrl(msg.media_url)}
                    alt="Shared image"
                    className="w-full max-h-56 sm:max-h-72 object-cover hover:brightness-105 active:brightness-95 transition-all"
                    style={isImageOnly ? {} : { borderRadius: "inherit" }}
                  />
                </button>
              )}

              {/* Document */}
              {hasMedia && msg.media_type === "document" && (
                <a
                  href={mediaUrl(msg.media_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 mt-1 p-2.5 sm:p-3 rounded-2xl border transition-all group/doc ${
                    hasReply ? "mx-2.5" : ""
                  } ${
                    isMe
                      ? "bg-white/10 hover:bg-white/20 border-white/10"
                      : "bg-secondary/30 hover:bg-secondary/50 border-border/20"
                  }`}
                >
                  <div
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isMe ? "bg-white/20" : "bg-brand-600/10"
                    }`}
                  >
                    <FileText
                      className={`h-4.5 w-4.5 ${isMe ? "text-white" : "text-brand-600"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] sm:text-[13px] font-bold truncate">
                      {msg.file_name || "Document"}
                    </p>
                    <p className="text-[9px] sm:text-[10px] opacity-50 uppercase font-black tracking-widest mt-0.5">
                      Tap to open
                    </p>
                  </div>
                  <Download
                    className={`h-4 w-4 flex-shrink-0 opacity-40 ${isMe ? "text-white" : "text-brand-600"}`}
                  />
                </a>
              )}

              {/* Voice / Audio */}
              {hasMedia &&
                (msg.media_type === "voice" || msg.media_type === "audio") && (
                  <div
                    className={`flex items-center gap-3 mt-1 p-2.5 rounded-2xl w-full min-w-[180px] sm:min-w-[200px] max-w-[260px] ${
                      hasReply ? "mx-2.5" : ""
                    } ${isMe ? "bg-white/10" : "bg-secondary/30"}`}
                  >
                    <button
                      onClick={() =>
                        onTogglePlayAudio(msg.id, mediaUrl(msg.media_url))
                      }
                      aria-label={playingAudio === msg.id ? "Pause" : "Play"}
                      className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 ${
                        isMe
                          ? "bg-white/20 hover:bg-white/35"
                          : "bg-brand-600/15 hover:bg-brand-600/25"
                      }`}
                    >
                      {playingAudio === msg.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight opacity-60">
                        <span>
                          {msg.media_type === "voice" ? "Voice" : "Audio"}
                        </span>
                        {msg.duration && (
                          <span>
                            {Math.floor(msg.duration / 60)}:
                            {String(msg.duration % 60).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                      <div
                        className={`h-1.5 rounded-full overflow-hidden ${
                          isMe ? "bg-white/20" : "bg-brand-600/15"
                        }`}
                      >
                        {playingAudio === msg.id && (
                          <motion.div
                            className={`h-full rounded-full origin-left ${
                              isMe ? "bg-white/70" : "bg-brand-600/60"
                            }`}
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
      </div>
    </div>
  );
};

export default MessageBubble;
