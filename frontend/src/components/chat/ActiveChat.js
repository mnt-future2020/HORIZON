import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  X,
  Eraser,
  Search,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

const ActiveChat = ({
  activeConvo,
  onBack,
  onlineStatus,
  isTyping,
  lastSeenText,
  messages,
  groupedMessages,
  user,
  onSend,
  msgText,
  onMsgTextChange,
  onTyping,
  sending,
  loadingMessages,
  onAcceptRequest,
  onDeclineRequest,
  onToggleMute,
  isMuted,
  showClearConfirm,
  setShowClearConfirm,
  onClearChat,
  onOpenPinned,
  onOpenMedia,
  showMsgSearch,
  onToggleSearch,
  msgSearchQuery,
  onMsgSearch,
  msgSearchResults,
  onScrollToMessage,
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
  formatTime,
  replyTo,
  onCancelReply,
  pendingFile,
  onCancelFile,
  onFileSelect,
  isRecording,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  showEmojiPicker,
  onToggleEmojiPicker,
  emojiPickerRef,
  onAddEmoji,
  inputRef,
  msgContainerRef,
  messagesEndRef,
  handleMsgScroll,
  showScrollBtn,
  newMsgWhileAway,
  scrollToBottom,
}) => {
  return (
    <div
      className="flex flex-col bg-background overflow-hidden h-full w-full min-h-0"
      style={{ touchAction: "manipulation" }}
    >
      {/* Subtle background */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/4 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-0 w-64 h-64 bg-blue-600/3 rounded-full blur-[80px] pointer-events-none -z-10" />

      {/* ── Header ─────────────────────────────────────────── */}
      <ChatHeader
        activeConvo={activeConvo}
        onBack={onBack}
        onlineStatus={onlineStatus}
        isTyping={isTyping}
        lastSeenText={lastSeenText}
        onOpenPinned={onOpenPinned}
        onOpenMedia={onOpenMedia}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        showMsgSearch={showMsgSearch}
        onToggleSearch={onToggleSearch}
        onClearChat={() => setShowClearConfirm(true)}
      />

      {/* ── Request Banner ──────────────────────────────────── */}
      {activeConvo.status === "request" && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`flex-shrink-0 px-3 sm:px-4 py-3 border-b border-border/20 ${
            activeConvo.requester_id === user?.id
              ? "bg-amber-500/5 border-amber-500/10"
              : "bg-brand-600/5 border-brand-600/10"
          }`}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {activeConvo.requester_id === user?.id ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest">
                    Request Pending
                  </p>
                  <p className="text-[10px] text-amber-600/60 italic mt-0.5">
                    Waiting for them to accept
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-8 w-8 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-4.5 w-4.5 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-foreground/90 uppercase tracking-tight">
                      Access Request
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 truncate italic mt-0.5">
                      Accept to chat with {activeConvo.other_user?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onDeclineRequest(activeConvo)}
                    className="h-8 px-3 rounded-xl text-[11px] font-bold border border-border/50 bg-secondary/20 hover:bg-secondary/40 active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => onAcceptRequest(activeConvo)}
                    className="h-8 px-4 rounded-xl text-[11px] font-black bg-brand-600 text-white hover:bg-brand-500 active:scale-95 transition-all shadow-sm"
                  >
                    Accept
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Message Search Bar ──────────────────────────────── */}
      <AnimatePresence>
        {showMsgSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 bg-card/95 backdrop-blur-xl border-b border-border/30 overflow-hidden"
          >
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <Input
                  value={msgSearchQuery}
                  onChange={(e) => onMsgSearch(e.target.value)}
                  placeholder="Search in this chat…"
                  autoFocus
                  className="pl-10 h-10 bg-secondary/30 border-none rounded-2xl text-[13px] focus-visible:ring-brand-600/20"
                />
              </div>
              {msgSearchResults.length > 0 && (
                <div className="max-h-[28vh] overflow-y-auto space-y-0.5 pb-2 custom-scrollbar">
                  {msgSearchResults.map((r, idx) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="w-full text-left p-3 hover:bg-brand-600/5 active:bg-brand-600/10 rounded-xl transition-all"
                      onClick={() => onScrollToMessage(r.id)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600 opacity-70">
                          {r.sender_name}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 font-medium">
                          {formatTime(r.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] font-medium truncate text-foreground/70">
                        {r.content}
                      </p>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages Area ────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <div
          ref={msgContainerRef}
          onScroll={handleMsgScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col gap-0">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Loading messages…
                </p>
              </div>
            ) : (
              groupedMessages.map((dateGroup) => (
                <div key={dateGroup.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-6 sticky top-3 z-20 pointer-events-none">
                    <span className="px-4 py-1 rounded-full bg-secondary/70 backdrop-blur-md text-[10px] font-bold text-muted-foreground/70 shadow-sm border border-border/20 uppercase tracking-widest pointer-events-auto">
                      {dateGroup.date}
                    </span>
                  </div>

                  {dateGroup.messages.map((msg, mi) => {
                    const isMe = msg.sender_id === user?.id;
                    const prevMsg = mi > 0 ? dateGroup.messages[mi - 1] : null;
                    const showTail =
                      !prevMsg || prevMsg.sender_id !== msg.sender_id;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.22, 1, 0.36, 1],
                          delay: Math.min(mi * 0.015, 0.25),
                        }}
                      >
                        <MessageBubble
                          msg={msg}
                          isMe={isMe}
                          showTail={showTail}
                          onLongPress={onLongPress}
                          onReaction={onReaction}
                          onReply={onReply}
                          onDelete={onDelete}
                          onPin={onPin}
                          onForward={onForward}
                          onOpenSharedPost={onOpenSharedPost}
                          onOpenLightbox={onOpenLightbox}
                          onTogglePlayAudio={onTogglePlayAudio}
                          playingAudio={playingAudio}
                          linkifyText={linkifyText}
                          user={user}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ))
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="flex justify-start px-1 mt-1.5"
                >
                  <div className="px-4 py-3 rounded-[20px] rounded-bl-[5px] bg-card border border-border/40 shadow-sm">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                          animate={{
                            scale: [1, 1.4, 1],
                            opacity: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-1" aria-hidden="true" />
          </div>
        </div>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={scrollToBottom}
              aria-label="Scroll to latest messages"
              className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-xl shadow-brand-600/30 z-[45] active:scale-90 transition-transform"
            >
              <ArrowDown className="h-5 w-5" />
              {newMsgWhileAway > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white/10 shadow-md">
                  {newMsgWhileAway}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input ────────────────────────────────────────────── */}
      <MessageInput
        msgText={msgText}
        onMsgTextChange={onMsgTextChange}
        onSend={onSend}
        onTyping={onTyping}
        sending={sending}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
        pendingFile={pendingFile}
        onCancelFile={onCancelFile}
        onFileSelect={onFileSelect}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onCancelRecording={onCancelRecording}
        showEmojiPicker={showEmojiPicker}
        onToggleEmojiPicker={onToggleEmojiPicker}
        emojiPickerRef={emojiPickerRef}
        onAddEmoji={onAddEmoji}
        inputRef={inputRef}
      />

      {/* ── Clear Chat Confirm Modal ─────────────────────────── */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-full max-w-sm bg-card rounded-3xl border border-border/40 p-7 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5 ring-4 ring-red-500/5">
                <Eraser className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-center tracking-tight mb-2">
                Clear chat history?
              </h3>
              <p className="text-[13px] text-muted-foreground/70 text-center leading-relaxed mb-7">
                All messages will be permanently removed. This cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="h-11 rounded-2xl font-bold text-[13px] border border-border/50 bg-secondary/20 hover:bg-secondary/40 active:scale-95 transition-all"
                >
                  Keep chat
                </button>
                <button
                  onClick={onClearChat}
                  className="h-11 rounded-2xl font-black text-[12px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all"
                >
                  Clear all
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActiveChat;
