import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Mic,
  Send,
  X,
  Smile,
  Paperclip,
  Trash2,
  Square,
  StopCircle,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-3 sm:p-4 bg-card/60 backdrop-blur-3xl border-t border-border/30 relative z-40 glassmorphism pb-[env(safe-area-inset-bottom,8px)]">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {/* Reply Preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: "auto", opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="bg-brand-600/5 px-4.5 py-3 rounded-[24px] mb-2 flex items-center justify-between border border-brand-600/10 shadow-inner group overflow-hidden"
            >
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block opacity-70 mb-0.5">
                  Replying to {replyTo.sender_name}
                </span>
                <p className="text-sm text-foreground/80 truncate italic font-medium">
                  {replyTo.content || "Media"}
                </p>
              </div>
              <button
                onClick={onCancelReply}
                className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center text-brand-600 hover:bg-brand-600 hover:text-white transition-all shadow-sm active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Preview */}
        <AnimatePresence>
          {pendingFile && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: "auto", opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="bg-secondary/20 px-4.5 py-3 rounded-[24px] mb-2 flex items-center justify-between border border-border/10 shadow-inner"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-4">
                <div className="h-10 w-10 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0 text-brand-600">
                  <Paperclip className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">
                    Ready to Send
                  </span>
                  <p className="text-sm font-bold truncate">
                    {pendingFile.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancelFile}
                className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording Overlay */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-4 bottom-2 bg-brand-600 text-white rounded-full flex items-center justify-between px-6 py-3 z-50 shadow-md border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="h-3 w-3 rounded-full bg-white animate-pulse shadow-glow shadow-white/40" />
                <span className="font-black tabular-nums tracking-widest text-sm">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onCancelRecording}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all text-white/70 hover:text-white"
                  title="Discard"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  onClick={onStopRecording}
                  className="h-12 px-6 rounded-full bg-white text-brand-600 flex items-center gap-2 font-black transition-all hover:scale-105 active:scale-95"
                  title="Send Recording"
                >
                  <Send className="h-4 w-4" />
                  <span className="text-[12px] uppercase tracking-widest">
                    Send
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-border/10 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center hover:scale-110 active:scale-90 shadow-sm group"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5 group-hover:-rotate-45 transition-transform" />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={onFileSelect}
            />
          </button>

          <div className="flex-1 bg-secondary/15 rounded-[22px] border border-border/10 hover:border-brand-600/20 focus-within:border-brand-600/40 focus-within:ring-4 focus-within:ring-brand-600/5 px-2 py-1.5 min-h-[48px] flex items-center transition-all shadow-inner relative group/input">
            <button
              onClick={onToggleEmojiPicker}
              className={`flex-shrink-0 p-2.5 rounded-full transition-all cursor-pointer ${showEmojiPicker ? "bg-brand-600/10 text-brand-600" : "text-muted-foreground/60 hover:text-brand-600 group-hover/input:text-brand-600/80 hover:scale-110"}`}
              type="button"
            >
              <Smile className="h-5.5 w-5.5" aria-hidden="true" />
            </button>
            <textarea
              ref={inputRef}
              value={msgText}
              onChange={(e) => {
                onMsgTextChange(e.target.value);
                onTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Start typing..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] placeholder:text-muted-foreground/30 max-h-[160px] touch-manipulation py-2 leading-snug px-2 font-medium"
              rows={1}
              style={{ height: "auto" }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
            />
          </div>

          {!msgText.trim() && !pendingFile ? (
            <button
              onClick={onStartRecording}
              className="flex-shrink-0 h-12 w-12 sm:h-12 sm:w-12 rounded-full bg-secondary/20 hover:bg-brand-600/10 text-muted-foreground hover:text-brand-600 transition-all flex items-center justify-center hover:scale-110 active:scale-90 shadow-sm"
              title="Voice message"
            >
              <Mic className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={sending}
              className={`flex-shrink-0 h-12 w-12 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${sending ? "bg-secondary cursor-not-allowed" : "bg-brand-600 text-white hover:bg-brand-500 hover:scale-105"}`}
              title="Send"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
