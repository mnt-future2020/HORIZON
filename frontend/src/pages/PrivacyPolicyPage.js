import { Link } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";

const Sec = ({ title, children, prefersReducedMotion }) => (
  <motion.div 
    initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
    whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
    className="mb-6 sm:mb-8 scroll-mt-20"
  >
    <h2 className="font-display font-bold text-base sm:text-lg md:text-xl text-foreground mb-2 sm:mb-3 break-words">{title}</h2>
    <div className="text-muted-foreground text-sm sm:text-base leading-relaxed space-y-2 sm:space-y-3">{children}</div>
  </motion.div>
);

export default function PrivacyPolicyPage() {
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-background/95 backdrop-blur-xl border-b border-border safe-area-inset">
        <Link 
          to="/" 
          className="font-display font-black text-base sm:text-lg md:text-xl tracking-tighter uppercase text-primary hover:text-primary/80 transition-colors min-h-[44px] flex items-center touch-manipulation"
          aria-label="Go to homepage"
        >
          HORIZON
        </Link>
        <Link 
          to="/contact" 
          className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation px-2"
        >
          Contact Us
        </Link>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-16">
        <motion.header 
          initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
          className="mb-6 sm:mb-8 lg:mb-10"
        >
          <h1 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-foreground mb-2 sm:mb-3 break-words leading-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground break-words">
            Last updated: December 1, 2025 · Magizh NexGen Technologies
          </p>
        </motion.header>
        <motion.article 
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
          className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10"
        >
          <Sec title="1. Introduction" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Magizh NexGen Technologies ("MnT", "we", "us") operates HORIZON. This Privacy Policy explains how we collect, use, and protect your information when you use our Service. By using HORIZON, you agree to this policy.</p>
          </Sec>
          <Sec title="2. Information We Collect" prefersReducedMotion={prefersReducedMotion}>
            <p><strong className="text-foreground">a) Information you provide:</strong></p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 marker:text-primary/60">
              <li className="break-words pl-1">Name, email, and phone number during registration</li>
              <li className="break-words pl-1">Sport preferences and skill level</li>
              <li className="break-words pl-1">Payment info processed via Razorpay (we do not store card details)</li>
              <li className="break-words pl-1">Venue details provided by venue owners</li>
            </ul>
            <p className="mt-3"><strong className="text-foreground">b) Automatically collected:</strong></p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 marker:text-primary/60">
              <li className="break-words pl-1">Device and browser information</li>
              <li className="break-words pl-1">Usage data and activity logs</li>
              <li className="break-words pl-1">Location data only when you use "Near Me" search (with explicit permission)</li>
            </ul>
          </Sec>
          <Sec title="3. How We Use Your Information" prefersReducedMotion={prefersReducedMotion}>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 marker:text-primary/60">
              <li className="break-words pl-1">To process bookings and payments</li>
              <li className="break-words pl-1">To match Lobbians via AI matchmaking</li>
              <li className="break-words pl-1">To send booking confirmations and reminders</li>
              <li className="break-words pl-1">To improve and personalise the platform</li>
              <li className="break-words pl-1">To comply with legal obligations</li>
            </ul>
          </Sec>
          <Sec title="4. Payment Information" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">All payments are processed by <strong className="text-foreground">Razorpay</strong> (PCI-DSS compliant). We do not store card details. See <a href="https://razorpay.com/privacy/" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded inline-flex items-center min-h-[44px] touch-manipulation" target="_blank" rel="noopener noreferrer">Razorpay's Privacy Policy</a>.</p>
          </Sec>
          <Sec title="5. Data Sharing" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 marker:text-primary/60">
              <li className="break-words pl-1"><strong className="text-foreground">Venue Owners:</strong> Name and contact for confirmed bookings only</li>
              <li className="break-words pl-1"><strong className="text-foreground">Razorpay:</strong> For payment processing</li>
              <li className="break-words pl-1"><strong className="text-foreground">Legal Authorities:</strong> When required by law</li>
            </ul>
          </Sec>
          <Sec title="6. Data Retention" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">Data is retained while your account is active. Booking records are kept for 3 years. You may request deletion by contacting us.</p>
          </Sec>
          <Sec title="7. Your Rights" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">You have the right to access, correct, or delete your personal data. Contact <a href="mailto:privacy@magizhnexgen.com" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded inline-flex items-center min-h-[44px] touch-manipulation break-all">privacy@magizhnexgen.com</a>.</p>
          </Sec>
          <Sec title="8. Security" prefersReducedMotion={prefersReducedMotion}>
            <p className="break-words">We use HTTPS, hashed passwords, and JWT authentication. No system is 100% secure, but we follow industry best practices.</p>
          </Sec>
          <Sec title="9. Contact" prefersReducedMotion={prefersReducedMotion}>
            <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 md:p-5 border border-border/50">
              <p className="font-semibold text-sm sm:text-base"><strong className="text-foreground break-words">Magizh NexGen Technologies</strong></p>
              <p className="mt-2 text-sm sm:text-base break-words">Email: <a href="mailto:privacy@magizhnexgen.com" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded inline-flex items-center min-h-[44px] touch-manipulation break-all">privacy@magizhnexgen.com</a></p>
              <p className="mt-1 text-sm sm:text-base break-words">Chennai, Tamil Nadu, India</p>
            </div>
          </Sec>
        </motion.article>
      </main>
      <Footer />
    </div>
  );
}
