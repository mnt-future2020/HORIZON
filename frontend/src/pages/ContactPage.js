import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { contactAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import {
  Mail, Phone, MapPin, Clock, MessageSquare,
  CheckCircle2, Loader2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await contactAPI.submit(form);
      setSubmitted(true);
      toast.success("Message sent! We'll get back to you within 24 hours.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const contactInfo = [
    { icon: Mail, label: "Email", value: "support@magizhnexgen.com", href: "mailto:support@magizhnexgen.com" },
    { icon: Phone, label: "Phone", value: "+91 99999 99999", href: "tel:+919999999999" },
    { icon: MapPin, label: "Address", value: "Chennai, Tamil Nadu, India — 600001" },
    { icon: Clock, label: "Support Hours", value: "Mon–Sat, 9 AM – 7 PM IST" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c0a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
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
      <div className="pt-32 pb-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-xs font-bold tracking-widest uppercase mb-6">
              <MessageSquare className="w-3.5 h-3.5" />
              Contact Us
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-6">
              <span className="block text-white font-sans">GET IN</span>
              <span className="block text-brand-600 font-brier">Touch</span>
            </h1>
            <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto">
              Questions about bookings, venue listings, coaching, or tournaments? We're here to help.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Contact Info Cards */}
          <motion.div
            className="lg:col-span-2 space-y-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {contactInfo.map(({ icon: Icon, label, value, href }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                className="rounded-xl p-5 flex items-start gap-4 bg-white/5 border border-white/10 hover:border-brand-600/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0 group-hover:bg-brand-600/20 transition-colors">
                  <Icon className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <div className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">{label}</div>
                  {href ? (
                    <a href={href} className="text-sm text-white hover:text-brand-400 transition-colors">{value}</a>
                  ) : (
                    <div className="text-sm text-white/80">{value}</div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Legal Entity */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10"
            >
              <div className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-2">Legal Entity</div>
              <div className="text-sm text-white font-semibold">Magizh NexGen Technologies</div>
              <div className="text-xs text-white/40 mt-1">GST / CIN details available on request</div>
            </motion.div>
          </motion.div>

          {/* Form */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {submitted ? (
              <div className="rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4 bg-white/5 border border-white/10 min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-brand-600/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-brand-400" />
                </div>
                <h3 className="font-black text-2xl uppercase">Message Received!</h3>
                <p className="text-white/50 text-sm">Our team will respond within 24 business hours.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="mt-4 px-6 py-2.5 rounded-full border border-white/20 text-white text-sm font-bold hover:border-brand-600/50 transition-colors"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-6 sm:p-8 bg-white/5 border border-white/10">
                <h2 className="font-black text-xl uppercase tracking-wide mb-6 flex items-center gap-3">
                  <span className="w-8 h-0.5 bg-brand-600" />
                  Send us a message
                </h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Name *</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Your name"
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/30 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/30 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Subject</label>
                    <input
                      value={form.subject}
                      onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="Booking issue, venue listing, etc."
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Message *</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Describe your issue in detail..."
                      rows={5}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-brand-600/50 focus:ring-1 focus:ring-brand-600/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-600 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <>Send Message <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
