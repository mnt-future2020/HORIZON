import React from "react";
import { motion } from "framer-motion";
import { Reply, Pin, Trash2, Forward, Copy } from "lucide-react";
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
      cls: "text-brand-600 bg-brand-600/8",
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
      cls: "text-foreground/70 bg-secondary/40",
      hide: !msg.content,
    },
    {
      icon: Pin,
      label: msg.pinned ? "Unpin" : "Pin",
      onClick: () => { onPin(msg); onClose(); },
      cls: "text-amber-500 bg-amber-500/8",
    },
    {
      icon: Forward,
      label: "Forward",
      onClick: () => { onForward(msg); onClose(); },
      cls: "text-blue-500 bg-blue-500/8",
    },
    ...(isMe
      ? [
          {
            icon: Trash2,
            label: "Delete",
            onClick: () => { onDelete(msg); onClose(); },
            cls: "text-red-500 bg-red-500/8",
          },
        ]
      : []),
  ].filter((a) => !a.hide);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-xs bg-card border border-border/30 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full bg-border/50" />
        </div>

        {/* Message preview */}
        {msg.content && (
          <div className="px-4 pt-2 pb-1.5">
            <p className="text-[12px] text-muted-foreground/40 line-clamp-2">
              {msg.content}
            </p>
          </div>
        )}

        {/* Actions grid */}
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {actions.map(({ icon: Icon, label, onClick, cls }) => (
            <button
              key={label}
              onClick={onClick}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-colors touch-manipulation active:scale-95 ${cls}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-[13px] font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Cancel (mobile) */}
        <div className="px-3 pb-1.5 sm:hidden">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-secondary/30 text-[13px] font-medium text-muted-foreground hover:bg-secondary/50 transition-colors flex items-center justify-center"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
