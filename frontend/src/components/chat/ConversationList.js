import React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  MessageCircle,
  User,
  Inbox,
  CheckCheck,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  user,
  timeAgo,
  activeConvoId,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground bg-clip-text">
            Chats
          </h1>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-60">
            Your sports network
          </p>
        </div>
        <Button
          size="sm"
          onClick={onOpenNewChat}
          className="h-11 px-5 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-2xl active:scale-[0.98] transition-all flex items-center gap-2 group"
        >
          <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-bold">New Chat</span>
        </Button>
      </div>

      {/* Search conversations */}
      <div className="relative mb-6 group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-foreground/30 group-focus-within:text-brand-600 transition-colors" />
        </div>
        <Input
          placeholder="Find players or conversations..."
          className="pl-12 h-14 bg-card border-border/40 hover:border-brand-600/30 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/5 rounded-[22px] text-sm transition-all shadow-sm"
          value={convoSearch}
          onChange={(e) => onConvoSearchChange(e.target.value)}
        />
      </div>

      {/* Message Requests Banner */}
      {requestCount > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onOpenRequests}
          className="w-full flex items-center gap-4 p-5 mb-8 rounded-[32px] bg-brand-600/5 border border-brand-600/10 hover:bg-brand-600/10 transition-all text-left group cursor-pointer active:scale-[0.99]"
        >
          <div className="h-14 w-14 rounded-3xl bg-brand-600/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white transition-all">
            <Inbox className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-black text-[16px] text-foreground tracking-tight block">
              Message Requests
            </span>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 opacity-80">
              {requestCount} {requestCount === 1 ? "person" : "people"} want to
              connect
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-8 min-w-[32px] px-2.5 rounded-full bg-brand-600 text-white text-[13px] font-black flex items-center justify-center">
              {requestCount}
            </span>
          </div>
        </motion.button>
      )}

      {/* Conversation List */}
      <div className="bg-card border border-border/40 rounded-[32px] overflow-hidden shadow-sm">
        <div className="divide-y divide-border/5">
          {filteredConvos.map((convo, idx) => (
            <motion.button
              key={convo.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.3 }}
              onClick={() => onOpenConversation(convo)}
              className={`w-full flex items-center gap-4 p-5 transition-all text-left cursor-pointer group relative overflow-hidden
                ${activeConvoId === convo.id ? "bg-brand-600/[0.08] shadow-inner" : "hover:bg-secondary/40 active:bg-secondary/60"}
              `}
            >
              {/* Active/Unread indicator bar */}
              {(convo.unread_count > 0 || activeConvoId === convo.id) && (
                <div
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full transition-all duration-300
                    ${activeConvoId === convo.id ? "bg-brand-600 scale-y-110" : "bg-brand-600/50"}
                  `}
                />
              )}

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl bg-brand-600/10 flex items-center justify-center overflow-hidden border border-border/50 group-hover:border-brand-600/30 transition-all shadow-sm">
                  {convo.other_user?.avatar ? (
                    <img
                      src={mediaUrl(convo.other_user.avatar)}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-110 duration-500"
                    />
                  ) : (
                    <User className="h-7 w-7 text-brand-600" />
                  )}
                </div>
                {convo.unread_count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-6 min-w-[24px] px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-black flex items-center justify-center shadow-lg shadow-brand-600/30 border-2 border-card">
                    {convo.unread_count > 9 ? "9+" : convo.unread_count}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[16px] truncate tracking-tight transition-colors ${convo.unread_count > 0 ? "font-black text-foreground" : "font-bold text-foreground/80 group-hover:text-foreground"}`}
                    >
                      {convo.other_user?.name || "Unknown"}
                    </span>
                    {convo.other_user?.current_streak > 0 && (
                      <div className="flex items-center gap-0.5 text-[#FF6B00] flex-shrink-0 animate-pulse-slow">
                        <Flame className="h-3 w-3 fill-[#FF6B00]/20" />
                        <span className="text-[10px] font-black">
                          {convo.other_user.current_streak}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-black flex-shrink-0 ml-2 uppercase tracking-[0.1em] transition-all ${convo.unread_count > 0 ? "text-brand-600 opacity-100" : "text-muted-foreground/60 group-hover:opacity-100"}`}
                  >
                    {timeAgo(convo.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {convo.last_message_by === user?.name && (
                    <CheckCheck
                      className={`h-4 w-4 flex-shrink-0 transition-colors ${convo.read ? "text-blue-500" : "text-muted-foreground/30"}`}
                    />
                  )}
                  <p
                    className={`text-sm truncate leading-tight transition-colors ${convo.unread_count > 0 ? "text-foreground font-semibold" : "text-muted-foreground/70 group-hover:text-muted-foreground/90 whitespace-pre-wrap"}`}
                  >
                    {convo.last_message || "No messages yet"}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {filteredConvos.length === 0 && conversations.length > 0 && (
        <div className="text-center py-20 bg-secondary/10 rounded-[32px] mt-8 border-2 border-dashed border-border/40">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-sm font-bold text-muted-foreground">
            No matches for "{convoSearch}"
          </p>
          <p className="text-[11px] uppercase tracking-widest mt-1 opacity-50">
            Try a different name
          </p>
        </div>
      )}

      {conversations.length === 0 && (
        <div className="text-center py-28 relative">
          <div className="absolute inset-0 bg-gradient-radial from-brand-600/5 to-transparent blur-3xl" />
          <div className="relative z-10">
            <div className="h-24 w-24 rounded-[40px] bg-brand-600/10 flex items-center justify-center mx-auto mb-6 transform -rotate-12 border border-brand-600/20 shadow-inner">
              <MessageCircle className="h-12 w-12 text-brand-600" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-3 tracking-tighter">
              Your network is waiting
            </h3>
            <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto mb-10 font-medium">
              Connect with athletes, scouts, and friends to start the
              conversation.
            </p>
            <Button
              onClick={onOpenNewChat}
              className="h-14 px-8 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-[24px] shadow-2xl shadow-brand-600/30 active:scale-[0.98] transition-all flex items-center font-black uppercase text-[12px] tracking-widest"
            >
              <Plus className="h-5 w-5 mr-3" /> Start a Conversation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
