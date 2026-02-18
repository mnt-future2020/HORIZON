import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Clock, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) { toast.error("Please fill in all required fields"); return; }
    setSubmitted(true);
    toast.success("Message sent! We'll get back to you within 24 hours.");
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-background/90 backdrop-blur-xl border-b border-border">
        <Link to="/" className="font-display font-black text-lg tracking-tighter uppercase text-primary">HORIZON</Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link to="/about" className="hover:text-primary transition-colors">About</Link>
          <Link to="/venues" className="hover:text-primary transition-colors">Browse Venues</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <MessageSquare className="w-3.5 h-3.5" /> Contact Us
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-foreground mb-3">Get in Touch</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">Questions about your booking, venue listing, or anything else? We're here to help.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {[
              { icon: Mail, label: "Email", value: "support@magizhnexgen.com", href: "mailto:support@magizhnexgen.com" },
              { icon: Phone, label: "Phone", value: "+91 99999 99999", href: "tel:+919999999999" },
              { icon: MapPin, label: "Address", value: "Chennai, Tamil Nadu, India — 600001", href: null },
              { icon: Clock, label: "Support Hours", value: "Mon–Sat, 9 AM – 7 PM IST", href: null },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="glass-card rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                  {href ? <a href={href} className="text-sm text-foreground hover:text-primary transition-colors">{value}</a>
                    : <div className="text-sm text-foreground">{value}</div>}
                </div>
              </div>
            ))}
            <div className="glass-card rounded-xl p-5">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Legal Entity</div>
              <div className="text-sm text-foreground font-semibold">Magizh NexGen Technologies</div>
              <div className="text-xs text-muted-foreground mt-1">GST / CIN details available on request</div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {submitted ? (
              <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-bold text-xl">Message Received!</h3>
                <p className="text-muted-foreground text-sm">Our team will respond within 24 business hours.</p>
                <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>Send Another</Button>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 sm:p-8">
                <h2 className="font-bold text-lg mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name *</Label>
                      <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="mt-1 bg-background border-border" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email *</Label>
                      <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" className="mt-1 bg-background border-border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Booking issue, venue listing, etc." className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Message *</Label>
                    <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      placeholder="Describe your issue in detail..." rows={5}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground font-bold">Send Message</Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
