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
  Image as ImageIcon,
  Mic,
  Clock,
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
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Chats</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenDiscover}
              aria-label="Discover groups"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand-600 hover:bg-brand-600/8 active:scale-95 transition-all"
            >
              <Compass className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={onOpenNewChat}
              aria-label="Start new chat"
              className="h-9 w-9 rounded-full flex items-center justify-center bg-brand-600 text-white hover:bg-brand-500 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
          <input
            type="search"
            placeholder="Search"
            value={convoSearch}
            onChange={(e) => onConvoSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-secondary/40 border-none rounded-lg text-[13px] placeholder:text-muted-foreground/40 outline-none focus:bg-secondary/60 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24 lg:pb-4">
        {/* Message Requests Banner */}
        {requestCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onOpenRequests}
            className="w-full flex items-center gap-3 px-3 py-3 mb-1.5 rounded-xl bg-gradient-to-r from-brand-600/8 to-transparent hover:from-brand-600/12 active:from-brand-600/16 transition-all text-left border border-brand-600/10"
          >
            <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/5 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-5 w-5 text-brand-600" />
              <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                {requestCount > 99 ? "99+" : requestCount}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground">
                Message Requests
              </p>
              <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                {requestCount} pending {requestCount === 1 ? "request" : "requests"} — tap to review
              </p>
            </div>
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </motion.button>
        )}

        {/* Conversations */}
        {filteredConvos.length > 0 && (() => {
          const activeConvos = filteredConvos.filter((c) => c.status !== "request");
          const requestConvos = filteredConvos.filter((c) => c.status === "request");

          const renderConvo = (convo) => {
            const isActive = activeConvoId === convo.id;
            const hasUnread = convo.unread_count > 0;
            const isGroup = convo.type === "group";

            const displayName = isGroup
              ? convo.name || convo.display_name || "Group"
              : convo.other_user?.name || convo.display_name || "Unknown";
            const displayAvatar = isGroup
              ? convo.avatar_url || convo.display_avatar
              : convo.other_user?.avatar || convo.display_avatar;
            const streak = !isGroup ? (convo.other_user?.current_streak ?? 0) : 0;

            const isRequest = convo.status === "request";

            // Last message preview
            let lastMsg = convo.last_message || "";
            if (isGroup && convo.last_message_by) {
              lastMsg = `${convo.last_message_by}: ${lastMsg}`;
            }
            if (!lastMsg) {
              lastMsg = isRequest
                ? "Message request"
                : isGroup ? `${convo.member_count || 0} members` : "Start a conversation";
            }

            // Detect media-only last message
            const isMediaMsg = lastMsg === "[media]" || lastMsg === "[image]" || lastMsg === "[voice]";

            return (
              <button
                key={convo.id}
                onClick={() => onOpenConversation(convo)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all touch-manipulation ${
                  isActive
                    ? "bg-brand-600/8"
                    : "hover:bg-secondary/40 active:bg-secondary/60"
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-secondary/60 overflow-hidden">
                    {displayAvatar ? (
                      <img
                        src={mediaUrl(displayAvatar)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-600/10 to-brand-600/5">
                        {isGroup ? (
                          <Users className="h-5 w-5 text-brand-600/60" />
                        ) : (
                          <User className="h-5 w-5 text-brand-600/60" />
                        )}
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  {!isGroup && convo.other_user?.is_online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                  )}
                  {/* Group badge */}
                  {isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full bg-brand-600 flex items-center justify-center border-2 border-background">
                      <Users className="h-2 w-2 text-white" />
                    </span>
                  )}
                  {/* Request pending badge */}
                  {isRequest && !isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full bg-amber-500 flex items-center justify-center border-2 border-background">
                      <Clock className="h-2 w-2 text-white" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`text-[14px] truncate leading-tight ${
                          hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/90"
                        }`}
                      >
                        {displayName}
                      </span>
                      {streak > 0 && (
                        <span className="flex items-center gap-0.5 text-orange-500 flex-shrink-0">
                          <Flame className="h-2.5 w-2.5 fill-orange-500/30" />
                          <span className="text-[9px] font-bold">{streak}</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] flex-shrink-0 ${
                        hasUnread ? "text-brand-600 font-semibold" : "text-muted-foreground/50"
                      }`}
                    >
                      {timeAgo(convo.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {!isGroup && convo.last_message_by === user?.name && (
                        <CheckCheck
                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                            convo.read ? "text-blue-500" : "text-muted-foreground/30"
                          }`}
                        />
                      )}
                      <p
                        className={`text-[13px] truncate leading-tight ${
                          hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground/50"
                        }`}
                      >
                        {isMediaMsg ? (
                          <span className="flex items-center gap-1">
                            {lastMsg === "[voice]" ? (
                              <Mic className="h-3 w-3 inline" />
                            ) : (
                              <ImageIcon className="h-3 w-3 inline" />
                            )}
                            {lastMsg === "[voice]" ? "Voice message" : "Photo"}
                          </span>
                        ) : (
                          lastMsg
                        )}
                      </p>
                    </div>
                    {/* Unread badge */}
                    {hasUnread && (
                      <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {convo.unread_count > 99 ? "99+" : convo.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          };

          return (
            <div className="flex flex-col">
              {activeConvos.map(renderConvo)}
              {requestConvos.length > 0 && (
                <>
                  <div className="flex items-center gap-2.5 px-3 pt-4 pb-1.5">
                    <div className="flex-1 h-px bg-border/20" />
                    <span className="text-[11px] font-medium text-muted-foreground/40 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending Requests
                    </span>
                    <div className="flex-1 h-px bg-border/20" />
                  </div>
                  {requestConvos.map(renderConvo)}
                </>
              )}
            </div>
          );
        })()}

        {/* No search results */}
        {filteredConvos.length === 0 && conversations.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-secondary/40 flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/60">
              No results for "{convoSearch}"
            </p>
          </div>
        )}

        {/* Empty state */}
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="h-16 w-16 rounded-full bg-brand-600/10 flex items-center justify-center mb-5">
              <MessageCircle className="h-8 w-8 text-brand-600" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1.5">
              No conversations yet
            </h3>
            <p className="text-[13px] text-muted-foreground/60 max-w-[220px] leading-relaxed mb-6">
              Start chatting with athletes and groups.
            </p>
            <button
              onClick={onOpenNewChat}
              className="h-10 px-6 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-full text-[13px] font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
