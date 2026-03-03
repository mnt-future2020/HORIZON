import React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  MessageCircle,
  User,
  Users,
  Inbox,
  CheckCheck,
  Flame,
  Compass,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";

const ConversationList = ({
  conversations,
  filteredConvos,
  convoSearch,
  onConvoSearchChange,
  onOpenNewChat,
  onOpenConversation,
  requestCount,
  onOpenRequests,
  onOpenDiscover,
  user,
  timeAgo,
  activeConvoId,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-4 sm:pt-5 pb-3">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h1 className="admin-page-title">Chats</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your sports network
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDiscover}
              aria-label="Discover groups"
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/40 text-muted-foreground hover:text-brand-600 hover:border-brand-600/40 hover:bg-brand-600/5 active:scale-95 transition-all"
            >
              <Compass className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={onOpenNewChat}
              aria-label="Start new chat"
              className="h-10 px-4 sm:px-5 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-xl flex items-center gap-2 shadow-md shadow-brand-600/20 transition-all border-t border-white/20 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-black uppercase tracking-widest text-[11px]">
                New
              </span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative group/search">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within/search:text-brand-600 transition-colors pointer-events-none" />
          <input
            type="search"
            placeholder="Search conversations…"
            value={convoSearch}
            onChange={(e) => onConvoSearchChange(e.target.value)}
            className="w-full h-10 sm:h-11 pl-10 pr-4 bg-secondary/30 border border-border/30 hover:border-brand-600/20 focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/10 rounded-2xl text-[13px] sm:text-[14px] placeholder:text-muted-foreground/35 outline-none transition-all"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 pr-1 sm:pr-2 pb-24 lg:pb-16">
        {/* Message Requests Banner */}
        {requestCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onOpenRequests}
            className="w-full flex items-center gap-3 p-3.5 sm:p-4 mb-3 rounded-2xl bg-brand-600/6 border border-brand-600/15 hover:bg-brand-600/10 active:bg-brand-600/15 transition-all text-left group"
          >
            <div className="h-11 w-11 rounded-2xl bg-brand-600/10 group-hover:bg-brand-600 flex items-center justify-center flex-shrink-0 transition-all">
              <Inbox className="h-5 w-5 text-brand-600 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[14px] sm:text-[15px] text-foreground">
                Message Requests
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {requestCount}{" "}
                {requestCount === 1 ? "person wants" : "people want"} to connect
              </p>
            </div>
            <span className="h-6 min-w-[24px] px-2 rounded-full bg-brand-600 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
              {requestCount > 99 ? "99+" : requestCount}
            </span>
          </motion.button>
        )}

        {/* Conversations (DM + Groups unified) */}
        {filteredConvos.length > 0 && (
          <div className="bg-card border border-border/30 rounded-2xl sm:rounded-3xl overflow-hidden divide-y divide-border/10 shadow-sm">
            {filteredConvos.map((convo, idx) => {
              const isActive = activeConvoId === convo.id;
              const hasUnread = convo.unread_count > 0;
              const isGroup = convo.type === "group";

              // Unified display fields
              const displayName = isGroup
                ? convo.name || convo.display_name || "Group"
                : convo.other_user?.name || convo.display_name || "Unknown";
              const displayAvatar = isGroup
                ? convo.avatar_url || convo.display_avatar
                : convo.other_user?.avatar || convo.display_avatar;
              const subtitle = isGroup
                ? `${convo.member_count || 0} members`
                : null;
              const streak = !isGroup ? (convo.other_user?.current_streak ?? 0) : 0;

              return (
                <motion.button
                  key={convo.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                  onClick={() => onOpenConversation(convo)}
                  className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all relative group touch-manipulation ${
                    isActive
                      ? "bg-brand-600/8"
                      : "hover:bg-secondary/40 active:bg-secondary/60"
                  }`}
                >
                  {/* Unread / active indicator */}
                  {(hasUnread || isActive) && (
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all ${
                        isActive ? "h-10 bg-brand-600" : "h-6 bg-brand-600/50"
                      }`}
                    />
                  )}

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`h-12 w-12 sm:h-13 sm:w-13 ${isGroup ? "rounded-xl" : "rounded-2xl"} bg-brand-600/10 overflow-hidden border transition-all ${
                        isActive
                          ? "border-brand-600/30"
                          : "border-border/30 group-hover:border-brand-600/20"
                      }`}
                    >
                      {displayAvatar ? (
                        <img
                          src={mediaUrl(displayAvatar)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          {isGroup ? (
                            <Users className="h-6 w-6 text-brand-600/50" />
                          ) : (
                            <User className="h-6 w-6 text-brand-600/50" />
                          )}
                        </div>
                      )}
                    </div>
                    {/* Group badge on avatar */}
                    {isGroup && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-md bg-brand-600/90 flex items-center justify-center border-2 border-card">
                        <Users className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                    {hasUnread && !isGroup && (
                      <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-card shadow-sm">
                        {convo.unread_count > 9 ? "9+" : convo.unread_count}
                      </span>
                    )}
                    {hasUnread && isGroup && (
                      <span className="absolute -top-1 -left-1 h-5 min-w-[20px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-card shadow-sm">
                        {convo.unread_count > 9 ? "9+" : convo.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className={`text-[14px] sm:text-[15px] truncate ${hasUnread ? "font-black text-foreground" : "font-semibold text-foreground/80"}`}
                        >
                          {displayName}
                        </span>
                        {streak > 0 && (
                          <span className="flex items-center gap-0.5 text-[#FF6B00] flex-shrink-0">
                            <Flame className="h-2.5 w-2.5 fill-[#FF6B00]/20" />
                            <span className="text-[9px] font-black">
                              {streak}
                            </span>
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold flex-shrink-0 uppercase tracking-wider ${hasUnread ? "text-brand-600" : "text-muted-foreground/50"}`}
                      >
                        {timeAgo(convo.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!isGroup && convo.last_message_by === user?.name && (
                        <CheckCheck
                          className={`h-3.5 w-3.5 flex-shrink-0 ${convo.read ? "text-blue-500" : "text-muted-foreground/30"}`}
                        />
                      )}
                      <p
                        className={`text-[12px] sm:text-[13px] truncate ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground/60"}`}
                      >
                        {isGroup && convo.last_message_by
                          ? `${convo.last_message_by}: ${convo.last_message || ""}`
                          : convo.last_message || (subtitle || "No messages yet")}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* No search results */}
        {filteredConvos.length === 0 && conversations.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-secondary/40 flex items-center justify-center mb-4">
              <Search className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground/60">
              No results for &ldquo;{convoSearch}&rdquo;
            </p>
            <p className="text-[11px] uppercase tracking-widest mt-1 opacity-40">
              Try a different name
            </p>
          </div>
        )}

        {/* Empty state */}
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-20 w-20 rounded-[30px] bg-brand-600/10 flex items-center justify-center mb-6 -rotate-6 border border-brand-600/15">
              <MessageCircle className="h-10 w-10 text-brand-600" />
            </div>
            <h3 className="text-xl font-black tracking-tight text-foreground mb-2">
              Your network is waiting
            </h3>
            <p className="text-[13px] text-muted-foreground/60 max-w-[200px] leading-relaxed mb-8">
              Connect with athletes to start chatting.
            </p>
            <button
              onClick={onOpenNewChat}
              className="h-11 px-6 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-brand-600/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Start a chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
