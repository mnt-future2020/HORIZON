import React from "react";
import {
  ArrowLeft,
  User,
  Info,
  Search,
  Pin,
  Image as ImageIcon,
  Bell,
  BellOff,
  Eraser,
  MoreHorizontal,
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

  return (
    <div className="bg-card/70 backdrop-blur-3xl border-b border-border/40 px-3 py-3 flex-shrink-0 sticky top-0 z-50 overflow-hidden">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        {/* Decorative corner element */}
        <div className="absolute top-0 right-0 h-[2px] w-24 bg-gradient-to-l from-brand-600/30 to-transparent" />

        <button
          onClick={onBack}
          className="md:hidden text-muted-foreground hover:text-foreground p-2.5 rounded-2xl hover:bg-secondary/40 transition-all flex-shrink-0 cursor-pointer active:scale-95 border border-transparent hover:border-border/40"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div
          className="relative flex items-center gap-3.5 flex-1 min-w-0 py-1.5 cursor-pointer hover:bg-secondary/30 rounded-[20px] px-2.5 transition-all group"
          onClick={() => navigate(`/player-card/${activeConvo.other_user?.id}`)}
        >
          <div className="relative">
            <div className="h-11 w-11 min-w-[44px] rounded-[20px] bg-brand-600/10 flex items-center justify-center overflow-hidden border border-border/50 group-hover:border-brand-600/40 transition-all">
              {activeConvo.other_user?.avatar ? (
                <img
                  src={mediaUrl(activeConvo.other_user.avatar)}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-110 duration-500"
                />
              ) : (
                <User className="h-6 w-6 text-brand-600" />
              )}
            </div>
            {onlineStatus?.online && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card shadow-sm animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-black text-[15px] truncate text-foreground tracking-tight leading-none group-hover:text-brand-600 transition-colors">
                {activeConvo.other_user?.name || "Unknown"}
              </h2>
              {activeConvo.other_user?.current_streak > 0 && (
                <div className="flex items-center gap-0.5 text-[#FF6B00] flex-shrink-0 animate-pulse-slow">
                  <Flame className="h-3.5 w-3.5 fill-[#FF6B00]/20" />
                  <span className="text-[10px] font-black">
                    {activeConvo.other_user.current_streak}
                  </span>
                </div>
              )}
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5 mt-1 opacity-70">
              {isTyping ? (
                <span className="text-brand-600 animate-pulse">typing...</span>
              ) : onlineStatus?.online ? (
                <span className="text-green-500 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm" />{" "}
                  online
                </span>
              ) : typeof lastSeenText === "function" && lastSeenText() ? (
                <span className="text-muted-foreground">{lastSeenText()}</span>
              ) : (
                <span className="text-muted-foreground/60 flex items-center gap-1 opacity-50">
                  <Info className="h-2.5 w-2.5" /> tap for profile
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Modern Desktop Actions */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={onOpenPinned}
              className="p-2.5 rounded-2xl hover:bg-secondary/40 text-foreground/50 hover:text-foreground transition-all flex-shrink-0 cursor-pointer border border-transparent hover:border-border/20"
              title="Pinned"
            >
              <Pin className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={onOpenMedia}
              className="p-2.5 rounded-2xl hover:bg-secondary/40 text-foreground/50 hover:text-foreground transition-all flex-shrink-0 cursor-pointer border border-transparent hover:border-border/20"
              title="Media"
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-2xl hover:bg-secondary/40 flex-shrink-0 cursor-pointer transition-all border border-transparent hover:border-border/20"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <BellOff className="h-4 w-4 text-orange-400" aria-hidden="true" />
            ) : (
              <Bell
                className="h-4 w-4 text-foreground/50 hover:text-foreground"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            onClick={onToggleSearch}
            className={`p-2.5 rounded-2xl hover:bg-secondary/40 transition-all flex-shrink-0 cursor-pointer border border-transparent ${showMsgSearch ? "bg-secondary/60 text-brand-600 border-brand-600/20" : "text-foreground/50 hover:text-foreground"}`}
            title="Search"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            onClick={onClearChat}
            className="p-2.5 rounded-2xl hover:bg-red-500/10 text-foreground/40 hover:text-red-500 transition-all flex-shrink-0 cursor-pointer border border-transparent"
            title="Clear Chat"
          >
            <Eraser className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
