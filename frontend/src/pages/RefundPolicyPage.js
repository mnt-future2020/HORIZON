import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

const Sec = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-display font-bold text-xl text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-background/90 backdrop-blur-xl border-b border-border">
        <Link to="/" className="font-display font-black text-lg tracking-tighter uppercase text-primary">HORIZON</Link>
        <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors">Contact Us</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <h1 className="font-display font-black text-4xl text-foreground mb-2">Cancellation & Refund Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: December 1, 2025 · Magizh NexGen Technologies</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="glass-card rounded-xl p-4 border-l-4 border-green-500">
            <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
            <div className="text-sm font-bold">Full Refund</div>
            <div className="text-xs text-muted-foreground mt-1">Cancelled 24+ hrs before slot</div>
          </div>
          <div className="glass-card rounded-xl p-4 border-l-4 border-yellow-500">
            <Clock className="w-5 h-5 text-yellow-500 mb-2" />
            <div className="text-sm font-bold">50% Refund</div>
            <div className="text-xs text-muted-foreground mt-1">Cancelled 4–24 hrs before slot</div>
          </div>
          <div className="glass-card rounded-xl p-4 border-l-4 border-red-500">
            <XCircle className="w-5 h-5 text-red-500 mb-2" />
            <div className="text-sm font-bold">No Refund</div>
            <div className="text-xs text-muted-foreground mt-1">Cancelled &lt;4 hrs before slot</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-10">
          <Sec title="1. Cancellation by Player">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left p-3 rounded-tl-lg font-semibold text-foreground">Cancellation Time</th>
                    <th className="text-left p-3 font-semibold text-foreground">Refund</th>
                    <th className="text-left p-3 rounded-tr-lg font-semibold text-foreground">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["More than 24 hours before slot", "100%", "5–7 business days"],
                    ["4 to 24 hours before slot", "50%", "5–7 business days"],
                    ["Less than 4 hours before slot", "No refund", "—"],
                    ["No-show", "No refund", "—"],
                  ].map(([t, r, p]) => (
                    <tr key={t} className="border-t border-border">
                      <td className="p-3">{t}</td>
                      <td className="p-3 font-medium text-foreground">{r}</td>
                      <td className="p-3">{p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sec>
          <Sec title="2. Cancellation by Venue">
            <p>If a venue cancels a confirmed booking, the player receives a <strong className="text-foreground">100% refund</strong> regardless of timing.</p>
          </Sec>
          <Sec title="3. How to Cancel">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Login to HORIZON → Player Dashboard → Bookings</li>
              <li>Select the booking and click "Cancel Booking"</li>
            </ol>
            <p>Or email <a href="mailto:support@magizhnexgen.com" className="text-primary hover:underline">support@magizhnexgen.com</a> with your booking ID.</p>
          </Sec>
          <Sec title="4. Refund Method">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Credit/Debit Cards:</strong> 5–7 business days</li>
              <li><strong className="text-foreground">UPI / Net Banking:</strong> 3–5 business days</li>
              <li><strong className="text-foreground">Wallets:</strong> 1–3 business days</li>
            </ul>
            <p>All refunds are processed via <strong className="text-foreground">Razorpay</strong>.</p>
          </Sec>
          <Sec title="5. Split Payment Bookings">
            <p>Refunds for split payments are issued proportionally to each participant who paid. Unpaid split slots that expire incur no charges.</p>
          </Sec>
          <Sec title="6. Non-Refundable Situations">
            <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <ul className="list-disc pl-4 space-y-1">
                <li>Cancellations within 4 hours of slot time</li>
                <li>No-shows</li>
                <li>Accounts terminated for policy violations</li>
                <li>External factors (weather) outside venue control</li>
              </ul>
            </div>
          </Sec>
          <Sec title="7. Disputes">
            <p>Contact <a href="mailto:support@magizhnexgen.com" className="text-primary hover:underline">support@magizhnexgen.com</a> within 7 days of booking with your booking ID. We resolve all disputes within 10 business days.</p>
          </Sec>
          <Sec title="8. Contact">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p><strong className="text-foreground">Magizh NexGen Technologies</strong></p>
              <p>Email: <a href="mailto:support@magizhnexgen.com" className="text-primary hover:underline">support@magizhnexgen.com</a></p>
            </div>
          </Sec>
        </div>
      </div>
      <Footer />
    </div>
  );
}
