import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Inbox, ShieldCheck, ShieldX, User, Loader2,
  Clock, MessageCircle, Ban,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { chatAPI } from "@/lib/api";
import { toast } from "sonner";

const MessageRequestsModal = ({ isOpen, onClose, onAccept, onDecline }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

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
    if (isOpen) loadRequests();
  }, [isOpen]);

  const handleAcceptItem = async (req) => {
    setProcessingId(req.id);
    try {
      await onAccept(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch {
      // handled upstream
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineItem = async (req) => {
    setProcessingId(req.id);
    try {
      await onDecline(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch {
      // handled upstream
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col border border-border/20 shadow-2xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-8 h-1 rounded-full bg-border/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-border/15">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-brand-600/10 flex items-center justify-center">
                  <Inbox className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold">Message Requests</h2>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    {requests.length > 0
                      ? `${requests.length} pending`
                      : "No pending requests"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40 transition-all active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Info banner */}
            <div className="px-5 py-3 border-b border-border/10">
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                These people aren't in your contacts. Accept to start chatting, or decline to remove the request.
              </p>
            </div>

            {/* Request list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                  <p className="text-[12px] text-muted-foreground/40">Loading requests...</p>
                </div>
              )}

              {!loading && requests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-16 w-16 rounded-full bg-secondary/30 flex items-center justify-center">
                    <MessageCircle className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-foreground/70">All clear</p>
                    <p className="text-[12px] text-muted-foreground/40 mt-0.5">No pending message requests</p>
                  </div>
                </div>
              )}

              {!loading &&
                requests.map((req, idx) => {
                  const isProcessing = processingId === req.id;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/20 transition-colors mb-0.5"
                    >
                      {/* Avatar */}
                      <div
                        className="relative h-12 w-12 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/player-card/${req.other_user?.id}`)}
                      >
                        {req.other_user?.avatar ? (
                          <img
                            src={mediaUrl(req.other_user.avatar)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-brand-600/60" />
                        )}
                        {/* Pending indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full bg-amber-500 flex items-center justify-center border-2 border-card">
                          <Clock className="h-2 w-2 text-white" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <span
                          className="font-semibold text-[14px] truncate block text-foreground cursor-pointer hover:text-brand-600 transition-colors"
                          onClick={() => navigate(`/player-card/${req.other_user?.id}`)}
                        >
                          {req.other_user?.name || "Unknown"}
                        </span>
                        <p className="text-[12px] text-muted-foreground/50 truncate mt-0.5">
                          {req.last_message || "Wants to message you"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleAcceptItem(req)}
                          disabled={isProcessing}
                          className="h-9 px-3.5 rounded-full bg-brand-600 text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-brand-500 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Accept
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineItem(req)}
                          disabled={isProcessing}
                          className="h-9 w-9 rounded-full border border-border/30 text-muted-foreground/60 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                          title="Decline"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MessageRequestsModal;
