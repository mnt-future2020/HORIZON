import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { ShieldCheck, ArrowLeft } from "lucide-react";
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

export default function PrivacyPolicyPage() {
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
              <ShieldCheck className="w-3.5 h-3.5" />
              Legal & Compliance
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-8">
              <span className="block text-gray-900 font-sans">Privacy</span>
              <span className="block text-brand-600 font-brier mt-2">Policy</span>
            </h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">
              Last updated: December 1, 2025 <span className="mx-2">•</span> Magizh NexGen Technologies
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 pb-32">
        <motion.article
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }}
          className="rounded-2xl bg-gray-50 border border-gray-200 p-6 sm:p-10 md:p-14 mb-8"
        >
          <Sec title="1. Introduction" prefersReducedMotion={prefersReducedMotion} delay={0.3}>
            <p className="break-words">Magizh NexGen Technologies ("MnT", "we", "us") operates LOBBI. This Privacy Policy explains how we collect, use, and protect your information when you use our Service. By using LOBBI, you agree to this policy.</p>
          </Sec>

          <Sec title="2. Information We Collect" prefersReducedMotion={prefersReducedMotion} delay={0.4}>
            <p><strong className="text-gray-900">a) Information you provide:</strong></p>
            <ul className="list-none space-y-3 mt-4 mb-8">
              {[
                "Name, email, and phone number during registration",
                "Sport preferences and skill level",
                "Payment info processed via Razorpay (we do not store card details)",
                "Venue details provided by venue owners"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6"><strong className="text-gray-900">b) Automatically collected:</strong></p>
            <ul className="list-none space-y-3 mt-4">
              {[
                "Device and browser information",
                "Usage data and activity logs",
                "Location data only when you use 'Near Me' search (with explicit permission)"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec title="3. How We Use Your Information" prefersReducedMotion={prefersReducedMotion} delay={0.5}>
            <ul className="list-none space-y-3">
              {[
                "To process bookings and payments",
                "To match players via AI matchmaking",
                "To send booking confirmations and reminders",
                "To improve and personalise the platform",
                "To comply with legal obligations"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec title="4. Payment Information" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">All payments are processed by <strong className="text-gray-900">Razorpay</strong> (PCI-DSS compliant). We do not store card details. See <a href="https://razorpay.com/privacy/" className="text-brand-600 font-bold hover:text-brand-700 transition-colors" target="_blank" rel="noopener noreferrer">Razorpay's Privacy Policy</a>.</p>
          </Sec>

          <Sec title="5. Data Sharing" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words mb-4">We do not sell your data. We share data only with:</p>
            <ul className="list-none space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span className="break-words"><strong className="text-gray-900">Venue Owners:</strong> Name and contact for confirmed bookings only</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span className="break-words"><strong className="text-gray-900">Razorpay:</strong> For payment processing</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0" />
                <span className="break-words"><strong className="text-gray-900">Legal Authorities:</strong> When required by law</span>
              </li>
            </ul>
          </Sec>

          <Sec title="6. Data Retention" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Data is retained while your account is active. Booking records are kept for 3 years. You may request deletion by contacting us.</p>
          </Sec>

          <Sec title="7. Your Rights" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">You have the right to access, correct, or delete your personal data. Contact <a href="mailto:privacy@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors break-all">privacy@magizhnexgen.com</a>.</p>
          </Sec>

          <Sec title="8. Security" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">We use HTTPS, hashed passwords, and JWT authentication. No system is 100% secure, but we follow industry best practices to protect your data.</p>
          </Sec>

          <Sec title="9. Contact" prefersReducedMotion={prefersReducedMotion}>
            <div className="bg-brand-600/5 rounded-xl p-6 md:p-8 border border-brand-600/20 mt-4">
              <p className="font-bold text-lg uppercase tracking-widest text-gray-900 mb-4">Magizh NexGen Technologies</p>
              <div className="space-y-3 text-base">
                <p className="flex items-center gap-3">
                  <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Email</span>
                  <a href="mailto:privacy@magizhnexgen.com" className="text-brand-600 font-bold hover:text-brand-700 transition-colors break-all">privacy@magizhnexgen.com</a>
                </p>
                <p className="flex items-center gap-3">
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
