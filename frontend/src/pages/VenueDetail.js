import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { venueAPI, bookingAPI, slotLockAPI, notificationAPI, paymentAPI, waitlistAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapPin, Star, Clock, IndianRupee, Zap, Users, Copy, Check, Lock, Loader2, Bell, BellOff, MessageSquare, Send, Globe, Share2, CalendarCheck, ListOrdered, Phone } from "lucide-react";

// Athlete imagery for empty states
const NO_SLOTS_IMG = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80";
import { format } from "date-fns";

function EnquiryForm({ venue }) {
  const [form, setForm] = useState({ name: "", phone: "", sport: venue.sports?.[0] || "", date: "", time: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone are required"); return; }
    setSubmitting(true);
    try {
      const res = await venueAPI.submitEnquiry(venue.id, form);
      setSent(true);
      if (res.data?.whatsapp_sent) {
        toast.success("Enquiry sent via WhatsApp!");
      } else {
        toast.success("Enquiry submitted! The venue will be notified.");
      }
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to send enquiry"); }
    finally { setSubmitting(false); }
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-12 text-center">
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-8">
          <Check className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="font-display text-xl font-black mb-2">Enquiry Sent!</h3>
          <p className="text-sm text-muted-foreground mb-4">Your enquiry has been sent to the venue owner. They will contact you soon.</p>
          <Button variant="outline" onClick={() => { setSent(false); setForm({ name: "", phone: "", sport: venue.sports?.[0] || "", date: "", time: "", message: "" }); }}>
            Send Another Enquiry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 md:px-6 py-8">
      <div className="rounded-2xl border-2 border-amber-500/30 bg-card/50 backdrop-blur-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Phone className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black">Enquire via WhatsApp</h3>
            <p className="text-xs text-muted-foreground">This venue accepts enquiries only. Fill the form to contact the owner.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Your Name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Rahul Kumar" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone Number *</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Sport</Label>
              <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                {(venue.sports || ["football"]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preferred Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Preferred Time</Label>
            <Input value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} placeholder="6:00 PM - 7:00 PM" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Message (optional)</Label>
            <Input value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Looking for a regular slot..." className="mt-1" />
          </div>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 gap-2" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</> : <><Send className="h-4 w-4" />Send Enquiry via WhatsApp</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VenueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [payMode, setPayMode] = useState("full");
  const [splitCount, setSplitCount] = useState(10);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmResult, setConfirmResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const lockRef = useRef(null);
  const [subscribedSlots, setSubscribedSlots] = useState(new Set());
  const [payStep, setPayStep] = useState(null); // null | "review" | "processing" | "done"
  const [subscribing, setSubscribing] = useState(null);

  // Waitlist state
  const [waitlistedSlots, setWaitlistedSlots] = useState({}); // slotKey -> entry
  const [waitlistLoading, setWaitlistLoading] = useState(null);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBookingId, setReviewBookingId] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    venueAPI.get(id).then(res => setVenue(res.data)).catch(() => toast.error("Venue not found")).finally(() => setLoading(false));
    loadReviews();
  }, [id]);

  const loadReviews = useCallback(() => {
    venueAPI.getReviews(id).then(res => setReviews(res.data)).catch(() => {});
    venueAPI.getReviewSummary(id).then(res => setReviewSummary(res.data)).catch(() => {});
    venueAPI.canReview(id).then(res => {
      setCanReview(res.data.can_review);
      setEligibleBookings(res.data.eligible_bookings || []);
      if (res.data.eligible_bookings?.length > 0) setReviewBookingId(res.data.eligible_bookings[0].id);
    }).catch(() => {});
  }, [id]);

  const handleSubmitReview = async () => {
    if (!reviewRating || !reviewBookingId) {
      toast.error("Please select a rating and booking");
      return;
    }
    setSubmittingReview(true);
    try {
      await venueAPI.createReview(id, { rating: reviewRating, comment: reviewComment, booking_id: reviewBookingId });
      toast.success("Review submitted! Thank you.");
      setReviewRating(0); setReviewComment(""); setShowReviewForm(false);
      loadReviews();
      venueAPI.get(id).then(res => setVenue(res.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit review");
    } finally { setSubmittingReview(false); }
  };

  const loadSlots = useCallback(() => {
    if (!id || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    venueAPI.getSlots(id, dateStr).then(res => setSlots(res.data?.slots || [])).catch(() => setSlots([]));
  }, [id, selectedDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Load user's notification subscriptions for this venue/date
  const loadSubscriptions = useCallback(() => {
    if (!id || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    notificationAPI.mySubscriptions({ venue_id: id, date: dateStr })
      .then(res => {
        const keys = new Set((res.data || []).map(s => `${s.start_time}-${s.turf_number}`));
        setSubscribedSlots(keys);
      })
      .catch(() => setSubscribedSlots(new Set()));
  }, [id, selectedDate]);

  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);

  // Load waitlist entries for this venue/date
  const loadWaitlist = useCallback(() => {
    if (!id || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    waitlistAPI.myWaitlist()
      .then(res => {
        const entries = {};
        (res.data || []).forEach(e => {
          if (e.venue_id === id && e.date === dateStr) {
            entries[`${e.start_time}-${e.turf_number}`] = e;
          }
        });
        setWaitlistedSlots(entries);
      })
      .catch(() => setWaitlistedSlots({}));
  }, [id, selectedDate]);

  useEffect(() => { loadWaitlist(); }, [loadWaitlist]);

  // Auto-refresh slots every 15s to see lock changes from other users
  useEffect(() => {
    const interval = setInterval(loadSlots, 15000);
    return () => clearInterval(interval);
  }, [loadSlots]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (lockRef.current) {
        slotLockAPI.unlock(lockRef.current).catch(() => {});
      }
    };
  }, []);

  const handleSlotSelect = async (slot) => {
    if (slot.status === "booked" || slot.status === "on_hold") return;

    // If we already have a lock on a different slot, release it
    if (lockRef.current &&
        (lockRef.current.start_time !== slot.start_time || lockRef.current.turf_number !== slot.turf_number)) {
      try { await slotLockAPI.unlock(lockRef.current); } catch {}
      lockRef.current = null;
      setLockInfo(null);
    }

    const lockData = {
      venue_id: id,
      date: format(selectedDate, "yyyy-MM-dd"),
      start_time: slot.start_time,
      turf_number: slot.turf_number,
    };

    setLocking(true);
    try {
      const res = await slotLockAPI.lock(lockData);
      lockRef.current = lockData;
      setLockInfo(res.data);
      toast.success(`Slot locked for ${res.data.lock_type === "soft" ? "10 min" : "30 min"}`);
      loadSlots();
    } catch (err) {
      const status = err.response?.status;
      // 409 = real conflict (slot booked or held by another user) — block booking
      if (status === 409) {
        toast.error(err.response?.data?.detail || "Slot unavailable");
        setLocking(false);
        return;
      }
      // Any other error (503, 520, network) — proceed without lock
      lockRef.current = null;
      setLockInfo(null);
    }
    setSelectedSlot(slot);
    setBookingDialog(true);
    setLocking(false);
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) { resolve(true); return; }
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    try {
      if (lockRef.current) {
        await slotLockAPI.extendLock(lockRef.current).catch(() => {});
      }
      const data = {
        venue_id: id, date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time, end_time: selectedSlot.end_time,
        turf_number: selectedSlot.turf_number, sport: venue?.sports?.[0] || "football",
        payment_mode: payMode,
      };
      if (payMode === "split") data.split_count = splitCount;
      const res = await bookingAPI.create(data);
      const booking = res.data;
      lockRef.current = null;
      setLockInfo(null);

      // Check if Razorpay payment is needed
      if (booking.payment_gateway === "razorpay" && booking.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setBookingLoading(false); return; }
        const options = {
          key: booking.razorpay_key_id,
          amount: booking.total_amount * 100,
          currency: "INR",
          order_id: booking.razorpay_order_id,
          name: venue?.name || "Horizon Sports",
          description: `${booking.start_time} - ${booking.end_time} | Turf ${booking.turf_number}`,
          handler: async (response) => {
            try {
              await paymentAPI.verifyPayment(booking.id, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              setConfirmResult({ ...booking, status: "confirmed" });
              setPayStep("done");
              toast.success("Payment successful! Booking confirmed.");
              loadSlots();
            } catch { toast.error("Payment verification failed"); }
            setBookingLoading(false);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setBookingLoading(false); } },
          theme: { color: "#3b82f6" }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return; // Don't setBookingLoading(false) here — handled in handler/ondismiss
      }

      // Test mode (no payment gateway) - show payment review step
      setPayStep("review");
      setConfirmResult(booking);
      toast.info("Review your payment details before confirming");
      loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDialogClose = (open) => {
    if (!open && payStep !== "processing") {
      if (!confirmResult || payStep === "review") {
        // Releasing lock when closing dialog without completing payment
        if (lockRef.current) {
          slotLockAPI.unlock(lockRef.current).catch(() => {});
          lockRef.current = null;
          setLockInfo(null);
          loadSlots();
        }
      }
      setSelectedSlot(null);
      setConfirmResult(null);
      setPayStep(null);
    }
    setBookingDialog(open);
  };

  const handleTestPayment = async () => {
    if (!confirmResult) return;
    setPayStep("processing");
    try {
      await bookingAPI.testConfirm(confirmResult.id);
      setPayStep("done");
      setConfirmResult({ ...confirmResult, status: "confirmed" });
      toast.success("Payment successful! Booking confirmed.");
      loadSlots();
      loadReviews(); // Refresh eligible bookings for reviews
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  };


  const copyLink = () => {
    const token = confirmResult?.split_config?.split_token;
    if (token) {
      navigator.clipboard.writeText(`${window.location.origin}/split/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Split link copied!");
    }
  };

  const handleNotifyMe = async (slot, e) => {
    e.stopPropagation();
    const slotKey = `${slot.start_time}-${slot.turf_number}`;
    const data = {
      venue_id: id,
      date: format(selectedDate, "yyyy-MM-dd"),
      start_time: slot.start_time,
      turf_number: slot.turf_number,
    };
    setSubscribing(slotKey);
    try {
      if (subscribedSlots.has(slotKey)) {
        await notificationAPI.unsubscribe(data);
        setSubscribedSlots(prev => { const n = new Set(prev); n.delete(slotKey); return n; });
        toast.success("Notification removed");
      } else {
        await notificationAPI.subscribe(data);
        setSubscribedSlots(prev => new Set(prev).add(slotKey));
        toast.success("You'll be notified when this slot opens up!");
      }
    } catch {
      toast.error("Failed to update notification");
    } finally {
      setSubscribing(null);
    }
  };

  const handleWaitlist = async (slot, e) => {
    e.stopPropagation();
    const slotKey = `${slot.start_time}-${slot.turf_number}`;
    setWaitlistLoading(slotKey);
    try {
      if (waitlistedSlots[slotKey]) {
        await waitlistAPI.leave(waitlistedSlots[slotKey].id);
        setWaitlistedSlots(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
        toast.success("Removed from waitlist");
      } else {
        const res = await waitlistAPI.join({
          venue_id: id,
          date: format(selectedDate, "yyyy-MM-dd"),
          start_time: slot.start_time,
          turf_number: slot.turf_number,
        });
        // Backend returns { message, position, entry: {...} } — store the entry with position
        const entry = res.data.entry || res.data;
        entry.position = res.data.position || entry.position;
        setWaitlistedSlots(prev => ({ ...prev, [slotKey]: entry }));
        toast.success(`Joined waitlist (Position #${res.data.position || "?"})`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update waitlist");
    } finally {
      setWaitlistLoading(null);
    }
  };

  const groupedSlots = {};
  slots.forEach(s => {
    const key = `Turf ${s.turf_number}`;
    if (!groupedSlots[key]) groupedSlots[key] = [];
    groupedSlots[key].push(s);
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );
  if (!venue) return <div className="p-6 text-center text-muted-foreground">Venue not found</div>;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6" data-testid="venue-detail">
      {/* Athletic Hero Section - Full Width */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="relative h-[400px] md:h-[500px] overflow-hidden">
          {/* Hero Image with Gradient Overlay */}
          <img
            src={mediaUrl(venue.images?.[0]) || "https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=1200&q=80"}
            alt={venue.name}
            className="w-full h-full object-cover"
          />
          {/* Athletic Gradient Overlay - Bottom to Top */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          {/* Hero Content - Bottom Aligned */}
          <div className="absolute inset-x-0 bottom-0 px-4 md:px-6 pb-8 md:pb-12">
            <div className="max-w-7xl mx-auto">
              {/* Sport Badges - Top Right with Glow */}
              <div className="flex items-center gap-2 mb-4">
                {venue.sports?.map(s => (
                  <Badge key={s} variant="athletic" className="uppercase text-xs">
                    {s}
                  </Badge>
                ))}
                <Badge className={`text-xs px-3 py-1 ${venue.badge === "bookable" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                  {venue.badge === "bookable" ? "Bookable" : "Enquiry Only"}
                </Badge>
              </div>

              {/* Venue Name - Large & Bold */}
              <div className="flex items-end justify-between gap-4 mb-6">
                <h1 className="font-display text-display-md md:text-display-lg font-black text-foreground tracking-athletic leading-none">
                  {venue.name}
                </h1>
                {venue.slug && (
                  <Link
                    to={`/venue/${venue.slug}`}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-background/90 backdrop-blur-md border-2 border-border/50 text-primary hover:border-primary/50 hover:scale-105 transition-all duration-300 font-bold text-sm"
                    title="View shareable public page"
                  >
                    <Globe className="h-4 w-4" />
                    Public Page
                  </Link>
                )}
              </div>

              {/* Location & Rating - Large Icons */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-base font-bold text-foreground/90">{venue.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                  <span className="text-lg font-display font-black text-foreground">{venue.rating?.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground font-semibold">({venue.total_reviews} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Info Cards - Athletic Style */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-2 gap-4 md:gap-6 mb-8">
            {/* Price Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-105 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <IndianRupee className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Base Price</div>
                  <div className="text-2xl font-display font-black text-primary">₹{venue.base_price}<span className="text-sm text-muted-foreground">/hr</span></div>
                </div>
              </div>
            </motion.div>

            {/* Hours Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-105 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Hours</div>
                  <div className="text-lg font-display font-black text-foreground">{venue.opening_hour}:00 - {venue.closing_hour}:00</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Description - Athletic Typography */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <p className="text-base text-muted-foreground leading-relaxed">{venue.description}</p>
          </motion.div>

          {/* Amenities - Athletic Badges */}
          {venue.amenities?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-10"
            >
              <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-bold mb-4">Amenities</h3>
              <div className="flex flex-wrap gap-3">
                {venue.amenities.map((a, idx) => (
                  <motion.div
                    key={a}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                  >
                    <Badge variant="athletic" className="text-xs px-4 py-2">
                      <Zap className="h-3 w-3 mr-1.5" />
                      {a}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Enquiry Form — shown for enquiry-badge venues */}
      {venue.badge === "enquiry" ? (
        <EnquiryForm venue={venue} />
      ) : (
      /* Booking Section - Athletic Style (only for bookable venues) */
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {/* Calendar - Athletic Card */}
          <div className="lg:col-span-4">
            <h2 className="font-display text-xl font-black mb-6 uppercase tracking-wide">Select Date</h2>
            <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 flex justify-center hover:border-primary/30 transition-colors duration-300">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="text-foreground"
                disabled={(d) => d < new Date(new Date().toDateString())}
                data-testid="venue-calendar"
              />
            </div>
          </div>

          {/* Slots - Athletic Grid */}
          <div className="lg:col-span-8">
            <h2 className="font-display text-xl font-black mb-6 uppercase tracking-wide">
              Available Slots - {format(selectedDate, "EEE, MMM d")}
            </h2>
            {Object.keys(groupedSlots).length === 0 ? (
              <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="p-10 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <CalendarCheck className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-display text-lg font-black mb-2">No Slots Available</p>
                    <p className="text-sm text-muted-foreground font-semibold">Try picking a different date to find open slots.</p>
                  </div>
                  <div className="hidden md:block relative min-h-[180px]">
                    <img
                      src={NO_SLOTS_IMG}
                      alt="Football field"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-card/70 to-transparent" />
                  </div>
                </div>
              </div>
            ) : (
              Object.entries(groupedSlots).map(([turf, turfSlots]) => (
                <div key={turf} className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    {turf}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {turfSlots.map((s, i) => {
                    const isSelected = selectedSlot?.start_time === s.start_time && selectedSlot?.turf_number === s.turf_number;
                    const isAvailable = s.status === "available";
                    const isOnHold = s.status === "on_hold";
                    const isLockedByMe = s.status === "locked_by_you";
                    const isBooked = s.status === "booked";
                    const canSelect = isAvailable || isLockedByMe;
                    const slotKey = `${s.start_time}-${s.turf_number}`;
                    const isSubscribed = subscribedSlots.has(slotKey);
                    const showNotify = isBooked || isOnHold;
                    return (
                      <motion.div
                        key={i}
                        className="relative"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                      >
                        <button
                          disabled={!canSelect || locking}
                          onClick={() => canSelect && handleSlotSelect(s)}
                          data-testid={`slot-${s.start_time}-turf-${s.turf_number}`}
                          className={`w-full min-h-[80px] p-4 rounded-xl text-center transition-all duration-300 border-2 relative group ${
                            isBooked
                              ? "bg-destructive/10 border-destructive/20 text-muted-foreground cursor-not-allowed opacity-60"
                              : isOnHold
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-not-allowed opacity-80"
                              : isLockedByMe
                              ? "bg-primary/20 border-primary text-primary shadow-glow-primary animate-glow-pulse"
                              : isSelected
                              ? "bg-primary/20 border-primary text-primary shadow-glow-primary animate-glow-pulse scale-105"
                              : "bg-card/50 border-border/50 backdrop-blur-md hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm cursor-pointer"
                          }`}
                        >
                          {/* Lock Icons */}
                          {isOnHold && <Lock className="h-4 w-4 absolute top-2 right-2 text-amber-400" />}
                          {isLockedByMe && <Lock className="h-4 w-4 absolute top-2 right-2 text-primary animate-pulse" />}

                          {/* Time - Large & Bold */}
                          <div className="text-sm font-display font-black uppercase tracking-wide">{s.start_time}</div>
                          <div className="text-xs text-muted-foreground font-semibold">{s.end_time}</div>

                          {/* Price - Athletic Typography */}
                          <div className={`text-base font-display font-black mt-2 ${
                            isBooked
                              ? "text-muted-foreground"
                              : isOnHold
                              ? "text-amber-400"
                              : isLockedByMe
                              ? "text-primary"
                              : isAvailable
                              ? "text-primary group-hover:scale-110 transition-transform"
                              : "text-muted-foreground"
                          }`}>
                            {isBooked ? "Booked" : isOnHold ? "On Hold" : `₹${s.price}`}
                          </div>
                        </button>
                        {/* Notify Me Button - Athletic Style */}
                        {showNotify && (
                          <button
                            onClick={(e) => handleNotifyMe(s, e)}
                            disabled={subscribing === slotKey}
                            data-testid={`notify-btn-${s.start_time}-turf-${s.turf_number}`}
                            className={`w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 border-2 ${
                              isSubscribed
                                ? "bg-primary/20 text-primary border-primary/50 hover:bg-primary/10 hover:scale-105"
                                : "bg-card/50 text-muted-foreground border-border/50 hover:text-primary hover:border-primary/50 hover:scale-105"
                            }`}
                          >
                            {subscribing === slotKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isSubscribed ? (
                              <><BellOff className="h-3.5 w-3.5" /> Watching</>
                            ) : (
                              <><Bell className="h-3.5 w-3.5" /> Notify Me</>
                            )}
                          </button>
                        )}
                        {/* Join Waitlist Button */}
                        {showNotify && (
                          <button
                            onClick={(e) => handleWaitlist(s, e)}
                            disabled={waitlistLoading === slotKey}
                            className={`w-full mt-1.5 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 border-2 ${
                              waitlistedSlots[slotKey]
                                ? "bg-violet-500/20 text-violet-400 border-violet-500/50 hover:bg-violet-500/10 hover:scale-105"
                                : "bg-card/50 text-muted-foreground border-border/50 hover:text-violet-400 hover:border-violet-500/50 hover:scale-105"
                            }`}
                          >
                            {waitlistLoading === slotKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : waitlistedSlots[slotKey] ? (
                              <><ListOrdered className="h-3.5 w-3.5" /> #{waitlistedSlots[slotKey].position || "?"} in Queue</>
                            ) : (
                              <><ListOrdered className="h-3.5 w-3.5" /> Join Waitlist</>
                            )}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

        {/* Slot Legend - Athletic Style */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-8 mb-6">
          <div className="flex flex-wrap gap-4 md:gap-6 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-card/50 border-2 border-border/50 backdrop-blur-md" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-primary/20 border-2 border-primary shadow-glow-sm" />
              <span className="text-primary">Your Lock</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-amber-500/10 border-2 border-amber-500/30" />
              <span className="text-amber-400">On Hold</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-destructive/10 border-2 border-destructive/20 opacity-60" />
              <span className="text-muted-foreground">Booked</span>
            </div>
          </div>
        </div>
      </div>

      )}

      {/* Reviews Section */}
      <div className="mt-10 border-t border-border pt-8" data-testid="reviews-section">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Reviews & Ratings</h2>
          </div>
          {canReview && !showReviewForm && (
            <Button size="sm" onClick={() => setShowReviewForm(true)}
              className="bg-primary text-primary-foreground text-xs font-bold" data-testid="write-review-btn">
              Write a Review
            </Button>
          )}
        </div>

        {/* Review Summary */}
        {reviewSummary && reviewSummary.total > 0 && (
          <div className="glass-card rounded-xl p-5 mb-6" data-testid="review-summary">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="text-center">
                <div className="font-display text-4xl font-black text-primary">{reviewSummary.avg_rating}</div>
                <div className="flex gap-0.5 justify-center mt-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`h-4 w-4 ${s <= Math.round(reviewSummary.avg_rating) ? "text-primary fill-primary" : "text-muted-foreground/50"}`} />
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{reviewSummary.total} review{reviewSummary.total !== 1 ? "s" : ""}</div>
              </div>
              <div className="flex-1 space-y-1.5 w-full">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = reviewSummary.distribution?.[star] || 0;
                  const pct = reviewSummary.total > 0 ? (count / reviewSummary.total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-muted-foreground font-mono">{star}</span>
                      <Star className="h-3 w-3 text-primary/50" />
                      <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-muted-foreground font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Write Review Form */}
        {showReviewForm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-5 mb-6" data-testid="review-form">
            <h3 className="font-bold text-sm mb-4">Your Review</h3>
            {/* Star Picker */}
            <div className="mb-4">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Rating</label>
              <div className="flex gap-1" data-testid="star-picker">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)}
                    onMouseEnter={() => setReviewHover(s)} onMouseLeave={() => setReviewHover(0)}
                    data-testid={`star-${s}`}
                    className="p-0.5 transition-transform hover:scale-110">
                    <Star className={`h-7 w-7 transition-colors ${s <= (reviewHover || reviewRating) ? "text-primary fill-primary" : "text-muted-foreground/50"}`} />
                  </button>
                ))}
                {reviewRating > 0 && <span className="text-xs text-muted-foreground ml-2 self-center">{["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}</span>}
              </div>
            </div>
            {/* Booking Selector */}
            {eligibleBookings.length > 1 && (
              <div className="mb-4">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">For Booking</label>
                <Select value={reviewBookingId} onValueChange={setReviewBookingId}>
                  <SelectTrigger className="h-9 text-xs bg-secondary/50" data-testid="review-booking-select">
                    <SelectValue placeholder="Select booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleBookings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.date} {b.start_time}-{b.end_time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Comment */}
            <div className="mb-4">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Comment (optional)</label>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                className="w-full h-20 px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="review-comment" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitReview} disabled={submittingReview || !reviewRating}
                className="bg-primary text-primary-foreground text-xs font-bold" data-testid="submit-review-btn">
                {submittingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Submit Review
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReviewForm(false)} className="text-xs">Cancel</Button>
            </div>
          </motion.div>
        )}

        {/* Review List */}
        {reviews.length === 0 && !showReviewForm ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-reviews">
            <Star className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm">No reviews yet. Be the first to review this venue!</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="reviews-list">
            {reviews.map((r, idx) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass-card rounded-lg p-4" data-testid={`review-card-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {r.user_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-foreground">{r.user_name}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-primary fill-primary" : "text-muted-foreground/40"}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {r.comment && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{r.comment}</p>}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Loading overlay for locking */}
      {locking && (
        <div className="fixed inset-0 z-50 bg-background/50 flex items-center justify-center">
          <div className="glass-card rounded-lg p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Locking slot...</span>
          </div>
        </div>
      )}

      {/* Booking Dialog - Athletic Style */}
      <Dialog open={bookingDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-card border-2 border-border/50 max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black uppercase tracking-wide text-foreground">
              {payStep === "done" || (confirmResult && !payStep) ? "Booking Confirmed!" :
               payStep === "processing" ? "Processing Payment..." :
               payStep === "review" ? "Complete Payment" :
               "Confirm Booking"}
            </DialogTitle>
          </DialogHeader>

          {/* Payment Processing State */}
          {payStep === "processing" && (
            <div className="flex flex-col items-center py-8 gap-4" data-testid="payment-processing">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">Confirming your booking...</p>
              <p className="text-xs text-muted-foreground/60">Please do not close this window</p>
            </div>
          )}

          {/* Payment Review State */}
          {payStep === "review" && confirmResult && (
            <div className="space-y-6" data-testid="payment-review">
              <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Venue</span>
                  <span className="font-display font-black text-base">{confirmResult.venue_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Date</span>
                  <span className="font-display font-black text-base">{confirmResult.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Time</span>
                  <span className="font-display font-black text-base">{confirmResult.start_time}-{confirmResult.end_time}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border/50">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Amount</span>
                  <span className="font-display font-black text-2xl text-primary">₹{confirmResult.total_amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Status</span>
                  <Badge variant="athletic">Awaiting Payment</Badge>
                </div>
              </div>

              {confirmResult.payment_gateway === "test" && (
                <div className="p-4 rounded-xl bg-sky-500/10 border-2 border-sky-500/20 text-sm text-sky-400 font-semibold">
                  Payment gateway is being configured. Please confirm to proceed.
                </div>
              )}

              {confirmResult.split_config && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 backdrop-blur-md p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-display text-base font-black">Split Payment</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-semibold">
                    Your share: <span className="text-primary font-black">₹{confirmResult.split_config.per_share}</span> ({confirmResult.split_config.total_shares} Lobbians)
                  </p>
                </div>
              )}

              <Button
                className="w-full h-14 bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 active:scale-100 font-black uppercase tracking-wide text-base transition-all duration-300"
                onClick={handleTestPayment}
                data-testid="confirm-payment-btn"
              >
                Confirm Payment ₹{confirmResult.split_config ? confirmResult.split_config.per_share : confirmResult.total_amount}
              </Button>
            </div>
          )}

          {/* Booking Confirmed State - Athletic Style */}
          {(payStep === "done" || (confirmResult && !payStep)) && confirmResult && (
            <div className="space-y-6" data-testid="booking-confirmed-view">
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 backdrop-blur-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Venue</span>
                  <span className="font-display font-black text-base">{confirmResult.venue_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Date</span>
                  <span className="font-display font-black text-base">{confirmResult.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Time</span>
                  <span className="font-display font-black text-base">{confirmResult.start_time}-{confirmResult.end_time}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border/50">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Amount</span>
                  <span className="font-display font-black text-2xl text-primary">₹{confirmResult.total_amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide text-muted-foreground font-bold">Status</span>
                  <Badge variant="athletic" className="shadow-glow-sm">{confirmResult.status}</Badge>
                </div>
              </div>
              {confirmResult.split_config && (
                <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-display text-base font-black">Split Payment Link</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-semibold mb-4">
                    Share this link with {confirmResult.split_config.total_shares - 1} friends. Each pays <span className="text-primary font-black">₹{confirmResult.split_config.per_share}</span>.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/split/${confirmResult.split_config.split_token}`}
                      className="bg-background/50 border-2 border-border/50 text-sm font-mono h-12 rounded-xl"
                      data-testid="split-link-input"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={copyLink}
                      data-testid="copy-split-link-btn"
                      className="h-12 w-12 rounded-xl border-2 hover:border-primary/50 hover:bg-primary/10"
                    >
                      {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold"
                onClick={() => { setBookingDialog(false); setConfirmResult(null); setSelectedSlot(null); setPayStep(null); loadSlots(); }}
                data-testid="booking-done-btn">Done</Button>
            </div>
          )}

          {/* Initial Booking Form (before any payment) */}
          {!confirmResult && selectedSlot && (
            <div className="space-y-4">
              {lockInfo && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20" data-testid="lock-status-banner">
                  <Lock className="h-4 w-4 text-primary shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-primary">Slot Locked</span>
                    <span className="text-muted-foreground"> - Reserved for you ({lockInfo.lock_type === "soft" ? "10 min" : "30 min"}). Other users see this as "On Hold".</span>
                  </div>
                </div>
              )}
              <div className="glass-card rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Venue</span><span className="font-bold">{venue.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span className="font-bold">{format(selectedDate, "EEE, MMM d yyyy")}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Slot</span><span className="font-bold">{selectedSlot.start_time}-{selectedSlot.end_time}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Turf</span><span className="font-bold">#{selectedSlot.turf_number}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Price</span><span className="font-bold text-primary text-lg">{"\u20B9"}{selectedSlot.price}</span></div>
              </div>

              <div>
                <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Payment Mode</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => setPayMode("full")} data-testid="pay-mode-full"
                    className={`p-3 rounded-lg border text-center transition-all ${payMode === "full" ? "border-primary bg-primary/10 text-primary" : "border-border glass-card"}`}>
                    <Zap className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">Full Payment</div>
                  </button>
                  <button onClick={() => setPayMode("split")} data-testid="pay-mode-split"
                    className={`p-3 rounded-lg border text-center transition-all ${payMode === "split" ? "border-primary bg-primary/10 text-primary" : "border-border glass-card"}`}>
                    <Users className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">Split Payment</div>
                  </button>
                </div>
              </div>

              {payMode === "split" && (
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Number of Lobbians</Label>
                  <Select value={String(splitCount)} onValueChange={v => setSplitCount(Number(v))}>
                    <SelectTrigger className="mt-2 bg-background border-border" data-testid="split-count-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 22].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} Lobbians ({"\u20B9"}{Math.floor(selectedSlot.price / n)}/each)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide h-11"
                onClick={handleBook} disabled={bookingLoading} data-testid="confirm-booking-btn">
                {bookingLoading ? "Processing..." : payMode === "split"
                  ? `Pay ${"\u20B9"}${Math.floor(selectedSlot.price / splitCount)} (Your Share)`
                  : `Pay ${"\u20B9"}${selectedSlot.price}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
