import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link2, Copy } from "lucide-react";

export default function InviteLinkModal({
  isOpen,
  onClose,
  groupId,
  inviteCode,
  onCopy,
}) {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="w-full max-w-sm bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="admin-heading mb-4 flex items-center gap-2"><Link2 className="h-4 w-4" /> Invite Link</h2>
        <div className="p-3 rounded-xl bg-secondary/30 text-xs font-mono break-all mb-4">
          {window.location.origin}/communities/{groupId}?invite={inviteCode}
        </div>
        <Button onClick={onCopy} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl active:scale-[0.98] transition-all"><Copy className="h-4 w-4 mr-2" /> Copy Link</Button>
      </motion.div>
    </motion.div>
  );
}
