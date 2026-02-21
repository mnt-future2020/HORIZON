import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { coachingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  GraduationCap, Search, Star, MapPin, IndianRupee, Clock,
  Calendar, ChevronRight, Filter, X, QrCode, Loader2
} from "lucide-react";

const SPORTS = ["all", "football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table_tennis", "swimming"];
const COACH_PLACEHOLDER = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80";

function CoachCard({ coach, onSelect, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={() => onSelect(coach)}
      className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-[1.02] hover:shadow-glow-sm transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
          <img
            src={coach.avatar || COACH_PLACEHOLDER}
            alt={coach.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-lg font-black text-foreground truncate group-hover:text-primary transition-colors">
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
          <div className="flex items-center gap-3 flex-wrap">
            {coach.coaching_sports?.map(s => (
              <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s}</Badge>
            ))}
            {coach.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />{coach.city}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-lg font-black text-primary">
            ₹{coach.session_price || 500}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {coach.session_duration_minutes || 60} min
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-2 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

export default function CoachListingPage() {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
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
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    coachingAPI.listCoaches({}).then(res => setCoaches(res.data || [])).catch(() => {}).finally(() => setLoading(false));
    coachingAPI.listSessions({ role: "player" }).then(res => setMySessions(res.data || [])).catch(() => {});
  }, []);

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
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedCoach) loadSlots(selectedCoach.id, date);
  };

  const handleBook = async () => {
    if (!selectedCoach || !selectedSlot) return;
    setBooking(true);
    try {
      await coachingAPI.bookSession({
        coach_id: selectedCoach.id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        sport: bookingSport,
        notes: bookingNotes,
      });
      toast.success("Session booked! The coach has been notified.");
      setSelectedCoach(null);
      setSelectedSlot(null);
      // Refresh sessions
      const res = await coachingAPI.listSessions({ role: "player" });
      setMySessions(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to book session");
    }
    setBooking(false);
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coaching</span>
            <h1 className="font-display text-display-md font-black tracking-athletic mt-1">
              Find a <span className="bg-gradient-athletic bg-clip-text text-transparent">Coach</span>
            </h1>
          </div>
          <Button
            variant={showSessions ? "default" : "athletic-outline"}
            onClick={() => setShowSessions(!showSessions)}
            className="font-bold text-xs"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            My Sessions {upcomingSessions.length > 0 && `(${upcomingSessions.length})`}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Book 1-on-1 sessions with certified coaches to level up your game.
        </p>
      </motion.div>

      {/* My Sessions Panel */}
      {showSessions && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="mb-8 space-y-3">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Your Coaching Sessions</h3>
          {upcomingSessions.length === 0 && pastSessions.length === 0 && (
            <div className="text-center py-8 glass-card rounded-xl text-muted-foreground text-sm">
              No sessions yet. Book a coach below!
            </div>
          )}
          {upcomingSessions.map(s => (
            <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 border-l-4 border-l-sky-500">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm">{s.coach_name}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                  <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} - {s.end_time}</span>
                  <span className="font-bold text-primary">₹{s.price}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-[10px] h-7"
                  onClick={() => handleGetQR(s.booking_id || s.id)}>
                  <QrCode className="h-3 w-3 mr-1" />Check-in QR
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] h-7 text-destructive border-destructive/30"
                  onClick={() => handleCancelSession(s.id)}>
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
            className="pl-10 bg-background/50 border-2 border-border/50 h-10 rounded-xl font-semibold text-sm"
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-40 bg-background/50 border-2 border-border/50 h-10 rounded-xl text-sm">
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
          <GraduationCap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-bold mb-1">No coaches found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((coach, idx) => (
            <CoachCard key={coach.id} coach={coach} onSelect={handleSelectCoach} delay={idx * 0.05} />
          ))}
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={!!selectedCoach} onOpenChange={open => { if (!open) setSelectedCoach(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Book Session with {selectedCoach?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCoach && (
            <div className="space-y-4">
              {/* Coach Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary">
                  <img src={selectedCoach.avatar || COACH_PLACEHOLDER} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{selectedCoach.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedCoach.city}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">₹{selectedCoach.session_price || 500}</div>
                  <div className="text-[10px] text-muted-foreground">{selectedCoach.session_duration_minutes || 60} min</div>
                </div>
              </div>

              {/* Date Picker */}
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => handleDateChange(e.target.value)}
                  className="mt-1 bg-background border-border"
                />
              </div>

              {/* Available Slots */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Available Slots</Label>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : coachSlots.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs bg-secondary/20 rounded-lg">
                    No available slots on this date
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {coachSlots.map(slot => (
                      <button
                        key={slot.start_time}
                        onClick={() => setSelectedSlot(slot.available ? slot : null)}
                        disabled={!slot.available}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                          selectedSlot?.start_time === slot.start_time
                            ? "border-primary bg-primary/10 text-primary"
                            : slot.available
                              ? "border-border/50 bg-background hover:border-primary/50"
                              : "border-border/20 bg-secondary/20 text-muted-foreground/50 cursor-not-allowed line-through"
                        }`}
                      >
                        {slot.start_time} - {slot.end_time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sport & Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Sport</Label>
                <Select value={bookingSport} onValueChange={setBookingSport}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedCoach.coaching_sports?.length > 0 ? selectedCoach.coaching_sports : SPORTS.slice(1)).map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Input
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  placeholder="What do you want to work on?"
                  className="mt-1 bg-background border-border"
                />
              </div>

              <Button
                className="w-full bg-gradient-athletic text-white font-bold shadow-glow-primary hover:shadow-glow-hover"
                disabled={!selectedSlot || booking}
                onClick={handleBook}
              >
                {booking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Book Session — ₹{selectedCoach.session_price || 500}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrData} onOpenChange={open => { if (!open) setQrData(null); }}>
        <DialogContent className="bg-card border-border max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="font-display">Check-in QR Code</DialogTitle>
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
    <div className="glass-card rounded-xl p-4 opacity-80">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm">{session.coach_name}</span>
            <Badge variant="secondary" className="text-[10px] capitalize">{session.sport}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">Completed</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {session.date} · {session.start_time} · ₹{session.price}
          </div>
        </div>
      </div>
      {hasReview ? (
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-3.5 w-3.5 ${s <= session.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
          ))}
          {session.review && <span className="ml-2 text-xs text-muted-foreground italic">"{session.review}"</span>}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)}>
                <Star className={`h-4 w-4 transition-colors ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} />
              </button>
            ))}
          </div>
          <Input
            placeholder="Quick review..."
            value={review}
            onChange={e => setReview(e.target.value)}
            className="h-7 text-xs flex-1 min-w-[120px] bg-background border-border"
          />
          <Button size="sm" className="h-7 text-[10px] font-bold" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
