import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const Sec = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-display font-bold text-xl text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-background/95 backdrop-blur-xl border-b border-border">
        <Link to="/" className="font-display font-black text-lg tracking-tighter uppercase text-primary">HORIZON</Link>
        <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors">Contact Us</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <h1 className="font-display font-black text-4xl text-foreground mb-2">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: December 1, 2025 · Magizh NexGen Technologies</p>
        </div>
        <div className="glass-card rounded-2xl p-6 sm:p-10">
          <Sec title="1. Introduction">
            <p>Magizh NexGen Technologies ("MnT", "we", "us") operates HORIZON. This Privacy Policy explains how we collect, use, and protect your information when you use our Service. By using HORIZON, you agree to this policy.</p>
          </Sec>
          <Sec title="2. Information We Collect">
            <p><strong className="text-foreground">a) Information you provide:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email, and phone number during registration</li>
              <li>Sport preferences and skill level</li>
              <li>Payment info processed via Razorpay (we do not store card details)</li>
              <li>Venue details provided by venue owners</li>
            </ul>
            <p><strong className="text-foreground">b) Automatically collected:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Device and browser information</li>
              <li>Usage data and activity logs</li>
              <li>Location data only when you use "Near Me" search (with explicit permission)</li>
            </ul>
          </Sec>
          <Sec title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1">
              <li>To process bookings and payments</li>
              <li>To match Lobbians via AI matchmaking</li>
              <li>To send booking confirmations and reminders</li>
              <li>To improve and personalise the platform</li>
              <li>To comply with legal obligations</li>
            </ul>
          </Sec>
          <Sec title="4. Payment Information">
            <p>All payments are processed by <strong className="text-foreground">Razorpay</strong> (PCI-DSS compliant). We do not store card details. See <a href="https://razorpay.com/privacy/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Razorpay's Privacy Policy</a>.</p>
          </Sec>
          <Sec title="5. Data Sharing">
            <p>We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Venue Owners:</strong> Name and contact for confirmed bookings only</li>
              <li><strong className="text-foreground">Razorpay:</strong> For payment processing</li>
              <li><strong className="text-foreground">Legal Authorities:</strong> When required by law</li>
            </ul>
          </Sec>
          <Sec title="6. Data Retention">
            <p>Data is retained while your account is active. Booking records are kept for 3 years. You may request deletion by contacting us.</p>
          </Sec>
          <Sec title="7. Your Rights">
            <p>You have the right to access, correct, or delete your personal data. Contact <a href="mailto:privacy@magizhnexgen.com" className="text-primary hover:underline">privacy@magizhnexgen.com</a>.</p>
          </Sec>
          <Sec title="8. Security">
            <p>We use HTTPS, hashed passwords, and JWT authentication. No system is 100% secure, but we follow industry best practices.</p>
          </Sec>
          <Sec title="9. Contact">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p><strong className="text-foreground">Magizh NexGen Technologies</strong></p>
              <p>Email: <a href="mailto:privacy@magizhnexgen.com" className="text-primary hover:underline">privacy@magizhnexgen.com</a></p>
              <p>Chennai, Tamil Nadu, India</p>
            </div>
          </Sec>
        </div>
      </div>
      <Footer />
    </div>
  );
}
