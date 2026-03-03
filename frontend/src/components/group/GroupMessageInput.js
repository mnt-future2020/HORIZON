import { motion, AnimatePresence } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Send, Loader2, Image, User, X, Mic, BarChart3,
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
  return (
    <>
      {/* Pending file preview */}
      {pendingFile && (
        <div className="px-4 py-2 bg-card border-t border-border">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <img src={URL.createObjectURL(pendingFile)} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{pendingFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={onCancelFile} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="sticky bottom-0 bg-card backdrop-blur-xl border-t border-border/40 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
          <button onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/30 text-muted-foreground hover:text-brand-600 hover:bg-secondary/50 transition-colors">
            <Image className="h-4 w-4" />
          </button>
          <button onClick={onOpenPollCreate}
            className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/30 text-muted-foreground hover:text-brand-600 hover:bg-secondary/50 transition-colors">
            <BarChart3 className="h-4 w-4" />
          </button>
          {!recording ? (
            <>
              <div className="flex-1 relative">
                <Input ref={inputRef} value={msgText} onChange={onMsgChange}
                  onKeyDown={onMentionKeyDown}
                  placeholder="Type a message..." className="bg-secondary/30 border-border/40" />
                {/* @Mention dropdown */}
                <AnimatePresence>
                  {mentionResults.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                      className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border/40 rounded-[28px] shadow-sm overflow-hidden z-50 max-h-48 overflow-y-auto">
                      {mentionResults.map((m, i) => (
                        <button key={m.id} onClick={() => onSelectMention(m)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            i === mentionIndex ? "bg-brand-600/10" : "hover:bg-secondary/30"
                          }`}>
                          <div className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                              : <User className="h-3.5 w-3.5 text-brand-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground">{m.skill_rating || 1500} SR</span>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {msgText.trim() || pendingFile ? (
                <button onClick={onSend} disabled={sending} className="h-10 w-10 flex-shrink-0 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center transition-all active:scale-95">
                  {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              ) : (
                <button onClick={onStartRecording}
                  className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-brand-600 text-white hover:bg-brand-500 transition-colors">
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center gap-3 px-3">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono text-red-400">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}</span>
                <span className="text-xs text-muted-foreground">Recording...</span>
              </div>
              <button onClick={onCancelRecording}
                className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground"><X className="h-4 w-4" /></button>
              <button onClick={onStopRecording}
                className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-brand-600 text-white">
                <Send className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
