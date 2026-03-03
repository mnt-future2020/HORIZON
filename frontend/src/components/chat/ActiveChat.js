import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  X,
  Eraser,
  ChevronDown,
  Search,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
      className="flex flex-col bg-background overflow-hidden relative z-50 h-full w-full transition-all duration-500 ease-in-out"
      style={{ touchAction: "manipulation" }}
    >
      {/* Background decoration following frontend-design skill */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none -z-10" />

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

      {/* Message Request Status Banner */}
      {activeConvo.status === "request" && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`px-4 py-3.5 flex-shrink-0 border-b border-border/20 relative z-40 shadow-inner ${
            activeConvo.requester_id === user?.id
              ? "bg-amber-600/5 border-amber-600/10"
              : "bg-brand-600/5 border-brand-600/10"
          }`}
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            {activeConvo.requester_id === user?.id ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-600 block uppercase tracking-widest">
                    Request Pending
                  </span>
                  <p className="text-[10px] text-amber-600/70 font-bold italic">
                    Waiting for recipient to accept
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-10 w-10 rounded-2xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-6 w-6 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] font-black text-foreground/90 block truncate leading-tight uppercase tracking-tight">
                      Access Request
                    </span>
                    <p className="text-[10px] text-muted-foreground font-bold truncate opacity-70 italic mt-0.5">
                      Accept to exchange messages with{" "}
                      {activeConvo.other_user?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-4 rounded-xl text-xs font-bold border-border/60 hover:bg-secondary/50 bg-white/5 active:scale-95 transition-all"
                    onClick={() => onDeclineRequest(activeConvo)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 px-5 rounded-xl text-xs font-black bg-brand-600 text-white hover:bg-brand-500 active:scale-95 transition-all"
                    onClick={() => onAcceptRequest(activeConvo)}
                  >
                    Accept
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-sm bg-card rounded-[32px] border border-border/40 p-8 shadow-sm overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
              <div className="h-16 w-16 rounded-[22px] bg-red-500/10 flex items-center justify-center mb-6 mx-auto group ring-4 ring-red-500/5 transition-all">
                <Eraser className="h-8 w-8 text-red-500 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="text-2xl font-black text-center text-foreground tracking-tighter mb-3">
                Clear chat history?
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-10 text-center font-medium opacity-80">
                This will delete every message in this conversation for{" "}
                <span className="text-red-500 font-bold">you only</span>. This
                action is final and permanent.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowClearConfirm(false)}
                  className="h-12 rounded-2xl font-bold border-border/60 hover:bg-secondary/50 bg-white/5 active:scale-[0.98] transition-all"
                >
                  Keep Chat
                </Button>
                <Button
                  onClick={onClearChat}
                  className="h-12 rounded-2xl font-black bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all uppercase tracking-widest text-[11px]"
                >
                  Clear All
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Search Bar */}
      <AnimatePresence>
        {showMsgSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card/90 backdrop-blur-xl border-b border-border/40 overflow-hidden relative z-40"
          >
            <div className="max-w-3xl mx-auto px-4 py-4 pb-1 flex flex-col gap-3">
              <div className="relative group/search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within/search:text-brand-600 transition-colors" />
                <Input
                  value={msgSearchQuery}
                  onChange={(e) => onMsgSearch(e.target.value)}
                  placeholder="Seach keywords in this chat..."
                  autoFocus
                  className="pl-12 h-11 bg-secondary/30 border-none rounded-2xl text-sm focus-visible:ring-offset-0 focus-visible:ring-brand-600/20"
                />
              </div>
              <AnimatePresence>
                {msgSearchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pb-4 max-h-[30vh] overflow-y-auto space-y-1 custom-scrollbar px-1"
                  >
                    {msgSearchResults.map((r, idx) => (
                      <motion.button
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="w-full text-left p-3.5 hover:bg-brand-600/5 rounded-[20px] transition-all flex flex-col border border-transparent hover:border-brand-600/10 group/item"
                        onClick={() => onScrollToMessage(r.id)}
                      >
                        <div className="flex items-center justify-between mb-1 opacity-60">
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                            {r.sender_name}
                          </span>
                          <span className="text-[9px] font-black">
                            {formatTime(r.created_at)}
                          </span>
                        </div>
                        <p className="text-[13px] font-medium truncate group-hover/item:text-foreground transition-colors">
                          {r.content}
                        </p>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden bg-dot-pattern">
        <div
          ref={msgContainerRef}
          onScroll={handleMsgScroll}
          className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 custom-scrollbar scroll-smooth"
          style={{ overscrollBehavior: "none" }}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-1">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em]">
                  Retreiving messages...
                </p>
              </div>
            ) : (
              groupedMessages.map((dateGroup, dgIdx) => (
                <div key={dateGroup.date} className="flex flex-col gap-1">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center my-8 sticky top-4 z-40 pointer-events-none"
                  >
                    <span className="px-4 py-1.5 rounded-full bg-secondary/80 backdrop-blur-md text-[10px] font-black text-muted-foreground/80 shadow-xl border border-white/5 uppercase tracking-widest pointer-events-auto">
                      {dateGroup.date}
                    </span>
                  </motion.div>
                  {dateGroup.messages.map((msg, mi) => {
                    const isMe = msg.sender_id === user?.id;
                    const prevMsg = mi > 0 ? dateGroup.messages[mi - 1] : null;
                    const showTail =
                      !prevMsg || prevMsg.sender_id !== msg.sender_id;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          ease: [0.22, 1, 0.36, 1],
                          delay: mi * 0.02 > 0.3 ? 0 : mi * 0.02,
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
            <div ref={messagesEndRef} className="h-0.5" />
          </div>
        </div>

        {/* FAB: Scroll to bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 20 }}
              onClick={scrollToBottom}
              className="absolute bottom-6 right-6 h-12 w-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-2xl shadow-brand-600/40 z-[45] active:scale-90 transition-all group"
            >
              <ArrowDown className="h-5 w-5 group-hover:translate-y-1 transition-transform" />
              {newMsgWhileAway > 0 && (
                <span className="absolute -top-1 -right-1 h-5.5 min-w-[22px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-lg animate-bounce border-2 border-white/10">
                  {newMsgWhileAway}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Input Area */}
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
    </div>
  );
};

export default ActiveChat;
