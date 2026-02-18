import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { venueAPI, bookingAPI, slotLockAPI, notificationAPI, paymentAPI } from "@/lib/api";
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
import { MapPin, Star, Clock, IndianRupee, Zap, Users, Copy, Check, Lock, Loader2, Bell, BellOff, MessageSquare, Send, Globe, Share2 } from "lucide-react";
import { format } from "date-fns";

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
  const [mockPayStep, setMockPayStep] = useState(null); // null | "review" | "processing" | "done"
  const [subscribing, setSubscribing] = useState(null);

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
              setMockPayStep("done");
              toast.success("Payment successful! Booking confirmed.");
              loadSlots();
            } catch { toast.error("Payment verification failed"); }
            setBookingLoading(false);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setBookingLoading(false); } },
          theme: { color: "#10B981" }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return; // Don't setBookingLoading(false) here — handled in handler/ondismiss
      }

      // Mock payment - show payment review step instead of auto-confirming
      setMockPayStep("review");
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
    if (!open && mockPayStep !== "processing") {
      if (!confirmResult || mockPayStep === "review") {
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
      setMockPayStep(null);
    }
    setBookingDialog(open);
  };

  const handleMockPayment = async () => {
    if (!confirmResult) return;
    setMockPayStep("processing");
    try {
      await bookingAPI.mockConfirm(confirmResult.id);
      setMockPayStep("done");
      setConfirmResult({ ...confirmResult, status: "confirmed" });
      toast.success("Payment successful! Booking confirmed.");
      loadSlots();
      loadReviews(); // Refresh eligible bookings for reviews
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setMockPayStep("review");
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
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="venue-detail">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative h-48 md:h-64 rounded-lg overflow-hidden mb-6">
          <img src={venue.images?.[0] || "https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=1200&q=80"}
            alt={venue.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              {venue.sports?.map(s => <Badge key={s} className="bg-primary/80 text-primary-foreground text-[10px]">{s}</Badge>)}
            </div>
            <div className="flex items-end justify-between gap-2">
              <h1 className="font-display text-2xl md:text-3xl font-black text-foreground">{venue.name}</h1>
              {venue.slug && (
                <Link
                  to={`/venue/${venue.slug}`}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm text-primary hover:bg-background/95 transition-colors"
                  title="View shareable public page"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Public Page
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-lg p-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{venue.address}</span>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-xs text-foreground font-bold">{venue.rating?.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({venue.total_reviews} reviews)</span>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-foreground font-bold">{venue.base_price}/hr</span>
          </div>
          <div className="glass-card rounded-lg p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-400 shrink-0" />
            <span className="text-xs text-muted-foreground">{venue.opening_hour}:00 - {venue.closing_hour}:00</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{venue.description}</p>

        {venue.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {venue.amenities.map(a => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
          </div>
        )}
      </motion.div>

      {/* Booking Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-4">
          <h2 className="font-display text-lg font-bold mb-4">Select Date</h2>
          <div className="glass-card rounded-lg p-4 flex justify-center">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)}
              className="text-foreground" disabled={(d) => d < new Date(new Date().toDateString())}
              data-testid="venue-calendar" />
          </div>
        </div>

        {/* Slots */}
        <div className="lg:col-span-8">
          <h2 className="font-display text-lg font-bold mb-4">
            Available Slots - {format(selectedDate, "EEE, MMM d")}
          </h2>
          {Object.keys(groupedSlots).length === 0 ? (
            <div className="glass-card rounded-lg p-8 text-center text-muted-foreground text-sm">No slots available</div>
          ) : (
            Object.entries(groupedSlots).map(([turf, turfSlots]) => (
              <div key={turf} className="mb-6">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 block">{turf}</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
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
                      <div key={i} className="relative">
                        <button disabled={!canSelect || locking}
                          onClick={() => canSelect && handleSlotSelect(s)}
                          data-testid={`slot-${s.start_time}-turf-${s.turf_number}`}
                          className={`w-full p-2.5 rounded-lg text-center transition-all border relative ${
                            isBooked ? "bg-destructive/10 border-destructive/20 text-muted-foreground cursor-not-allowed" :
                            isOnHold ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-not-allowed" :
                            isLockedByMe ? "bg-primary/20 border-primary text-primary ring-1 ring-primary/50" :
                            isSelected ? "bg-primary/20 border-primary text-primary" :
                            "glass-card hover:border-primary/30 cursor-pointer"
                          }`}>
                          {isOnHold && <Lock className="h-3 w-3 absolute top-1 right-1 text-amber-400" />}
                          {isLockedByMe && <Lock className="h-3 w-3 absolute top-1 right-1 text-primary" />}
                          <div className="text-xs font-bold">{s.start_time}</div>
                          <div className="text-[10px] text-muted-foreground">{s.end_time}</div>
                          <div className={`text-xs font-display font-bold mt-1 ${
                            isBooked ? "text-muted-foreground" :
                            isOnHold ? "text-amber-400" :
                            isLockedByMe ? "text-primary" :
                            isAvailable ? "text-primary" : "text-muted-foreground"
                          }`}>
                            {isBooked ? "Booked" : isOnHold ? "On Hold" : `\u20B9${s.price}`}
                          </div>
                        </button>
                        {showNotify && (
                          <button
                            onClick={(e) => handleNotifyMe(s, e)}
                            disabled={subscribing === slotKey}
                            data-testid={`notify-btn-${s.start_time}-turf-${s.turf_number}`}
                            className={`w-full mt-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
                              isSubscribed
                                ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/10"
                                : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground hover:border-primary/30"
                            }`}>
                            {subscribing === slotKey ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : isSubscribed ? (
                              <><BellOff className="h-2.5 w-2.5" /> Watching</>
                            ) : (
                              <><Bell className="h-2.5 w-2.5" /> Notify Me</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Slot Legend */}
      <div className="flex flex-wrap gap-4 mt-6 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded glass-card border border-border" /> Available</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20 border border-primary" /> Your Lock</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/30" /> On Hold</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/20" /> Booked</div>
      </div>

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
                    <Star key={s} className={`h-4 w-4 ${s <= Math.round(reviewSummary.avg_rating) ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
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
                    <Star className={`h-7 w-7 transition-colors ${s <= (reviewHover || reviewRating) ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
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
            <Star className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
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
                            <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-primary fill-primary" : "text-muted-foreground/20"}`} />
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

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              {mockPayStep === "done" || (confirmResult && !mockPayStep) ? "Booking Confirmed!" :
               mockPayStep === "processing" ? "Processing Payment..." :
               mockPayStep === "review" ? "Complete Payment" :
               "Confirm Booking"}
            </DialogTitle>
          </DialogHeader>

          {/* Mock Payment Processing State */}
          {mockPayStep === "processing" && (
            <div className="flex flex-col items-center py-8 gap-4" data-testid="mock-payment-processing">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">Verifying payment with gateway...</p>
              <p className="text-xs text-muted-foreground/60">Please do not close this window</p>
            </div>
          )}

          {/* Mock Payment Review State - user must click to confirm */}
          {mockPayStep === "review" && confirmResult && (
            <div className="space-y-4" data-testid="mock-payment-review">
              <div className="glass-card rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Venue</span><span className="font-bold">{confirmResult.venue_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span className="font-bold">{confirmResult.date}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Time</span><span className="font-bold">{confirmResult.start_time}-{confirmResult.end_time}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-primary text-lg">{"\u20B9"}{confirmResult.total_amount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><Badge variant="secondary">Awaiting Payment</Badge></div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                This is a simulated payment for demo purposes. In production, you will be redirected to Razorpay.
              </div>
              {confirmResult.split_config && (
                <div className="glass-card rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Split Payment</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your share: {"\u20B9"}{confirmResult.split_config.per_share} ({confirmResult.split_config.total_shares} players)
                  </p>
                </div>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide h-11"
                onClick={handleMockPayment} data-testid="mock-confirm-payment-btn">
                Confirm Payment {"\u20B9"}{confirmResult.split_config ? confirmResult.split_config.per_share : confirmResult.total_amount}
              </Button>
            </div>
          )}

          {/* Booking Confirmed State */}
          {(mockPayStep === "done" || (confirmResult && !mockPayStep)) && confirmResult && (
            <div className="space-y-4" data-testid="booking-confirmed-view">
              <div className="glass-card rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Venue</span><span className="font-bold">{confirmResult.venue_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span className="font-bold">{confirmResult.date}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Time</span><span className="font-bold">{confirmResult.start_time}-{confirmResult.end_time}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-primary">{"\u20B9"}{confirmResult.total_amount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><Badge>{confirmResult.status}</Badge></div>
              </div>
              {confirmResult.split_config && (
                <div className="glass-card rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Split Payment Link</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Share this link with {confirmResult.split_config.total_shares - 1} friends. Each pays {"\u20B9"}{confirmResult.split_config.per_share}.
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly value={`${window.location.origin}/split/${confirmResult.split_config.split_token}`}
                      className="bg-background border-border text-xs" data-testid="split-link-input" />
                    <Button size="icon" variant="outline" onClick={copyLink} data-testid="copy-split-link-btn">
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold"
                onClick={() => { setBookingDialog(false); setConfirmResult(null); setSelectedSlot(null); setMockPayStep(null); loadSlots(); }}
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
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Number of Players</Label>
                  <Select value={String(splitCount)} onValueChange={v => setSplitCount(Number(v))}>
                    <SelectTrigger className="mt-2 bg-background border-border" data-testid="split-count-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 22].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} players ({"\u20B9"}{Math.floor(selectedSlot.price / n)}/each)</SelectItem>
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
              <p className="text-[10px] text-center text-muted-foreground">Payment is MOCKED for demo purposes</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
