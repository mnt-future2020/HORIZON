import { motion } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import { Pin, PinOff, X } from "lucide-react";

export default function PinnedMessagesModal({
  isOpen,
  onClose,
  pinnedMsgs,
  formatTime,
  onUnpin,
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="admin-heading flex items-center gap-2">
            <Pin className="h-4 w-4" /> Pinned Messages
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-secondary/50 transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {pinnedMsgs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No pinned messages
          </p>
        ) : (
          <div className="space-y-2.5">
            {pinnedMsgs.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl bg-secondary/20 border border-border/20 group/pin"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-brand-600 truncate">
                      {m.sender_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                  {onUnpin && (
                    <button
                      onClick={() => onUnpin(m)}
                      className="flex-shrink-0 h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 flex items-center gap-1 transition-all opacity-0 group-hover/pin:opacity-100 sm:opacity-100"
                      title="Unpin message"
                    >
                      <PinOff className="h-3 w-3" />
                      <span className="hidden sm:inline">Unpin</span>
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-foreground/80 leading-relaxed">
                  {m.content || (m.media_url ? "Media" : "…")}
                </p>
                {m.media_url && (
                  <img
                    src={mediaUrl(m.media_url)}
                    alt=""
                    className="rounded-xl mt-2 max-h-32 object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
