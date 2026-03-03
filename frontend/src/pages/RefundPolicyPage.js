import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import { AlertCircle, CheckCircle2, XCircle, Clock, Banknotes, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Sec = ({ title, children, prefersReducedMotion, delay = 0 }) => (
  <motion.div 
    initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
    whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay }}
    className="mb-10 sm:mb-12 scroll-mt-24"
  >
    <h2 className="font-black text-xl md:text-2xl uppercase tracking-wide mb-6 flex items-center gap-3 text-white">
      <span className="w-8 h-0.5 bg-brand-600" />
      {title}
    </h2>
    <div className="text-white/60 text-sm sm:text-base leading-relaxed space-y-4">{children}</div>
  </motion.div>
);

export default function RefundPolicyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <div className="min-h-screen bg-[#0a0c0a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0c0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="px-6 md:px-12 py-5">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="text-3xl md:text-4xl font-black tracking-tighter text-brand-600 font-brier"
            >
              LOBBI
            </Link>
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-black font-bold hover:text-brand-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <Link
                to={user ? "/feed" : "/auth"}
                className="hidden sm:inline-flex items-center px-5 md:px-6 py-2 md:py-2.5 bg-brand-600 text-white font-bold text-sm rounded-full hover:bg-brand-700 transition-all hover:scale-105"
              >
                {user ? "Dashboard" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-36 pb-16 px-6 md:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-xs font-bold tracking-widest uppercase mb-6">
              <Clock className="w-3.5 h-3.5" />
              Legal & Compliance
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight leading-[0.9] mb-6">
              <span className="block text-white font-sans">Cancellation &</span>
              <span className="block text-brand-600 font-brier mt-2">Refunds</span>
            </h1>
            <p className="text-white/40 text-[11px] uppercase tracking-widest font-bold">
              Last updated: December 1, 2025 <span className="mx-2">•</span> Magizh NexGen Technologies
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-12 pb-24">
        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <motion.div 
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl bg-[#0a0c0a] border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)] p-5 border-l-4"
          >
            <CheckCircle2 className="w-6 h-6 text-green-500 mb-3" />
            <div className="text-base font-black uppercase tracking-wide text-white">Full Refund</div>
            <div className="text-xs text-white/50 mt-1 font-medium">Cancelled 24+ hrs before slot</div>
          </motion.div>
          
          <motion.div 
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl bg-[#0a0c0a] border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)] p-5 border-l-4"
          >
            <Clock className="w-6 h-6 text-yellow-500 mb-3" />
            <div className="text-base font-black uppercase tracking-wide text-white">50% Refund</div>
            <div className="text-xs text-white/50 mt-1 font-medium">Cancelled 4–24 hrs before slot</div>
          </motion.div>
          
          <motion.div 
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-2xl bg-[#0a0c0a] border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] p-5 border-l-4"
          >
            <XCircle className="w-6 h-6 text-red-500 mb-3" />
            <div className="text-base font-black uppercase tracking-wide text-white">No Refund</div>
            <div className="text-xs text-white/50 mt-1 font-medium">Cancelled &lt;4 hrs before slot</div>
          </motion.div>
        </div>

        {/* Detailed Policy Article */}
        <motion.article 
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.5 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-6 sm:p-10 md:p-12 mb-8"
        >
          <Sec title="1. Cancellation by Player" prefersReducedMotion={prefersReducedMotion} delay={0.6}>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-white">Cancellation Time</th>
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-white">Refund</th>
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-white">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["More than 24 hours before slot", "100%", "5–7 business days"],
                    ["4 to 24 hours before slot", "50%", "5–7 business days"],
                    ["Less than 4 hours before slot", "No refund", "—"],
                    ["No-show", "No refund", "—"],
                  ].map(([t, r, p]) => (
                    <tr key={t} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-white/60">{t}</td>
                      <td className="p-4 font-bold text-white">{r}</td>
                      <td className="p-4 text-white/60">{p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sec>

          <Sec title="2. Cancellation by Venue" prefersReducedMotion={prefersReducedMotion} delay={0.7}>
            <p className="break-words">If a venue cancels a confirmed booking, the player receives a <strong className="text-white">100% refund</strong> regardless of timing.</p>
          </Sec>

          <Sec title="3. How to Cancel" prefersReducedMotion={prefersReducedMotion}>
            <ol className="list-decimal pl-5 space-y-3 mb-4 marker:text-brand-400 font-bold">
              <li className="pl-2 font-normal">Login to LOBBI <span className="text-white/30 mx-2">→</span> Player Dashboard <span className="text-white/30 mx-2">→</span> Bookings</li>
              <li className="pl-2 font-normal">Select the booking and click <span className="px-2 py-1 rounded bg-white/10 text-white font-bold text-xs">Cancel Booking</span></li>
            </ol>
            <p className="break-words">Or email <a href="mailto:support@magizhnexgen.com" className="text-brand-400 font-bold hover:text-brand-300 transition-colors">support@magizhnexgen.com</a> with your booking ID.</p>
          </Sec>

          <Sec title="4. Refund Method" prefersReducedMotion={prefersReducedMotion}>
            <ul className="list-none space-y-3 mb-4">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0" />
                <span><strong className="text-white">Credit/Debit Cards:</strong> 5–7 business days</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0" />
                <span><strong className="text-white">UPI / Net Banking:</strong> 3–5 business days</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0" />
                <span><strong className="text-white">Wallets:</strong> 1–3 business days</span>
              </li>
            </ul>
            <p className="break-words">All refunds are processed securely via <strong className="text-white">Razorpay</strong>.</p>
          </Sec>

          <Sec title="5. Split Payment Bookings" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Refunds for split payments are issued proportionally to each participant who paid. Unpaid split slots that expire incur no charges.</p>
          </Sec>

          <Sec title="6. Non-Refundable Situations" prefersReducedMotion={prefersReducedMotion}>
            <div className="flex flex-col sm:flex-row items-start gap-4 bg-red-500/10 border border-red-500/20 rounded-xl p-5 md:p-6 mt-4">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-red-400 block mb-3 uppercase tracking-wider text-sm">Important Note</strong>
                <ul className="list-disc pl-4 space-y-2 text-red-200/70 marker:text-red-500/50">
                  <li>Cancellations within 4 hours of slot time</li>
                  <li>No-shows at the venue</li>
                  <li>Accounts terminated for policy violations</li>
                  <li>External factors (e.g., weather) outside the venue's control</li>
                </ul>
              </div>
            </div>
          </Sec>

          <Sec title="7. Disputes" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Contact <a href="mailto:support@magizhnexgen.com" className="text-brand-400 font-bold hover:text-brand-300 transition-colors">support@magizhnexgen.com</a> within 7 days of booking with your booking ID. We aim to resolve all disputes within 10 business days.</p>
          </Sec>

          <Sec title="8. Contact" prefersReducedMotion={prefersReducedMotion}>
            <div className="bg-brand-600/5 rounded-xl p-5 md:p-6 border border-brand-600/20 mt-4">
              <p className="font-bold text-base uppercase tracking-widest text-white mb-3">Magizh NexGen Technologies</p>
              <div className="space-y-2 text-sm md:text-base">
                <p className="flex items-center gap-2">
                  <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">Email Support</span>
                  <a href="mailto:support@magizhnexgen.com" className="text-brand-400 font-bold hover:text-brand-300 transition-colors break-all mt-0.5">support@magizhnexgen.com</a>
                </p>
              </div>
            </div>
          </Sec>
        </motion.article>
      </main>

      <Footer />
    </div>
  );
}
