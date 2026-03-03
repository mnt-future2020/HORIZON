import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  User,
  Search,
  Pin,
  Image as ImageIcon,
  Bell,
  BellOff,
  Eraser,
  MoreVertical,
  Flame,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const ChatHeader = ({
  activeConvo,
  onBack,
  onlineStatus,
  isTyping,
  lastSeenText,
  onOpenPinned,
  onOpenMedia,
  isMuted,
  onToggleMute,
  showMsgSearch,
  onToggleSearch,
  onClearChat,
}) => {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const getStatus = () => {
    if (isTyping)
      return { text: "typing…", cls: "text-brand-600 animate-pulse" };
    if (onlineStatus?.online)
      return { text: "online", cls: "text-emerald-500" };
    if (typeof lastSeenText === "function" && lastSeenText()) {
      return { text: lastSeenText(), cls: "text-muted-foreground/60" };
    }
    return null;
  };

  const status = getStatus();

  const iconBtn =
    "h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0";

  return (
    <header className="bg-card/80 backdrop-blur-2xl border-b border-border/30 flex-shrink-0 sticky top-0 z-50 overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 h-px w-32 bg-gradient-to-l from-brand-600/40 to-transparent pointer-events-none" />

      <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 h-14 sm:h-16 max-w-5xl mx-auto">
        {/* Back button — visible on lg and below if chat is active */}
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className={`lg:hidden ${iconBtn} text-muted-foreground hover:text-foreground hover:bg-secondary/50`}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Profile info — tappable */}
        <button
          className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 py-1.5 px-1.5 sm:px-2 rounded-2xl hover:bg-secondary/30 active:bg-secondary/50 transition-all text-left group"
          onClick={() => navigate(`/player-card/${activeConvo.other_user?.id}`)}
        >
          {/* Avatar with online dot */}
          <div className="relative flex-shrink-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-[14px] bg-brand-600/10 overflow-hidden border border-border/40 group-hover:border-brand-600/30 transition-all">
              {activeConvo.other_user?.avatar ? (
                <img
                  src={mediaUrl(activeConvo.other_user.avatar)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-5 w-5 text-brand-600/60" />
                </div>
              )}
            </div>
            {onlineStatus?.online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
            )}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-black text-[14px] sm:text-[15px] truncate text-foreground group-hover:text-brand-600 transition-colors leading-none">
                {activeConvo.other_user?.name || "Unknown"}
              </span>
              {(activeConvo.other_user?.current_streak ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-[#FF6B00] flex-shrink-0">
                  <Flame className="h-3 w-3 fill-[#FF6B00]/20" />
                  <span className="text-[9px] font-black">
                    {activeConvo.other_user.current_streak}
                  </span>
                </span>
              )}
            </div>
            <p
              className={`text-[10px] sm:text-[11px] font-bold tracking-wide mt-0.5 truncate ${status ? status.cls : "text-muted-foreground/40 hidden sm:block"}`}
            >
              {status ? status.text : "tap for profile"}
            </p>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Search — always visible */}
          <button
            onClick={onToggleSearch}
            aria-label={showMsgSearch ? "Close search" : "Search messages"}
            className={`${iconBtn} ${showMsgSearch ? "bg-brand-600/15 text-brand-600" : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"}`}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mute — always visible */}
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className={`${iconBtn} text-muted-foreground/60 hover:bg-secondary/40`}
          >
            {isMuted ? (
              <BellOff className="h-4 w-4 text-orange-400" />
            ) : (
              <Bell className="h-4 w-4 hover:text-foreground" />
            )}
          </button>

          {/* Desktop extra actions */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={onOpenPinned}
              aria-label="Pinned messages"
              className={`${iconBtn} text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40`}
            >
              <Pin className="h-4 w-4" />
            </button>
            <button
              onClick={onOpenMedia}
              aria-label="Shared media"
              className={`${iconBtn} text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40`}
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onClearChat}
              aria-label="Clear chat"
              className={`${iconBtn} text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10`}
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile overflow menu */}
          <div className="sm:hidden relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="More options"
              className={`${iconBtn} text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border/40 rounded-2xl shadow-2xl z-[60] overflow-hidden py-1.5">
                {[
                  {
                    label: "Pinned messages",
                    icon: Pin,
                    action: () => {
                      onOpenPinned();
                      setShowMoreMenu(false);
                    },
                  },
                  {
                    label: "Shared media",
                    icon: ImageIcon,
                    action: () => {
                      onOpenMedia();
                      setShowMoreMenu(false);
                    },
                  },
                  {
                    label: "Clear chat",
                    icon: Eraser,
                    action: () => {
                      onClearChat();
                      setShowMoreMenu(false);
                    },
                    danger: true,
                  },
                ].map(({ label, icon: Icon, action, danger }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-semibold text-left transition-colors touch-manipulation ${
                      danger
                        ? "text-red-500 hover:bg-red-500/10 active:bg-red-500/20"
                        : "text-foreground/80 hover:bg-secondary/50 active:bg-secondary/70"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${danger ? "text-red-400" : "text-muted-foreground"}`}
                    />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
