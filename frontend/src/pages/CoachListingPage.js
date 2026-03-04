import { useState, useEffect } from "react";
import { Link, useNavigate as useNav, useSearchParams } from "react-router-dom";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useAuth } from "@/contexts/AuthContext";
import { coachingAPI, paymentAPI } from "@/lib/api";
import { mediaUrl, fmt12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  GraduationCap, Search, Star, MapPin, IndianRupee, Clock,
  Calendar, ChevronRight, Filter, X, QrCode, Loader2, Package,
  CheckCircle, Users
} from "lucide-react";
import { CoachListingSkeleton } from "@/components/SkeletonLoader";

const SPORTS = ["all", "football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table_tennis", "swimming"];
const COACH_PLACEHOLDER = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80";

function CoachCard({ coach, onBook, delay = 0 }) {
  const nav = useNav();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={() => nav(`/player-card/${coach.id}`)}
      className="rounded-[28px] border border-border/40 bg-card shadow-sm p-4 sm:p-5 hover:border-brand-600/40 hover:shadow-md transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-14 h-14 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
          <img
            src={mediaUrl(coach.avatar) || COACH_PLACEHOLDER}
            alt={coach.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-base sm:text-base md:text-lg text-foreground truncate group-hover:text-brand-600 transition-colors">
              {coach.name}
            </h3>
            {coach.avg_rating > 0 && (
              <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">
                <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" />
                {coach.avg_rating.toFixed(1)}
              </Badge>
            )}
          </div>
          {coach.coaching_bio && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{coach.coaching_bio}</p>
          )}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {coach.coaching_sports?.map(s => (
              <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>
            ))}
            {coach.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />{coach.city}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <div className="font-bold text-lg sm:text-lg text-brand-600">
            ₹{coach.session_price || 500}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {coach.session_duration_minutes || 60} min
          </div>
          <button
            onClick={e => { e.stopPropagation(); onBook(coach); }}
            className="mt-1 text-[11px] admin-btn px-4 py-2 h-9 rounded-full bg-brand-600/10 border border-brand-600/25 text-brand-600 hover:bg-brand-600 hover:text-white transition-colors"
          >
            Book
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CoachListingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  useScrollRestoration("coaching", !loading);
  const [searchQ, setSearchQ] = useState(searchParams.get("q") || "");
  const [sportFilter, setSportFilter] = useState(searchParams.get("sport") || "all");
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [coachSlots, setCoachSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingSport, setBookingSport] = useState("badminton");
  const [booking, setBooking] = useState(false);
  // My sessions
  const [mySessions, setMySessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [bookingTab, setBookingTab] = useState("session"); // "session" | "packages"
  const [qrLoading, setQrLoading] = useState(false);
  // Packages & subscriptions
  const [coachPackages, setCoachPackages] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [subscribing, setSubscribing] = useState(false);
  // Payment review flow (matches venue booking pattern)
  const [payStep, setPayStep] = useState(null); // null | "review" | "processing" | "done"
  const [pendingSession, setPendingSession] = useState(null);
  const [pendingSubPkg, setPendingSubPkg] = useState(null);

  useEffect(() => {
    coachingAPI.listCoaches({}).then(res => {
      const list = res.data || [];
      setCoaches(list);

    }).catch(() => {}).finally(() => setLoading(false));
    coachingAPI.listSessions({}).then(res => setMySessions(res.data || [])).catch(() => {});
    coachingAPI.mySubscriptions().then(r => setMySubscriptions(r.data || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filter state to URL so browser back/forward restores filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (sportFilter !== "all") params.set("sport", sportFilter);
    setSearchParams(params, { replace: true });
  }, [searchQ, sportFilter, setSearchParams]);

  // Auto-select sport when slot changes (use slot's sports, fallback to coach sports)
  useEffect(() => {
    if (!selectedSlot || !selectedCoach) return;
    const slotSports = selectedSlot.sports?.length > 0
      ? selectedSlot.sports
      : (selectedCoach.coaching_sports?.length > 0 ? selectedCoach.coaching_sports : []);
    if (slotSports.length > 0) setBookingSport(slotSports[0]);
  }, [selectedSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSlots = async (coachId, date) => {
    setSlotsLoading(true);
    try {
      const res = await coachingAPI.getCoachSlots(coachId, date);
      setCoachSlots(res.data?.slots || res.data || []);
    } catch { setCoachSlots([]); }
    setSlotsLoading(false);
  };

  const handleSelectCoach = (coach) => {
    setSelectedCoach(coach);
    setSelectedSlot(null);
    setBookingNotes("");
    setBookingSport(coach.coaching_sports?.[0] || "badminton");
    loadSlots(coach.id, selectedDate);
    coachingAPI.getCoachPackages(coach.id).then(r => setCoachPackages(r.data || [])).catch(() => setCoachPackages([]));
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedCoach) loadSlots(selectedCoach.id, date);
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

  const handleSubscribe = async (pkg) => {
    setSubscribing(true);
    try {
      const res = await coachingAPI.subscribe(pkg.id);
      const sub = res.data;

      if (sub.payment_gateway === "razorpay" && sub.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setSubscribing(false); return; }
        const options = {
          key: sub.razorpay_key_id,
          amount: sub.price * 100,
          currency: "INR",
          order_id: sub.razorpay_order_id,
          name: pkg.coach_name || "Coaching Package",
          description: `${pkg.name} - ${pkg.sessions_per_month} sessions/month`,
          handler: async (response) => {
            try {
              await coachingAPI.verifySubPayment(sub.id, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Subscribed successfully!");
              coachingAPI.mySubscriptions().then(r => setMySubscriptions(r.data || [])).catch(() => {});
              if (selectedCoach) coachingAPI.getCoachPackages(selectedCoach.id).then(r => setCoachPackages(r.data || [])).catch(() => {});
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled") },
          theme: { color: "#10B981" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else if (sub.payment_gateway === "test") {
        setPendingSubPkg({ ...pkg, sub_id: sub.id, sub_price: sub.price || pkg.price });
        setPayStep("review");
      }
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to subscribe"); }
    setSubscribing(false);
  };

  const handleTestSubPayment = async () => {
    if (!pendingSubPkg) return;
    setPayStep("processing");
    try {
      await coachingAPI.testConfirmSub(pendingSubPkg.sub_id);
      setPayStep("done");
      toast.success("Subscribed successfully!");
      coachingAPI.mySubscriptions().then(r => setMySubscriptions(r.data || [])).catch(() => {});
      if (selectedCoach) coachingAPI.getCoachPackages(selectedCoach.id).then(r => setCoachPackages(r.data || [])).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  };

  const handleCancelSub = async (subId) => {
    try {
      await coachingAPI.cancelSubscription(subId);
      toast.success("Subscription cancelled");
      coachingAPI.mySubscriptions().then(r => setMySubscriptions(r.data || [])).catch(() => {});
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleBook = async () => {
    if (!selectedCoach || !selectedSlot) return;
    setBooking(true);
    try {
      const res = await coachingAPI.bookSession({
        coach_id: selectedCoach.id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        sport: bookingSport,
        notes: bookingNotes,
      });
      const session = res.data;

      if (session.booked_from_package) {
        toast.success(`Session booked from package! ${session.sessions_remaining} sessions remaining.`);
        setSelectedCoach(null);
        setSelectedSlot(null);
        const r = await coachingAPI.listSessions({});
        setMySessions(r.data || []);
        setBooking(false);
        return;
      }

      if (session.payment_gateway === "razorpay" && session.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setBooking(false); return; }
        const options = {
          key: session.razorpay_key_id,
          amount: session.price * 100,
          currency: "INR",
          order_id: session.razorpay_order_id,
          name: selectedCoach.name || "Coaching Session",
          description: `${session.sport} session on ${session.date} at ${session.start_time}`,
          handler: async (response) => {
            try {
              await coachingAPI.verifyPayment(session.id, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment successful! Session confirmed.");
              setSelectedCoach(null);
              setSelectedSlot(null);
              const r = await coachingAPI.listSessions({});
              setMySessions(r.data || []);
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled. Session is pending.") },
          theme: { color: "#10B981" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else if (session.payment_gateway === "test") {
        setPendingSession(session);
        setPayStep("review");
      } else {
        toast.success("Session booked! The coach has been notified.");
        setSelectedCoach(null);
        setSelectedSlot(null);
        const r = await coachingAPI.listSessions({});
        setMySessions(r.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to book session");
    }
    setBooking(false);
  };

  const handleTestSessionPayment = async () => {
    if (!pendingSession) return;
    setPayStep("processing");
    try {
      await coachingAPI.testConfirm(pendingSession.id);
      setPayStep("done");
      toast.success("Payment successful! Session confirmed.");
      setSelectedCoach(null);
      setSelectedSlot(null);
      const r = await coachingAPI.listSessions({});
      setMySessions(r.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  };

  const closePaymentReview = () => {
    setPayStep(null);
    setPendingSession(null);
    setPendingSubPkg(null);
  };

  const handleCancelSession = async (id) => {
    try {
      await coachingAPI.cancelSession(id);
      toast.success("Session cancelled");
      setMySessions(prev => prev.map(s => s.id === id ? { ...s, status: "cancelled" } : s));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleReviewSession = async (id, rating, review) => {
    try {
      await coachingAPI.reviewSession(id, { rating, review });
      toast.success("Review submitted!");
      setMySessions(prev => prev.map(s => s.id === id ? { ...s, rating, review } : s));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleGetQR = async (bookingId) => {
    setQrLoading(true);
    try {
      const res = await coachingAPI.getCheckinQR(bookingId);
      setQrData(res.data);
    } catch (err) { toast.error("Failed to get QR code"); }
    setQrLoading(false);
  };

  const filtered = coaches.filter(c => {
    if (sportFilter !== "all" && !(c.coaching_sports || []).includes(sportFilter)) return false;
    if (searchQ && !c.name.toLowerCase().includes(searchQ.toLowerCase()) &&
        !(c.city || "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const upcomingSessions = mySessions.filter(s => s.status === "confirmed");
  const pastSessions = mySessions.filter(s => s.status === "completed");

  // Derive bookable sports from selected slot
  const slotSports = selectedSlot?.sports?.length > 0
    ? selectedSlot.sports
    : (selectedCoach?.coaching_sports?.length > 0
        ? selectedCoach.coaching_sports
        : SPORTS.slice(1));

  if (loading) return <CoachListingSkeleton />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-5 sm:py-8 pb-16 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coaching</span>
            <h1 className="admin-page-title text-xl sm:text-2xl md:text-3xl mt-1 [text-wrap:balance]">
              Find a <span className="text-brand-600">Coach</span>
            </h1>
          </div>
          <Button
            className={`w-full sm:w-auto h-11 ${showSessions ? "bg-brand-600 text-white admin-btn rounded-xl shadow-md shadow-brand-600/20 font-medium text-xs" : "border border-brand-600/40 text-brand-600 bg-transparent admin-btn rounded-xl font-medium text-xs hover:bg-brand-600/10"}`}
            onClick={() => setShowSessions(!showSessions)}
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            My Sessions {upcomingSessions.length > 0 && `(${upcomingSessions.length})`}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Book 1-on-1 sessions or subscribe to monthly packages from certified coaches.
        </p>
      </motion.div>

      {/* My Sessions Panel */}
      {showSessions && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="mb-8 space-y-3">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Your Coaching Sessions</h3>
          {mySubscriptions.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Active Subscriptions</h4>
              <div className="space-y-2">
                {mySubscriptions.map(sub => (
                  <motion.div key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-[28px] border border-border/40 bg-card shadow-sm p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{sub.package_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Coach: {sub.coach_name} · {sub.sessions_remaining}/{sub.sessions_per_month} sessions left
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Expires: {new Date(sub.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-10 px-3 min-w-[80px]" onClick={() => { if (window.confirm("Cancel this subscription?")) handleCancelSub(sub.id); }}>
                      Cancel
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {upcomingSessions.length === 0 && pastSessions.length === 0 && mySubscriptions.length === 0 && (
            <div className="text-center py-8 rounded-[28px] border border-border/40 bg-card shadow-sm text-muted-foreground text-sm">
              No sessions yet. Book a coach below!
            </div>
          )}
          {upcomingSessions.map(s => (
            <div key={s.id} className="rounded-[28px] border border-border/40 bg-card shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-l-4 border-l-sky-500">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm">{s.coach_name}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                  <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt12h(s.start_time)} - {fmt12h(s.end_time)}</span>
                  <span className="font-bold text-brand-600">₹{s.price}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" aria-label="Get check-in QR code" className="text-[10px] h-10 px-3 min-w-[80px]"
                  onClick={() => handleGetQR(s.booking_id || s.id)}>
                  <QrCode className="h-3 w-3 mr-1" />QR
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] h-10 px-3 min-w-[80px] text-destructive border-destructive/30"
                  onClick={() => { if (window.confirm("Cancel this session?")) handleCancelSession(s.id); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
          {pastSessions.map(s => (
            <SessionReviewCard key={s.id} session={s} onReview={handleReviewSession} />
          ))}
        </motion.div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or city..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            name="coach-search"
            autoComplete="off"
            className="pl-10 bg-secondary/20 border-border/40 h-11 rounded-xl font-medium text-sm"
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-secondary/20 border-border/40 h-11 rounded-xl text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All Sports" : s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Coach List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-bold mb-1">No coaches found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((coach, idx) => (
            <CoachCard key={coach.id} coach={coach} onBook={handleSelectCoach} delay={idx * 0.05} />
          ))}
        </div>
      )}

      {/* ─── Booking Dialog ─── */}
      <Dialog open={!!selectedCoach} onOpenChange={open => { if (!open) { setSelectedCoach(null); setSelectedSlot(null); setBookingTab("session"); } }}>
        <DialogContent className="bg-card border-border/40 max-w-[95vw] sm:max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 rounded-[28px]">
          {selectedCoach && (() => {
            const next14 = Array.from({ length: 14 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() + i);
              return {
                value: d.toISOString().slice(0, 10),
                day: d.toLocaleDateString("en", { weekday: "short" }),
                date: d.getDate(),
                month: d.toLocaleDateString("en", { month: "short" }),
                isToday: i === 0,
              };
            });
            return (
              <>
                {/* ── Coach strip ── */}
                <div className="shrink-0 flex items-center gap-3 p-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary shrink-0">
                    <img src={mediaUrl(selectedCoach.avatar) || COACH_PLACEHOLDER} alt={selectedCoach.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-medium text-base truncate">{selectedCoach.name}</h2>
                      {selectedCoach.avg_rating > 0 && (
                        <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" />{selectedCoach.avg_rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {selectedCoach.city && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-3 w-3" />{selectedCoach.city}</span>}
                      {selectedCoach.coaching_sports?.slice(0, 2).map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-xl text-brand-600">₹{selectedCoach.session_price || 500}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedCoach.session_duration_minutes || 60} min</p>
                  </div>
                </div>

                {/* ── Tab bar ── */}
                <div className="shrink-0 flex border-b border-border">
                  {[
                    { id: "session", label: "Book Session", icon: Calendar },
                    ...(coachPackages.length > 0 ? [{ id: "packages", label: `Packages (${coachPackages.length})`, icon: Package }] : []),
                  ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setBookingTab(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-colors ${
                        bookingTab === id ? "border-brand-600 text-brand-600" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto">

                  {/* SESSION TAB */}
                  {bookingTab === "session" && (
                    <div className="p-4 space-y-5">

                      {/* Date strip */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Select Date</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                          {next14.map(d => (
                            <button key={d.value} onClick={() => handleDateChange(d.value)}
                              className={`flex flex-col items-center shrink-0 w-[56px] sm:w-[60px] py-2.5 rounded-xl border-2 transition-all ${
                                selectedDate === d.value
                                  ? "border-brand-600 bg-brand-600/10 text-brand-600"
                                  : "border-border/40 bg-background/50 hover:border-brand-600/40 text-foreground"
                              }`}>
                              <span className={`text-[10px] font-bold uppercase ${selectedDate === d.value ? "text-brand-600" : "text-muted-foreground"}`}>{d.day}</span>
                              <span className="text-lg font-black leading-tight">{d.date}</span>
                              <span className={`text-[10px] ${selectedDate === d.value ? "text-brand-600/70" : "text-muted-foreground"}`}>{d.month}</span>
                              {d.isToday && <span className="text-[8px] admin-btn text-brand-600 mt-0.5">Today</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slots */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Available Slots</p>
                        {slotsLoading ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                          </div>
                        ) : coachSlots.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 rounded-xl bg-secondary/20 border border-dashed border-border">
                            <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm font-bold text-muted-foreground">No slots on this day</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Try a different date</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {coachSlots.map(slot => (
                              <button key={slot.start_time}
                                onClick={() => { if (slot.available) setSelectedSlot(slot); }}
                                disabled={!slot.available}
                                className={`flex flex-col items-center px-2 py-3.5 rounded-xl border-2 text-xs font-bold transition-all ${
                                  selectedSlot?.start_time === slot.start_time
                                    ? "border-brand-600 bg-brand-600/10 text-brand-600 shadow-sm"
                                    : slot.available
                                      ? "border-border/40 bg-background hover:border-brand-600/50 hover:bg-brand-600/5"
                                      : "border-border/20 bg-secondary/20 text-muted-foreground/40 cursor-not-allowed"
                                }`}>
                                <span className={slot.available ? "" : "line-through"}>{slot.start_time}</span>
                                <span className={`text-[10px] font-normal mt-0.5 ${selectedSlot?.start_time === slot.start_time ? "text-brand-600/70" : "text-muted-foreground"}`}>
                                  {slot.end_time}
                                </span>
                                {!slot.available && <span className="text-[10px] text-red-400/70 mt-0.5">Booked</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sport + Notes — expand after slot selected */}
                      {selectedSlot && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                          {/* Sport */}
                          {slotSports.length === 1 ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-600/10 border border-brand-600/20 rounded-xl">
                              <CheckCircle className="h-4 w-4 text-brand-600 shrink-0" />
                              <span className="text-sm font-bold capitalize text-brand-600">{slotSports[0].replace("_", " ")}</span>
                              <span className="text-xs text-muted-foreground ml-1">Sport</span>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Sport</p>
                              <div className="flex flex-wrap gap-2">
                                {slotSports.map(s => (
                                  <button key={s} onClick={() => setBookingSport(s)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all capitalize ${
                                      bookingSport === s ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border/40 hover:border-brand-600/40"
                                    }`}>
                                    {s.replace("_", " ")}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Notes */}
                          <Input value={bookingNotes} onChange={e => setBookingNotes(e.target.value)}
                            placeholder="What do you want to work on? (optional)"
                            className="bg-secondary/20 border-border/40 rounded-xl text-sm" />
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* PACKAGES TAB */}
                  {bookingTab === "packages" && (
                    <div className="p-4 space-y-3">
                      {coachPackages.map(pkg => (
                        <div key={pkg.id} className={`rounded-[28px] border p-4 transition-all ${pkg.subscribed ? "border-brand-600/30 bg-brand-600/5" : "border-border/40 bg-card"}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{pkg.name}</p>
                              <p className="text-xs text-muted-foreground">{pkg.sessions_per_month} sessions · {pkg.duration_minutes || 60} min each</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-lg text-brand-600">₹{(pkg.price || 0).toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">/month</p>
                            </div>
                          </div>
                          {pkg.description && <p className="text-xs text-muted-foreground mb-2">{pkg.description}</p>}
                          {pkg.sports?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {pkg.sports.map(s => <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>)}
                            </div>
                          )}
                          {pkg.subscribed ? (
                            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-brand-600/10">
                              <CheckCircle className="h-4 w-4 text-brand-600" />
                              <span className="text-xs font-bold text-brand-600">Subscribed · {pkg.sessions_remaining} sessions left</span>
                            </div>
                          ) : (
                            <Button className="w-full h-9 text-xs admin-btn bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                              onClick={() => handleSubscribe(pkg)} disabled={subscribing}>
                              {subscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Package className="h-3.5 w-3.5 mr-1.5" />}
                              Subscribe · ₹{(pkg.price || 0).toLocaleString()}/mo
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Sticky CTA (session tab only) ── */}
                {bookingTab === "session" && (
                  <div className="shrink-0 p-4 border-t border-border bg-card/95 backdrop-blur">
                    {selectedSlot && (
                      <div className="flex items-center justify-between text-xs mb-3 px-1">
                        <span className="text-muted-foreground">
                          {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" · "}{fmt12h(selectedSlot.start_time)} – {fmt12h(selectedSlot.end_time)}
                          {" · "}<span className="capitalize">{bookingSport.replace("_", " ")}</span>
                        </span>
                        <span className="font-bold text-brand-600">₹{selectedCoach.session_price || 500}</span>
                      </div>
                    )}
                    <Button className="w-full h-14 admin-btn text-base bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                      disabled={!selectedSlot || booking} onClick={handleBook}>
                      {booking
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                        : selectedSlot
                          ? <>Confirm Booking · ₹{selectedCoach.session_price || 500}</>
                          : "Select a slot to continue"}
                    </Button>
                    <Link to={`/player-card/${selectedCoach.id}`}
                      className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-brand-600 mt-2 transition-colors">
                      View full profile <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrData} onOpenChange={open => { if (!open) setQrData(null); }}>
        <DialogContent className="bg-card border-border/40 max-w-[95vw] sm:max-w-sm text-center rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="admin-heading">Check-in QR Code</DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl mx-auto w-fit">
                <QRCodeSVG value={qrData.qr_data} size={200} level="M" includeMargin={false} />
              </div>
              <p className="text-xs text-muted-foreground">
                Show this QR code to your coach for check-in verification.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Expires: {new Date(qrData.expires_at).toLocaleString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ TEST PAYMENT REVIEW MODAL ══════════════════════════ */}
      <AnimatePresence>
        {payStep && (pendingSession || pendingSubPkg) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => { if (payStep !== "processing") closePaymentReview(); }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-[28px] border border-border/40 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <h2 className="font-medium text-lg">
                  {payStep === "done" ? "Booking Confirmed!" :
                   payStep === "processing" ? "Processing Payment..." :
                   "Complete Payment"}
                </h2>
                {payStep !== "processing" && (
                  <button onClick={closePaymentReview} aria-label="Close payment"
                    className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-brand-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-5">
                {/* Processing */}
                {payStep === "processing" && (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <div className="w-16 h-16 rounded-full border-4 border-brand-600/20 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">Confirming your booking...</p>
                    <p className="text-xs text-muted-foreground/60">Please do not close this window</p>
                  </div>
                )}

                {/* Review — Session */}
                {payStep === "review" && pendingSession && (
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-border/40 bg-card p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Coach</span>
                        <span className="font-medium text-sm">{pendingSession.coach_name || selectedCoach?.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Date</span>
                        <span className="font-bold text-sm">
                          {new Date(pendingSession.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Time</span>
                        <span className="font-bold text-sm">{pendingSession.start_time} – {pendingSession.end_time}</span>
                      </div>
                      {pendingSession.sport && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Sport</span>
                          <span className="font-bold text-sm capitalize">{pendingSession.sport.replace("_", " ")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-border/50">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Total</span>
                        <span className="font-bold text-2xl text-brand-600">₹{pendingSession.price}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</span>
                        <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Awaiting Payment</Badge>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-sky-500/10 border-2 border-sky-500/20 text-sm text-sky-400 font-semibold">
                      Payment gateway is being configured. Please confirm to proceed.
                    </div>

                    <button
                      onClick={handleTestSessionPayment}
                      className="w-full h-14 rounded-xl bg-brand-600 hover:bg-brand-500 text-white admin-btn text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                    >
                      Confirm Payment · ₹{pendingSession.price}
                    </button>
                  </div>
                )}

                {/* Review — Subscription */}
                {payStep === "review" && pendingSubPkg && !pendingSession && (
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-border/40 bg-card p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Coach</span>
                        <span className="font-medium text-sm">{selectedCoach?.name || "Coach"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Package</span>
                        <span className="font-bold text-sm">{pendingSubPkg.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Sessions</span>
                        <span className="font-bold text-sm">{pendingSubPkg.sessions_per_month} / month</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Duration</span>
                        <span className="font-bold text-sm">{pendingSubPkg.duration_minutes || 60} min each</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-border/50">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Total</span>
                        <span className="font-bold text-2xl text-brand-600">₹{(pendingSubPkg.sub_price || pendingSubPkg.price || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</span>
                        <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Awaiting Payment</Badge>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-sky-500/10 border-2 border-sky-500/20 text-sm text-sky-400 font-semibold">
                      Payment gateway is being configured. Please confirm to proceed.
                    </div>

                    <button
                      onClick={handleTestSubPayment}
                      className="w-full h-14 rounded-xl bg-brand-600 hover:bg-brand-500 text-white admin-btn text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                    >
                      Confirm Payment · ₹{(pendingSubPkg.sub_price || pendingSubPkg.price || 0).toLocaleString()}/mo
                    </button>
                  </div>
                )}

                {/* Done */}
                {payStep === "done" && (
                  <div className="space-y-5">
                    <div className="flex flex-col items-center py-6 gap-3">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="font-medium text-lg">
                        {pendingSession ? "Session Confirmed!" : "Subscription Active!"}
                      </p>
                      <p className="text-sm text-muted-foreground text-center">
                        {pendingSession
                          ? `${pendingSession.sport?.replace("_", " ") || "Session"} on ${new Date(pendingSession.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${pendingSession.start_time}`
                          : `${pendingSubPkg?.name} — ${pendingSubPkg?.sessions_per_month} sessions/month`}
                      </p>
                    </div>
                    <button
                      onClick={closePaymentReview}
                      className="w-full h-14 rounded-xl bg-brand-600 hover:bg-brand-500 text-white admin-btn text-sm shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SessionReviewCard({ session, onReview }) {
  const [rating, setRating] = useState(session.rating || 0);
  const [review, setReview] = useState(session.review || "");
  const [submitting, setSubmitting] = useState(false);
  const hasReview = session.rating > 0;

  const handleSubmit = async () => {
    if (rating === 0) return toast.error("Please select a rating");
    setSubmitting(true);
    await onReview(session.id, rating, review);
    setSubmitting(false);
  };

  return (
    <div className="rounded-[28px] border border-border/40 bg-card shadow-sm p-4 opacity-80">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm">{session.coach_name}</span>
            <Badge variant="secondary" className="text-[10px] capitalize">{session.sport}</Badge>
            <Badge className="bg-brand-500/15 text-brand-400 text-[10px]">Completed</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {session.date} · {session.start_time} · ₹{session.price}
          </div>
        </div>
      </div>
      {hasReview ? (
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-3.5 w-3.5 ${s <= session.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/50"}`} />
          ))}
          {session.review && <span className="ml-2 text-xs text-muted-foreground italic">"{session.review}"</span>}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} aria-label={`Rate ${s} star${s !== 1 ? "s" : ""}`} onClick={() => setRating(s)} className="p-1 focus-visible:ring-2 focus-visible:ring-amber-400 rounded">
                <Star className={`h-4 w-4 transition-colors ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/50 hover:text-amber-300"}`} />
              </button>
            ))}
          </div>
          <Input
            placeholder="Quick review..."
            value={review}
            onChange={e => setReview(e.target.value)}
            autoComplete="off"
            className="h-8 text-xs flex-1 min-w-[120px] bg-secondary/20 border-border/40 rounded-xl"
          />
          <Button size="sm" className="h-9 text-[10px] font-bold" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
