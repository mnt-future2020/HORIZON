import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Inbox, ShieldCheck, ShieldX, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { chatAPI } from "@/lib/api";
import { toast } from "sonner";

const MessageRequestsModal = ({ isOpen, onClose, onAccept, onDecline }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await chatAPI.getRequests();
      setRequests(res.data || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen]);

  const handleAcceptItem = async (req) => {
    try {
      await onAccept(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      // Re-load if needed
    }
  };

  const handleDeclineItem = async (req) => {
    try {
      await onDecline(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      // Re-load if needed
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-[28px] max-h-[80vh] flex flex-col border border-border/40 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Inbox className="h-5 w-5 text-brand-600" />
                <span className="tracking-tight">Message Requests</span>
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-2 hover:bg-secondary/50 rounded-xl transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="px-5 pt-4 text-[11px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">
              Accept to start chatting.
            </p>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-30">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                  <p className="text-[10px] uppercase font-bold tracking-widest">
                    Loading requests...
                  </p>
                </div>
              )}
              {!loading && requests.length === 0 && (
                <div className="text-center py-16 opacity-30 flex flex-col items-center gap-3">
                  <Inbox className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-bold">Inbox clear</p>
                </div>
              )}
              {!loading &&
                requests.map((req, idx) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-4 rounded-[24px] bg-secondary/20 border border-border/10 hover:border-brand-600/30 transition-all shadow-sm group"
                  >
                    <div
                      className="h-14 w-14 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer border-2 border-transparent group-hover:border-brand-600/40 transition-all"
                      onClick={() =>
                        navigate(`/player-card/${req.other_user?.id}`)
                      }
                    >
                      {req.other_user?.avatar ? (
                        <img
                          src={mediaUrl(req.other_user.avatar)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-7 w-7 text-brand-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className="font-bold text-[15px] truncate block text-foreground/90 group-hover:text-brand-600 transition-all cursor-pointer"
                        onClick={() =>
                          navigate(`/player-card/${req.other_user?.id}`)
                        }
                      >
                        {req.other_user?.name || "Unknown"}
                      </span>
                      <p className="text-[12px] text-muted-foreground/80 truncate mt-0.5 font-medium leading-tight">
                        {req.last_message || "Wants to message you"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptItem(req)}
                        className="h-10 w-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-500 transition-all cursor-pointer active:scale-90"
                        title="Accept"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeclineItem(req)}
                        className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all cursor-pointer border border-red-500/10 active:scale-90"
                        title="Decline"
                      >
                        <ShieldX className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MessageRequestsModal;
