import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/utils";
import { User, X, Check } from "lucide-react";

export default function JoinRequestsModal({
  isOpen,
  onClose,
  joinRequests,
  onApprove,
  onReject,
}) {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="admin-heading">Join Requests</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {joinRequests.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No pending requests</p> : (
          <div className="space-y-2">
            {joinRequests.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20">
                <div className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center">
                  {r.user_avatar ? <img src={mediaUrl(r.user_avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <User className="h-4 w-4 text-brand-600" />}
                </div>
                <span className="flex-1 text-sm font-medium">{r.user_name}</span>
                <Button size="sm" className="h-7 text-[10px] admin-btn rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-3" onClick={() => onApprove(r.id)}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onReject(r.id)}><X className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
