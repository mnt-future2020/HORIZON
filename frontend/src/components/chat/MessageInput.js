import React, { useRef, useCallback } from "react";
import { Mic, Send, X, Smile, Paperclip, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MessageInput = ({
  msgText,
  onMsgTextChange,
  onSend,
  onTyping,
  sending,
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
}) => {
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasContent = msgText.trim() || pendingFile;

  return (
    <div
      className="flex-shrink-0 bg-card/70 backdrop-blur-2xl border-t border-border/20"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="max-w-5xl mx-auto px-2 sm:px-3 pt-2 sm:pt-3 pb-2">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 bg-brand-600/6 border border-brand-600/12 rounded-2xl px-3 py-2.5 mb-2">
                <div className="w-0.5 h-8 rounded-full bg-brand-600/60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest opacity-80">
                    {replyTo.sender_name}
                  </p>
                  <p className="text-[13px] text-foreground/70 truncate italic mt-0.5">
                    {replyTo.content || "Media"}
                  </p>
                </div>
                <button
                  onClick={onCancelReply}
                  aria-label="Cancel reply"
                  className="flex-shrink-0 h-7 w-7 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-all active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File preview */}
        <AnimatePresence>
          {pendingFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 bg-secondary/20 border border-border/20 rounded-2xl px-3 py-2.5 mb-2">
                <div className="h-9 w-9 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
                  <Paperclip className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Ready to send
                  </p>
                  <p className="text-[13px] font-semibold truncate text-foreground/80 mt-0.5">
                    {pendingFile.name}
                  </p>
                </div>
                <button
                  onClick={onCancelFile}
                  aria-label="Remove file"
                  className="flex-shrink-0 h-7 w-7 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-all active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording UI — replaces normal input */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-3 bg-brand-600 text-white rounded-2xl px-4 py-3"
            >
              {/* Pulse dot + timer */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse flex-shrink-0" />
                <span className="font-black tabular-nums text-sm tracking-widest">
                  {formatDuration(recordingDuration)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 hidden sm:block">
                  Recording…
                </span>
              </div>
              {/* Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={onCancelRecording}
                  aria-label="Discard recording"
                  className="h-9 w-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 active:scale-90 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onStopRecording}
                  aria-label="Send recording"
                  className="h-9 px-5 rounded-full bg-white text-brand-600 font-black text-[12px] uppercase tracking-widest flex items-center gap-2 hover:bg-white/90 active:scale-95 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Normal input row */}
        {!isRecording && (
          <div className="flex items-end gap-1.5 sm:gap-2">
            {/* Attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              className="flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-border/20 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground active:scale-90 transition-all flex items-center justify-center group mb-0.5"
            >
              <Paperclip className="h-4.5 w-4.5 group-hover:-rotate-12 transition-transform" />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileSelect}
              />
            </button>

            {/* Text area wrapper */}
            <div className="flex-1 min-w-0 flex items-end bg-secondary/15 border border-border/15 hover:border-brand-600/25 focus-within:border-brand-600/50 focus-within:ring-2 focus-within:ring-brand-600/10 rounded-[20px] transition-all shadow-sm overflow-hidden">
              {/* Emoji */}
              <button
                onClick={onToggleEmojiPicker}
                aria-label="Emoji picker"
                type="button"
                className={`flex-shrink-0 h-10 sm:h-11 w-10 sm:w-11 flex items-center justify-center transition-all rounded-full ${
                  showEmojiPicker
                    ? "text-brand-600"
                    : "text-muted-foreground/50 hover:text-brand-600"
                }`}
              >
                <Smile className="h-5 w-5" />
              </button>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={msgText}
                onChange={(e) => {
                  onMsgTextChange(e.target.value);
                  onTyping();
                  autoResize(e.target);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                aria-label="Message input"
                rows={1}
                className="flex-1 min-w-0 bg-transparent border-none outline-none resize-none text-[14px] sm:text-[15px] placeholder:text-muted-foreground/35 py-3 pr-2 leading-snug font-medium max-h-[140px] overflow-y-auto touch-manipulation"
                style={{ height: "auto" }}
              />
            </div>

            {/* Voice / Send */}
            {!hasContent ? (
              <button
                onClick={onStartRecording}
                aria-label="Record voice message"
                className="flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-secondary/20 hover:bg-brand-600/10 text-muted-foreground hover:text-brand-600 active:scale-90 transition-all flex items-center justify-center mb-0.5"
              >
                <Mic className="h-4.5 w-4.5" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={sending}
                aria-label="Send message"
                className={`flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center transition-all active:scale-90 mb-0.5 ${
                  sending
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-brand-600 text-white hover:bg-brand-500 shadow-md shadow-brand-600/20"
                }`}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
