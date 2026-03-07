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
  Image as ImageIcon,
  Volume2,
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
  onForward: _onForward,
  onOpenSharedPost,
  onOpenLightbox,
  onTogglePlayAudio,
  playingAudio,
  linkifyText,
  user: _user,
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

  // Timestamp formatting
  const msgTime = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // Bubble border radii - WhatsApp style
  const myRadii = showTail
    ? "rounded-2xl rounded-br-[4px]"
    : "rounded-2xl";
  const theirRadii = showTail
    ? "rounded-2xl rounded-bl-[4px]"
    : "rounded-2xl";

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex ${isMe ? "justify-end" : "justify-start"} ${
        showTail ? "mt-2" : "mt-[2px]"
      } group/msg relative px-2 sm:px-3`}
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
        className={`relative flex flex-col max-w-[82%] sm:max-w-[70%] md:max-w-[60%] ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {/* Hover action strip — desktop only */}
        {!isDeleted && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${
              isMe ? "-left-24" : "-right-24"
            } hidden sm:group-hover/msg:flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-card/95 backdrop-blur-sm border border-border/30 shadow-md z-30`}
            role="toolbar"
            aria-label="Message actions"
          >
            {[
              {
                icon: ReplyIcon,
                label: "Reply",
                onClick: () => onReply(msg),
                cls: "hover:text-brand-600 hover:bg-brand-600/8",
              },
              {
                icon: msg.pinned ? PinOff : Pin,
                label: msg.pinned ? "Unpin" : "Pin",
                onClick: () => onPin(msg),
                cls: msg.pinned
                  ? "hover:text-muted-foreground hover:bg-secondary/60"
                  : "hover:text-amber-500 hover:bg-amber-500/8",
              },
              ...(isMe
                ? [
                    {
                      icon: Trash2,
                      label: "Delete",
                      onClick: () => onDelete(msg),
                      cls: "hover:text-red-500 hover:bg-red-500/8",
                    },
                  ]
                : []),
            ].map(({ icon: Icon, label, onClick, cls }) => (
              <button
                key={label}
                onClick={onClick}
                aria-label={label}
                className={`p-1.5 rounded-full text-muted-foreground/40 transition-all ${cls}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        {/* Main bubble */}
        <div
          className={`relative select-text overflow-hidden ${
            isImageOnly
              ? `${isMe ? myRadii : theirRadii} overflow-hidden`
              : `${isMe ? myRadii : theirRadii} ${hasReply ? "pt-0" : ""}`
          } ${
            isMe
              ? "bg-brand-600 text-white"
              : "bg-card border border-border/30 text-foreground"
          } ${
            isDeleted
              ? "italic opacity-50 !bg-secondary/20 !border-border/20"
              : ""
          }`}
        >
          {/* Pin indicator */}
          {msg.pinned && !isDeleted && (
            <div
              className={`flex items-center gap-1 px-3 pt-1.5 ${
                isMe ? "text-white/50" : "text-amber-500/60"
              }`}
            >
              <Pin className="h-2.5 w-2.5" />
              <span className="text-[10px] font-medium">Pinned</span>
            </div>
          )}

          {isDeleted ? (
            <span className="flex items-center gap-2 text-[13px] font-normal py-2 px-3.5 text-muted-foreground italic">
              <Slash className="h-3.5 w-3.5 opacity-40" />
              Message deleted
            </span>
          ) : (
            <div className="flex flex-col">
              {/* Reply preview — WhatsApp quoted style */}
              {hasReply && (
                <div
                  className={`mx-1.5 mt-1.5 mb-1 flex items-stretch gap-0 rounded-lg overflow-hidden cursor-pointer transition-colors ${
                    isMe
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-secondary/50 hover:bg-secondary/70"
                  }`}
                  onClick={() => {
                    if (msg.reply_to) {
                      const el = document.getElementById(`msg-${msg.reply_to}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-brand-600/30");
                        setTimeout(
                          () => el.classList.remove("ring-2", "ring-brand-600/30"),
                          2000,
                        );
                      }
                    }
                  }}
                >
                  {/* Accent bar */}
                  <div className={`w-[3px] flex-shrink-0 ${isMe ? "bg-white/40" : "bg-brand-600/40"}`} />
                  {/* Reply content */}
                  <div className="flex-1 min-w-0 px-2.5 py-1.5">
                    <p
                      className={`text-[11px] font-semibold mb-0.5 ${
                        isMe ? "text-white/70" : "text-brand-600"
                      }`}
                    >
                      {msg.reply_sender || "Reply"}
                    </p>
                    <p
                      className={`text-[12px] leading-snug line-clamp-1 flex items-center gap-1 ${
                        isMe ? "text-white/50" : "text-muted-foreground/60"
                      }`}
                    >
                      {msg.reply_media_url && !msg.reply_preview?.replace("Media", "").trim() ? (
                        <>
                          {msg.reply_media_type === "voice" || msg.reply_media_type === "audio" ? (
                            <><Volume2 className="h-3 w-3 flex-shrink-0" /> Voice message</>
                          ) : msg.reply_media_type === "document" ? (
                            <><FileText className="h-3 w-3 flex-shrink-0" /> Document</>
                          ) : (
                            <><ImageIcon className="h-3 w-3 flex-shrink-0" /> Photo</>
                          )}
                        </>
                      ) : (
                        msg.reply_preview || "..."
                      )}
                    </p>
                  </div>
                  {/* Media thumbnail */}
                  {msg.reply_media_url && (!msg.reply_media_type || msg.reply_media_type === "image") && (
                    <div className="w-10 flex-shrink-0">
                      <img
                        src={mediaUrl(msg.reply_media_url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Text content */}
              {msg.content &&
                !msg.shared_post &&
                !(msg.shared_post?.type === "story") && (
                  <div className={`${hasReply ? "px-3 pt-0.5 pb-1.5" : "px-3 py-1.5"}`}>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {linkifyText(msg.content)}
                    </p>
                    {/* Inline timestamp */}
                    <div className={`flex items-center justify-end gap-1 mt-0.5 -mb-0.5 ${
                      isMe ? "text-white/40" : "text-muted-foreground/40"
                    }`}>
                      <span className="text-[10px]">{msgTime}</span>
                    </div>
                  </div>
                )}

              {/* Story reply card */}
              {msg.shared_post?.type === "story" && (
                <div className={`w-full overflow-hidden ${hasReply ? "px-1.5" : ""}`}>
                  <div className="relative w-full h-36 sm:h-40 rounded-xl overflow-hidden m-1.5">
                    {msg.shared_post.media_url ? (
                      <img
                        src={mediaUrl(msg.shared_post.media_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center p-4 bg-gradient-to-br ${
                          msg.shared_post.bg_color || "from-purple-500 to-pink-600"
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
                      <span className="text-[10px] font-semibold text-white/90 drop-shadow">
                        {isMe
                          ? `${msg.shared_post.user_name}'s story`
                          : "Your story"}
                      </span>
                    </div>
                  </div>
                  {msg.content && (
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words px-3 pb-1.5">
                      {linkifyText(msg.content)}
                    </p>
                  )}
                  <div className={`flex justify-end px-3 pb-1.5 ${
                    isMe ? "text-white/40" : "text-muted-foreground/40"
                  }`}>
                    <span className="text-[10px]">{msgTime}</span>
                  </div>
                </div>
              )}

              {/* Shared post card */}
              {msg.shared_post && msg.shared_post.type !== "story" && (
                <div className={hasReply ? "px-1.5 pb-1.5" : "p-1.5"}>
                  <button
                    onClick={() => onOpenSharedPost(msg.shared_post.id)}
                    className={`block w-full text-left rounded-xl overflow-hidden ${
                      isMe
                        ? "bg-black/15 hover:bg-black/25"
                        : "bg-secondary/40 hover:bg-secondary/60"
                    } active:scale-[0.98] transition-all`}
                  >
                    {msg.shared_post.media_url && (
                      <img
                        src={mediaUrl(msg.shared_post.media_url)}
                        alt=""
                        className="w-full h-28 sm:h-32 object-cover"
                      />
                    )}
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        {msg.shared_post.user_avatar ? (
                          <img
                            src={mediaUrl(msg.shared_post.user_avatar)}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 opacity-40" />
                        )}
                        <span className="text-[12px] font-semibold truncate">
                          {msg.shared_post.user_name}
                        </span>
                      </div>
                      {msg.shared_post.content && (
                        <p className="text-[12px] opacity-60 line-clamp-2 leading-snug">
                          {msg.shared_post.content}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className={`flex justify-end px-1 pt-0.5 ${
                    isMe ? "text-white/40" : "text-muted-foreground/40"
                  }`}>
                    <span className="text-[10px]">{msgTime}</span>
                  </div>
                </div>
              )}

              {/* Image */}
              {hasMedia && (!msg.media_type || msg.media_type === "image") && (
                <div className={isImageOnly ? "" : hasReply ? "px-1.5 pb-1.5" : "p-1.5"}>
                  <button
                    onClick={() => onOpenLightbox(mediaUrl(msg.media_url))}
                    aria-label="View image"
                    className={`block overflow-hidden ${
                      isImageOnly
                        ? "w-full max-w-[260px] sm:max-w-[300px]"
                        : "w-full rounded-xl"
                    }`}
                  >
                    <img
                      src={mediaUrl(msg.media_url)}
                      alt="Shared image"
                      className="w-full max-h-60 sm:max-h-72 object-cover hover:brightness-[1.02] transition-all"
                    />
                  </button>
                  {/* Timestamp overlay for image-only */}
                  {isImageOnly && (
                    <div className="absolute bottom-2 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-[10px] text-white/80">{msgTime}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Document */}
              {hasMedia && msg.media_type === "document" && (
                <div className={hasReply ? "px-1.5 pb-1.5" : "p-1.5"}>
                  <a
                    href={mediaUrl(msg.media_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                      isMe
                        ? "bg-white/10 hover:bg-white/15"
                        : "bg-secondary/40 hover:bg-secondary/60"
                    }`}
                  >
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isMe ? "bg-white/15" : "bg-brand-600/10"
                      }`}
                    >
                      <FileText
                        className={`h-5 w-5 ${isMe ? "text-white" : "text-brand-600"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">
                        {msg.file_name || "Document"}
                      </p>
                      <p className="text-[10px] opacity-50 mt-0.5">
                        Tap to open
                      </p>
                    </div>
                    <Download
                      className={`h-4 w-4 flex-shrink-0 opacity-30 ${isMe ? "text-white" : ""}`}
                    />
                  </a>
                  <div className={`flex justify-end px-1 pt-0.5 ${
                    isMe ? "text-white/40" : "text-muted-foreground/40"
                  }`}>
                    <span className="text-[10px]">{msgTime}</span>
                  </div>
                </div>
              )}

              {/* Voice / Audio */}
              {hasMedia &&
                (msg.media_type === "voice" || msg.media_type === "audio") && (
                  <div className={hasReply ? "px-1.5 pb-1.5" : "p-1.5"}>
                    <div
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl w-full min-w-[180px] max-w-[260px] ${
                        isMe ? "bg-white/10" : "bg-secondary/40"
                      }`}
                    >
                      <button
                        onClick={() =>
                          onTogglePlayAudio(msg.id, mediaUrl(msg.media_url))
                        }
                        aria-label={playingAudio === msg.id ? "Pause" : "Play"}
                        className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 ${
                          isMe
                            ? "bg-white/20 hover:bg-white/30"
                            : "bg-brand-600/10 hover:bg-brand-600/20"
                        }`}
                      >
                        {playingAudio === msg.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div
                          className={`h-1 rounded-full overflow-hidden ${
                            isMe ? "bg-white/20" : "bg-brand-600/15"
                          }`}
                        >
                          {playingAudio === msg.id && (
                            <motion.div
                              className={`h-full rounded-full origin-left ${
                                isMe ? "bg-white/60" : "bg-brand-600/50"
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
                        <div className={`flex items-center justify-between text-[10px] ${
                          isMe ? "text-white/40" : "text-muted-foreground/40"
                        }`}>
                          <span>
                            {msg.duration
                              ? `${Math.floor(msg.duration / 60)}:${String(msg.duration % 60).padStart(2, "0")}`
                              : "0:00"}
                          </span>
                          <span>{msgTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Timestamp for content-only messages without text (edge case) */}
              {!msg.content && !hasMedia && !msg.shared_post && !isDeleted && (
                <div className={`flex justify-end px-3 pb-1 ${
                  isMe ? "text-white/40" : "text-muted-foreground/40"
                }`}>
                  <span className="text-[10px]">{msgTime}</span>
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
