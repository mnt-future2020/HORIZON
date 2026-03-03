import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PaymentReviewModal({
  payStep,
  pendingSession,
  pendingSubPkg,
  card,
  onClose,
  onConfirmSession,
  onConfirmSub,
}) {
  if (!payStep || (!pendingSession && !pendingSubPkg)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        onClick={() => {
          if (payStep !== "processing") onClose();
        }}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-[24px] border border-border/40 overflow-hidden shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="font-display font-black text-lg">
              {payStep === "done"
                ? "Booking Confirmed!"
                : payStep === "processing"
                  ? "Processing Payment..."
                  : "Complete Payment"}
            </h2>
            {payStep !== "processing" && (
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="p-5">
            {/* Processing */}
            {payStep === "processing" && (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Confirming your booking...
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Please do not close this window
                </p>
              </div>
            )}

            {/* Review — Session */}
            {payStep === "review" && pendingSession && (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-border/40 bg-card/50 p-5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Coach
                    </span>
                    <span className="font-display font-black text-sm">
                      {pendingSession.coach_name || card.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Date
                    </span>
                    <span className="font-bold text-sm">
                      {new Date(pendingSession.date).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Time
                    </span>
                    <span className="font-bold text-sm">
                      {pendingSession.start_time} – {pendingSession.end_time}
                    </span>
                  </div>
                  {pendingSession.sport && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                        Sport
                      </span>
                      <span className="font-bold text-sm capitalize">
                        {pendingSession.sport.replace("_", " ")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-border/40">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Total
                    </span>
                    <span className="font-display font-black text-2xl text-brand-500">
                      ₹{pendingSession.price}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Status
                    </span>
                    <Badge variant="athletic">Awaiting Payment</Badge>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-brand-500 font-semibold">
                  Payment gateway is being configured. Please confirm to
                  proceed.
                </div>

                <button
                  onClick={onConfirmSession}
                  className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wide text-sm flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg transition-all"
                >
                  Confirm Payment · ₹{pendingSession.price}
                </button>
              </div>
            )}

            {/* Review — Subscription */}
            {payStep === "review" && pendingSubPkg && !pendingSession && (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-border/40 bg-card/50 p-5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Coach
                    </span>
                    <span className="font-display font-black text-sm">
                      {card.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Package
                    </span>
                    <span className="font-bold text-sm">
                      {pendingSubPkg.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Sessions
                    </span>
                    <span className="font-bold text-sm">
                      {pendingSubPkg.sessions_per_month} / month
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Duration
                    </span>
                    <span className="font-bold text-sm">
                      {pendingSubPkg.duration_minutes || 60} min each
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border/40">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Total
                    </span>
                    <span className="font-display font-black text-2xl text-brand-500">
                      ₹
                      {(
                        pendingSubPkg.sub_price ||
                        pendingSubPkg.price ||
                        0
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Status
                    </span>
                    <Badge variant="athletic">Awaiting Payment</Badge>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-brand-500 font-semibold">
                  Payment gateway is being configured. Please confirm to
                  proceed.
                </div>

                <button
                  onClick={onConfirmSub}
                  className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wide text-sm flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg transition-all"
                >
                  Confirm Payment · ₹
                  {(
                    pendingSubPkg.sub_price ||
                    pendingSubPkg.price ||
                    0
                  ).toLocaleString()}
                  /mo
                </button>
              </div>
            )}

            {/* Done */}
            {payStep === "done" && (
              <div className="space-y-5">
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-brand-500" />
                  </div>
                  <p className="font-display font-black text-lg">
                    {pendingSession
                      ? "Session Confirmed!"
                      : "Subscription Active!"}
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    {pendingSession
                      ? `${pendingSession.sport?.replace("_", " ") || "Session"} on ${new Date(pendingSession.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${pendingSession.start_time}`
                      : `${pendingSubPkg?.name} — ${pendingSubPkg?.sessions_per_month} sessions/month`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
