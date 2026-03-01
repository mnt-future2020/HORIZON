import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

const Sec = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-display font-bold text-xl text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-background/95 backdrop-blur-xl border-b border-border">
        <Link to="/" className="font-display font-black text-lg tracking-tighter uppercase text-primary">HORIZON</Link>
        <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors">Contact Us</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <h1 className="font-display font-black text-4xl text-foreground mb-2">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: December 1, 2025 · Magizh NexGen Technologies</p>
        </div>
        <div className="rounded-[24px] bg-card border border-border/40 shadow-sm p-6 sm:p-10">
          <Sec title="1. Acceptance of Terms">
            <p>By accessing HORIZON operated by Magizh NexGen Technologies, you agree to be bound by these Terms. If you disagree, please do not use our Service.</p>
          </Sec>
          <Sec title="2. Description of Service">
            <p>HORIZON enables Lobbians to discover and book sports facilities, venue owners to manage and monetise facilities, coaches to offer training, and Lobbians to find opponents via AI matchmaking.</p>
          </Sec>
          <Sec title="3. User Accounts">
            <p>You are responsible for maintaining account confidentiality and for all activities under your account. Provide accurate registration information. We may suspend accounts that violate these terms.</p>
          </Sec>
          <Sec title="4. Booking Terms">
            <p><strong className="text-foreground">4.1 Reservation:</strong> A temporary slot lock is placed for up to 30 minutes to complete payment. Unpaid bookings are auto-cancelled.</p>
            <p><strong className="text-foreground">4.2 Payment:</strong> Full payment is required to confirm a booking.</p>
            <p><strong className="text-foreground">4.3 Split Payments:</strong> Multiple Lobbians may split booking costs. Confirmation requires all participants to pay.</p>
          </Sec>
          <Sec title="5. Cancellation & Refunds">
            <p>See our <Link to="/refund-policy" className="text-primary hover:underline">Cancellation and Refund Policy</Link> for full details.</p>
          </Sec>
          <Sec title="6. Venue Owner Obligations">
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate venue information and availability</li>
              <li>Honour all confirmed bookings made via HORIZON</li>
              <li>Maintain facilities in a safe condition</li>
              <li>Comply with all applicable local regulations</li>
            </ul>
          </Sec>
          <Sec title="7. Prohibited Activities">
            <ul className="list-disc pl-5 space-y-1">
              <li>Use for illegal or unauthorised purposes</li>
              <li>Manipulating rating or matchmaking systems</li>
              <li>Posting false or misleading reviews</li>
              <li>Reselling booked slots without written consent</li>
            </ul>
          </Sec>
          <Sec title="8. Limitation of Liability">
            <p>MnT is not liable for injuries at facilities, loss of revenue, or actions of third parties. Total liability is capped at the amount paid for the specific booking.</p>
          </Sec>
          <Sec title="9. Governing Law">
            <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu.</p>
          </Sec>
          <Sec title="10. Contact">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p><strong className="text-foreground">Magizh NexGen Technologies</strong></p>
              <p>Email: <a href="mailto:legal@magizhnexgen.com" className="text-primary hover:underline">legal@magizhnexgen.com</a></p>
              <p>Chennai, Tamil Nadu, India</p>
            </div>
          </Sec>
        </div>
      </div>
      <Footer />
    </div>
  );
}
