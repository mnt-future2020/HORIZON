import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { FileText, ArrowLeft } from "lucide-react";
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

export default function TermsPage() {
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
        <div className="px-4 sm:px-6 md:px-12 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-brand-600">
              <Logo size="lg" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-bold text-black hover:text-brand-600 uppercase tracking-wide transition-colors font-brier"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <Link
                to={user ? "/feed" : "/auth"}
                className="inline-flex items-center px-4 sm:px-5 md:px-6 py-2 md:py-2.5 bg-brand-600 text-white font-bold text-xs sm:text-sm rounded-full hover:bg-brand-700 transition-all hover:scale-105"
              >
                {user ? "Dashboard" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 sm:pt-28 md:pt-36 pb-10 sm:pb-14 md:pb-16 px-4 sm:px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-600 text-xs font-bold tracking-widest uppercase mb-5 sm:mb-8">
              <FileText className="w-3.5 h-3.5" />
              Legal & Compliance
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-5 sm:mb-8">
              <span className="block text-gray-900 font-sans">Terms of</span>
              <span className="block text-brand-600 font-brier mt-2">Service</span>
            </h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">
              Last updated: December 1, 2025 <span className="mx-2">•</span> Magizh NexGen Technologies
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-16 sm:pb-24 md:pb-32">
        <motion.article
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }}
          className="rounded-2xl bg-gray-50 border border-gray-200 p-6 sm:p-10 md:p-14 mb-8"
        >
          <Sec title="1. Acceptance of Terms" prefersReducedMotion={prefersReducedMotion} delay={0.3}>
            <p className="break-words">By accessing LOBBI operated by Magizh NexGen Technologies, you agree to be bound by these Terms. If you disagree, please do not use our Service.</p>
          </Sec>

          <Sec title="2. Description of Service" prefersReducedMotion={prefersReducedMotion} delay={0.4}>
            <p className="break-words">LOBBI enables players to discover and book sports facilities, venue owners to manage and monetise facilities, coaches to offer training, and players to find opponents via AI matchmaking.</p>
          </Sec>

          <Sec title="3. User Accounts" prefersReducedMotion={prefersReducedMotion} delay={0.5}>
            <p className="break-words">You are responsible for maintaining account confidentiality and for all activities under your account. Provide accurate registration information. We may suspend accounts that violate these terms.</p>
          </Sec>

          <Sec title="4. Booking Terms" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words"><strong className="text-gray-900">4.1 Reservation:</strong> A temporary slot lock is placed for up to 30 minutes to complete payment. Unpaid bookings are auto-cancelled.</p>
            <p className="break-words"><strong className="text-gray-900">4.2 Payment:</strong> Full payment is required to confirm a booking.</p>
            <p className="break-words"><strong className="text-gray-900">4.3 Split Payments:</strong> Multiple players may split booking costs. Confirmation requires all participants to pay.</p>
          </Sec>

          <Sec title="5. Cancellation & Refunds" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">See our <Link to="/refund-policy" className="text-brand-600 font-bold hover:text-brand-700 transition-colors">Cancellation and Refund Policy</Link> for full details.</p>
          </Sec>

          <Sec title="6. Venue Owner Obligations" prefersReducedMotion={prefersReducedMotion}>
            <ul className="list-none space-y-3 mt-4">
              {[
                "Provide accurate venue information and availability",
                "Honour all confirmed bookings made via LOBBI",
                "Maintain facilities in a safe condition",
                "Comply with all applicable local regulations"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec title="7. Prohibited Activities" prefersReducedMotion={prefersReducedMotion}>
            <ul className="list-none space-y-3 mt-4">
              {[
                "Use for illegal or unauthorised purposes",
                "Manipulating rating or matchmaking systems",
                "Posting false or misleading reviews",
                "Reselling booked slots without written consent"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec title="8. Limitation of Liability" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">MnT is not liable for injuries at facilities, loss of revenue, or actions of third parties. Total liability is capped at the amount paid for the specific booking.</p>
          </Sec>

          <Sec title="9. Governing Law" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu.</p>
          </Sec>

          <Sec title="10. Contact" prefersReducedMotion={prefersReducedMotion}>
            <div className="bg-brand-600/5 rounded-xl p-6 md:p-8 border border-brand-600/20 mt-4">
              <p className="font-bold text-lg uppercase tracking-widest text-gray-900 mb-4">Magizh NexGen Technologies</p>
              <div className="space-y-3 text-base">
                <p className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Email</span>
                  <a href="mailto:legal@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors break-all">legal@magizhnexgen.com</a>
                </p>
                <p className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Location</span>
                  <span className="font-medium text-gray-700">Chennai, Tamil Nadu, India</span>
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
