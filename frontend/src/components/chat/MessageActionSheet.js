import React from "react";
import { motion } from "framer-motion";
import { Reply, Pin, Trash2, Forward, Copy, X } from "lucide-react";
import { toast } from "sonner";

export default function MessageActionSheet({
  msg,
  isMe,
  onClose,
  onReply,
  onPin,
  onDelete,
  onForward,
}) {
  if (!msg) return null;

  const actions = [
    {
      icon: Reply,
      label: "Reply",
      onClick: () => { onReply(msg); onClose(); },
      cls: "text-brand-600",
    },
    {
      icon: Copy,
      label: "Copy text",
      onClick: () => {
        if (msg.content) {
          navigator.clipboard.writeText(msg.content).then(() => toast.success("Copied")).catch(() => {});
        }
        onClose();
      },
      cls: "text-foreground/80",
      hide: !msg.content,
    },
    {
      icon: Pin,
      label: msg.pinned ? "Unpin" : "Pin",
      onClick: () => { onPin(msg); onClose(); },
      cls: "text-amber-500",
    },
    {
      icon: Forward,
      label: "Forward",
      onClick: () => { onForward(msg); onClose(); },
      cls: "text-blue-500",
    },
    ...(isMe
      ? [
          {
            icon: Trash2,
            label: "Delete",
            onClick: () => { onDelete(msg); onClose(); },
            cls: "text-red-500",
          },
        ]
      : []),
  ].filter((a) => !a.hide);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-xs bg-card border border-border/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Preview */}
        {msg.content && (
          <div className="px-5 pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground/50 line-clamp-2 italic">
              {msg.content}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-2 pb-2">
          {actions.map(({ icon: Icon, label, onClick, cls }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-secondary/50 active:bg-secondary/70 transition-colors touch-manipulation"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${cls}`} />
              <span className="text-[14px] font-semibold text-foreground/90">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Cancel (mobile) */}
        <div className="px-3 pb-2 sm:hidden">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-secondary/40 text-[13px] font-bold text-muted-foreground hover:bg-secondary/60 transition-colors flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
