import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  Eraser,
  Search,
  ArrowDown,
  Clock,
} from "lucide-react";
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
  messages: _messages,
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
      {/* Header */}
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

      {/* Request Banner */}
      {activeConvo.status === "request" && (
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex-shrink-0 border-b border-border/15"
        >
          {activeConvo.requester_id === user?.id ? (
            /* I sent the request — pending state */
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-amber-600">
                    Request Pending
                  </p>
                  <p className="text-[11px] text-amber-600/50 mt-0.5 leading-snug">
                    Waiting for {activeConvo.other_user?.name || "them"} to accept your message request
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                </div>
              </div>
            </div>
          ) : (
            /* They sent me a request — accept/decline */
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3">
              <div className="p-3 rounded-xl bg-brand-600/5 border border-brand-600/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">
                      Message Request
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">
                      <span className="font-medium text-foreground/70">{activeConvo.other_user?.name}</span> wants to send you a message
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAcceptRequest(activeConvo)}
                    className="flex-1 h-9 rounded-full text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => onDeclineRequest(activeConvo)}
                    className="flex-1 h-9 rounded-full text-[13px] font-medium border border-border/40 text-muted-foreground hover:bg-secondary/40 active:scale-[0.98] transition-all"
                  >
                    Decline
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/40 text-center mt-2 leading-relaxed">
                  If you accept, they'll be able to message you directly
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Message Search */}
      <AnimatePresence>
        {showMsgSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0 bg-card/95 backdrop-blur-xl border-b border-border/15 overflow-hidden"
          >
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col gap-1.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <Input
                  value={msgSearchQuery}
                  onChange={(e) => onMsgSearch(e.target.value)}
                  placeholder="Search in conversation..."
                  autoFocus
                  className="pl-9 h-9 bg-secondary/30 border-none rounded-lg text-[13px] focus-visible:ring-brand-600/15"
                />
              </div>
              {msgSearchResults.length > 0 && (
                <div className="max-h-[28vh] overflow-y-auto space-y-0.5 custom-scrollbar">
                  {msgSearchResults.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left p-2.5 hover:bg-secondary/40 active:bg-secondary/60 rounded-lg transition-colors"
                      onClick={() => onScrollToMessage(r.id)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-brand-600">
                          {r.sender_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">
                          {formatTime(r.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] truncate text-foreground/60">
                        {r.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
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
          <div className="max-w-5xl mx-auto px-1 sm:px-2 py-3 flex flex-col gap-0">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 opacity-40">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                <p className="text-[12px] text-muted-foreground">
                  Loading messages...
                </p>
              </div>
            ) : (
              groupedMessages.map((dateGroup) => (
                <div key={dateGroup.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4 sticky top-2 z-20 pointer-events-none">
                    <span className="px-3 py-1 rounded-lg bg-card/90 backdrop-blur-sm text-[11px] font-medium text-muted-foreground/60 shadow-sm border border-border/10 pointer-events-auto">
                      {dateGroup.date}
                    </span>
                  </div>

                  {dateGroup.messages.map((msg, mi) => {
                    const isMe = msg.sender_id === user?.id;
                    const prevMsg = mi > 0 ? dateGroup.messages[mi - 1] : null;
                    const showTail =
                      !prevMsg || prevMsg.sender_id !== msg.sender_id;

                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMe={isMe}
                        showTail={showTail}
                        onLongPress={onLongPress}
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
                    );
                  })}
                </div>
              ))
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex justify-start px-3 mt-1"
                >
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-[4px] bg-card border border-border/20">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.3, 0.8, 0.3],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.15,
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
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={scrollToBottom}
              aria-label="Scroll to latest messages"
              className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card border border-border/30 text-foreground flex items-center justify-center shadow-lg z-[45] active:scale-90 transition-transform hover:bg-secondary/40"
            >
              <ArrowDown className="h-4 w-4" />
              {newMsgWhileAway > 0 && (
                <span className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
                  {newMsgWhileAway}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
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

      {/* Clear Chat Confirm */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-card rounded-2xl border border-border/30 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Eraser className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-center mb-1.5">
                Clear chat history?
              </h3>
              <p className="text-[13px] text-muted-foreground/60 text-center leading-relaxed mb-6">
                All messages will be permanently removed.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="h-10 rounded-xl font-medium text-[13px] border border-border/40 hover:bg-secondary/40 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onClearChat}
                  className="h-10 rounded-xl font-semibold text-[13px] bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all"
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
