import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import {
  Send, Loader2, Paperclip, User, X, Mic, BarChart3, Trash2,
} from "lucide-react";

export default function GroupMessageInput({
  msgText,
  onMsgChange,
  onMentionKeyDown,
  onSend,
  sending,
  uploading,
  inputRef,
  fileInputRef,
  mentionResults,
  mentionIndex,
  onSelectMention,
  pendingFile,
  onCancelFile,
  onFileSelect,
  onOpenPollCreate,
  recording,
  recordingTime,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}) {
  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasContent = msgText.trim() || pendingFile;

  return (
    <div
      className="flex-shrink-0 bg-card/80 backdrop-blur-xl border-t border-border/15"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      <div className="max-w-5xl mx-auto px-2 sm:px-3 pt-1.5 pb-1.5">
        {/* Pending file preview */}
        <AnimatePresence>
          {pendingFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-2 mb-1.5">
                <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-brand-600/10 flex items-center justify-center">
                  {pendingFile.type?.startsWith("image/") ? (
                    <img src={URL.createObjectURL(pendingFile)} alt="" className="h-10 w-10 object-cover" />
                  ) : (
                    <Paperclip className="h-4 w-4 text-brand-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate text-foreground/80">{pendingFile.name}</p>
                  <p className="text-[10px] text-muted-foreground/50">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={onCancelFile}
                  aria-label="Remove file"
                  className="flex-shrink-0 h-6 w-6 rounded-full hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-500 flex items-center justify-center transition-colors active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* @Mention dropdown */}
        <AnimatePresence>
          {mentionResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="mb-1.5 bg-card border border-border/20 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
            >
              {mentionResults.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => onSelectMention(m)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === mentionIndex ? "bg-brand-600/10" : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {m.avatar ? (
                      <img src={mediaUrl(m.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-brand-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate block">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground/50">{m.skill_rating || 1500} SR</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording UI */}
        <AnimatePresence>
          {recording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 bg-brand-600 text-white rounded-full px-4 py-2.5"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse flex-shrink-0" />
                <span className="font-mono text-sm tabular-nums">{formatDuration(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={onCancelRecording}
                  aria-label="Discard recording"
                  className="h-8 w-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-90 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onStopRecording}
                  aria-label="Send recording"
                  className="h-8 px-4 rounded-full bg-white text-brand-600 font-semibold text-[12px] flex items-center gap-1.5 hover:bg-white/90 active:scale-95 transition-all"
                >
                  <Send className="h-3 w-3" />
                  Send
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Normal input row */}
        {!recording && (
          <div className="flex items-end gap-1.5">
            {/* Text area wrapper with integrated buttons */}
            <div className="flex-1 min-w-0 flex items-end bg-secondary/25 rounded-3xl border border-border/10 focus-within:border-brand-600/20 transition-colors overflow-hidden">
              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              >
                <Paperclip className="h-5 w-5" />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
              </button>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={msgText}
                onChange={(e) => {
                  onMsgChange(e);
                  autoResize(e.target);
                }}
                onKeyDown={onMentionKeyDown}
                placeholder="Message"
                aria-label="Message input"
                rows={1}
                className="flex-1 min-w-0 bg-transparent border-none outline-none resize-none text-[14px] placeholder:text-muted-foreground/35 py-2.5 pr-1 leading-snug max-h-[120px] overflow-y-auto touch-manipulation"
                style={{ height: "auto" }}
              />

              {/* Poll */}
              <button
                onClick={onOpenPollCreate}
                aria-label="Create poll"
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              >
                <BarChart3 className="h-5 w-5" />
              </button>
            </div>

            {/* Voice / Send button */}
            {!hasContent ? (
              <button
                onClick={onStartRecording}
                aria-label="Record voice message"
                className="flex-shrink-0 h-10 w-10 rounded-full bg-brand-600 text-white hover:bg-brand-500 active:scale-90 transition-all flex items-center justify-center shadow-sm"
              >
                <Mic className="h-[18px] w-[18px]" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={sending || uploading}
                aria-label="Send message"
                className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  sending || uploading
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-brand-600 text-white hover:bg-brand-500 shadow-sm"
                }`}
              >
                {sending || uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-[16px] w-[16px] ml-0.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
