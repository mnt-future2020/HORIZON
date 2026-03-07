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
      return { text: "typing...", cls: "text-brand-600" };
    if (onlineStatus?.online)
      return { text: "online", cls: "text-emerald-500" };
    if (typeof lastSeenText === "function" && lastSeenText()) {
      return { text: lastSeenText(), cls: "text-muted-foreground/60" };
    }
    return null;
  };

  const status = getStatus();

  return (
    <header className="bg-card/95 backdrop-blur-xl border-b border-border/20 flex-shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-1 px-1.5 sm:px-2 h-[56px] sm:h-[60px]">
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="lg:hidden h-9 w-9 rounded-full flex items-center justify-center text-foreground hover:bg-secondary/50 active:scale-95 transition-all flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Profile info */}
        <button
          className="flex-1 min-w-0 flex items-center gap-2.5 py-1.5 px-1.5 rounded-xl hover:bg-secondary/30 active:bg-secondary/50 transition-colors text-left"
          onClick={() => navigate(`/player-card/${activeConvo.other_user?.id}`)}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-secondary/60 overflow-hidden">
              {activeConvo.other_user?.avatar ? (
                <img
                  src={mediaUrl(activeConvo.other_user.avatar)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-600/10 to-brand-600/5">
                  <User className="h-5 w-5 text-brand-600/60" />
                </div>
              )}
            </div>
            {onlineStatus?.online && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
            )}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-[15px] truncate text-foreground leading-tight">
                {activeConvo.other_user?.name || "Unknown"}
              </span>
              {(activeConvo.other_user?.current_streak ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-orange-500 flex-shrink-0">
                  <Flame className="h-3 w-3 fill-orange-500/30" />
                  <span className="text-[9px] font-bold">
                    {activeConvo.other_user.current_streak}
                  </span>
                </span>
              )}
            </div>
            {status && (
              <p className={`text-[12px] mt-0 leading-tight truncate ${status.cls}`}>
                {isTyping ? (
                  <span className="inline-flex items-center gap-1">
                    <span>typing</span>
                    <span className="inline-flex gap-[2px]">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="inline-block h-[3px] w-[3px] rounded-full bg-brand-600 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
                        />
                      ))}
                    </span>
                  </span>
                ) : (
                  status.text
                )}
              </p>
            )}
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onToggleSearch}
            aria-label={showMsgSearch ? "Close search" : "Search messages"}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              showMsgSearch
                ? "bg-brand-600/10 text-brand-600"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors active:scale-95"
            >
              {isMuted ? (
                <BellOff className="h-[18px] w-[18px] text-orange-400" />
              ) : (
                <Bell className="h-[18px] w-[18px]" />
              )}
            </button>
            <button
              onClick={onOpenPinned}
              aria-label="Pinned messages"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors active:scale-95"
            >
              <Pin className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={onOpenMedia}
              aria-label="Shared media"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors active:scale-95"
            >
              <ImageIcon className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* More menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="More options"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 transition-colors active:scale-95"
            >
              <MoreVertical className="h-[18px] w-[18px]" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border/30 rounded-xl shadow-xl z-[60] overflow-hidden py-1">
                {[
                  ...(window.innerWidth < 640
                    ? [
                        {
                          label: isMuted ? "Unmute" : "Mute",
                          icon: isMuted ? BellOff : Bell,
                          action: () => { onToggleMute(); setShowMoreMenu(false); },
                        },
                        {
                          label: "Pinned messages",
                          icon: Pin,
                          action: () => { onOpenPinned(); setShowMoreMenu(false); },
                        },
                        {
                          label: "Shared media",
                          icon: ImageIcon,
                          action: () => { onOpenMedia(); setShowMoreMenu(false); },
                        },
                      ]
                    : []),
                  {
                    label: "Clear chat",
                    icon: Eraser,
                    action: () => { onClearChat(); setShowMoreMenu(false); },
                    danger: true,
                  },
                ].map(({ label, icon: Icon, action, danger }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium text-left transition-colors touch-manipulation ${
                      danger
                        ? "text-red-500 hover:bg-red-500/8"
                        : "text-foreground/80 hover:bg-secondary/50"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${danger ? "text-red-400" : "text-muted-foreground/60"}`}
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
