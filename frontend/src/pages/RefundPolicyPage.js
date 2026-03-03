import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { AlertCircle, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Sec = ({ title, children, prefersReducedMotion, delay = 0 }) => (
  <motion.div
    initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
    whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay }}
    className="mb-10 sm:mb-12 scroll-mt-24"
  >
    <h2 className="font-black text-xl md:text-2xl uppercase tracking-wide mb-6 flex items-center gap-3 text-gray-900">
      <span className="w-8 h-0.5 bg-brand-600" />
      {title}
    </h2>
    <div className="text-gray-600 text-base leading-relaxed space-y-4">{children}</div>
  </motion.div>
);

export default function RefundPolicyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="px-6 md:px-12 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-brand-600">
              <Logo size="lg" />
            </Link>
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-black hover:text-brand-600 uppercase tracking-wide transition-colors font-brier"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <Link
                to={user ? "/feed" : "/auth"}
                className="inline-flex items-center px-5 md:px-6 py-2 md:py-2.5 bg-brand-600 text-white font-bold text-sm rounded-full hover:bg-brand-700 transition-all hover:scale-105"
              >
                {user ? "Dashboard" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-36 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-600 text-xs font-bold tracking-widest uppercase mb-8">
              <Clock className="w-3.5 h-3.5" />
              Legal & Compliance
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-8">
              <span className="block text-gray-900 font-sans">Cancellation &</span>
              <span className="block text-brand-600 font-brier mt-2">Refunds</span>
            </h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">
              Last updated: December 1, 2025 <span className="mx-2">•</span> Magizh NexGen Technologies
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 md:px-12 pb-32">
        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl bg-green-50 border border-green-200 p-6 border-l-4 border-l-green-500"
          >
            <CheckCircle2 className="w-7 h-7 text-green-600 mb-3" />
            <div className="text-lg font-black uppercase tracking-wide text-gray-900">Full Refund</div>
            <div className="text-sm text-gray-500 mt-1 font-medium">Cancelled 24+ hrs before slot</div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl bg-yellow-50 border border-yellow-200 p-6 border-l-4 border-l-yellow-500"
          >
            <Clock className="w-7 h-7 text-yellow-600 mb-3" />
            <div className="text-lg font-black uppercase tracking-wide text-gray-900">50% Refund</div>
            <div className="text-sm text-gray-500 mt-1 font-medium">Cancelled 4–24 hrs before slot</div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-2xl bg-red-50 border border-red-200 p-6 border-l-4 border-l-red-500"
          >
            <XCircle className="w-7 h-7 text-red-600 mb-3" />
            <div className="text-lg font-black uppercase tracking-wide text-gray-900">No Refund</div>
            <div className="text-sm text-gray-500 mt-1 font-medium">Cancelled &lt;4 hrs before slot</div>
          </motion.div>
        </div>

        {/* Detailed Policy Article */}
        <motion.article
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.5 }}
          className="rounded-2xl bg-gray-50 border border-gray-200 p-6 sm:p-10 md:p-14 mb-8"
        >
          <Sec title="1. Cancellation by Player" prefersReducedMotion={prefersReducedMotion} delay={0.6}>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white mt-4">
              <table className="w-full text-base border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-gray-900">Cancellation Time</th>
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-gray-900">Refund</th>
                    <th className="text-left p-4 font-black uppercase tracking-wider text-xs text-gray-900">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["More than 24 hours before slot", "100%", "5–7 business days"],
                    ["4 to 24 hours before slot", "50%", "5–7 business days"],
                    ["Less than 4 hours before slot", "No refund", "—"],
                    ["No-show", "No refund", "—"],
                  ].map(([t, r, p]) => (
                    <tr key={t} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600">{t}</td>
                      <td className="p-4 font-bold text-gray-900">{r}</td>
                      <td className="p-4 text-gray-500">{p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sec>

          <Sec title="2. Cancellation by Venue" prefersReducedMotion={prefersReducedMotion} delay={0.7}>
            <p className="break-words">If a venue cancels a confirmed booking, the player receives a <strong className="text-gray-900">100% refund</strong> regardless of timing.</p>
          </Sec>

          <Sec title="3. How to Cancel" prefersReducedMotion={prefersReducedMotion}>
            <ol className="list-decimal pl-5 space-y-3 mb-4 marker:text-brand-600 font-bold">
              <li className="pl-2 font-normal">Login to LOBBI <span className="text-gray-300 mx-2">→</span> Player Dashboard <span className="text-gray-300 mx-2">→</span> Bookings</li>
              <li className="pl-2 font-normal">Select the booking and click <span className="px-2 py-1 rounded bg-gray-200 text-gray-900 font-bold text-xs">Cancel Booking</span></li>
            </ol>
            <p className="break-words">Or email <a href="mailto:support@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors">support@magizhnexgen.com</a> with your booking ID.</p>
          </Sec>

          <Sec title="4. Refund Method" prefersReducedMotion={prefersReducedMotion}>
            <ul className="list-none space-y-3 mb-4">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span><strong className="text-gray-900">Credit/Debit Cards:</strong> 5–7 business days</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span><strong className="text-gray-900">UPI / Net Banking:</strong> 3–5 business days</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span><strong className="text-gray-900">Wallets:</strong> 1–3 business days</span>
              </li>
            </ul>
            <p className="break-words">All refunds are processed securely via <strong className="text-gray-900">Razorpay</strong>.</p>
          </Sec>

          <Sec title="5. Split Payment Bookings" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Refunds for split payments are issued proportionally to each participant who paid. Unpaid split slots that expire incur no charges.</p>
          </Sec>

          <Sec title="6. Non-Refundable Situations" prefersReducedMotion={prefersReducedMotion}>
            <div className="flex flex-col sm:flex-row items-start gap-4 bg-red-50 border border-red-200 rounded-xl p-6 md:p-8 mt-4">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-red-600 block mb-3 uppercase tracking-wider text-sm">Important Note</strong>
                <ul className="list-disc pl-4 space-y-2 text-red-700/70 marker:text-red-400">
                  <li>Cancellations within 4 hours of slot time</li>
                  <li>No-shows at the venue</li>
                  <li>Accounts terminated for policy violations</li>
                  <li>External factors (e.g., weather) outside the venue's control</li>
                </ul>
              </div>
            </div>
          </Sec>

          <Sec title="7. Disputes" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Contact <a href="mailto:support@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors">support@magizhnexgen.com</a> within 7 days of booking with your booking ID. We aim to resolve all disputes within 10 business days.</p>
          </Sec>

          <Sec title="8. Contact" prefersReducedMotion={prefersReducedMotion}>
            <div className="bg-brand-600/5 rounded-xl p-6 md:p-8 border border-brand-600/20 mt-4">
              <p className="font-bold text-lg uppercase tracking-widest text-gray-900 mb-4">Magizh NexGen Technologies</p>
              <div className="space-y-3 text-base">
                <p className="flex items-center gap-3">
                  <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Email Support</span>
                  <a href="mailto:support@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors break-all">support@magizhnexgen.com</a>
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
