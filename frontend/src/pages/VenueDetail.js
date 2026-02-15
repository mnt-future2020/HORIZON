import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { venueAPI, bookingAPI, slotLockAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapPin, Star, Clock, IndianRupee, Zap, Users, Copy, Check, Lock, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function VenueDetail() {
  const { id } = useParams();
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

  useEffect(() => {
    venueAPI.get(id).then(res => setVenue(res.data)).catch(() => toast.error("Venue not found")).finally(() => setLoading(false));
  }, [id]);

  const loadSlots = useCallback(() => {
    if (!id || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    venueAPI.getSlots(id, dateStr).then(res => setSlots(res.data?.slots || [])).catch(() => setSlots([]));
  }, [id, selectedDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

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
      setSelectedSlot(slot);
      setBookingDialog(true);
      toast.success(`Slot locked for ${res.data.lock_type === "soft" ? "10 min" : "30 min"}`);
      loadSlots(); // Refresh to show lock status
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to lock slot";
      toast.error(msg);
    } finally {
      setLocking(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    try {
      const data = {
        venue_id: id, date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time, end_time: selectedSlot.end_time,
        turf_number: selectedSlot.turf_number, sport: venue?.sports?.[0] || "football",
        payment_mode: payMode,
      };
      if (payMode === "split") data.split_count = splitCount;
      const res = await bookingAPI.create(data);
      setConfirmResult(res.data);
      toast.success("Booking confirmed! (MOCKED payment)");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Booking failed");
    } finally {
      setBookingLoading(false);
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
            <h1 className="font-display text-2xl md:text-3xl font-black text-foreground">{venue.name}</h1>
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
                    return (
                      <button key={i} disabled={!isAvailable}
                        onClick={() => { setSelectedSlot(s); setBookingDialog(true); }}
                        data-testid={`slot-${s.start_time}-turf-${s.turf_number}`}
                        className={`p-2.5 rounded-lg text-center transition-all border ${
                          !isAvailable ? "bg-destructive/10 border-destructive/20 text-muted-foreground cursor-not-allowed opacity-50" :
                          isSelected ? "bg-primary/20 border-primary text-primary" :
                          "glass-card hover:border-primary/30 cursor-pointer"
                        }`}>
                        <div className="text-xs font-bold">{s.start_time}</div>
                        <div className="text-[10px] text-muted-foreground">{s.end_time}</div>
                        <div className={`text-xs font-display font-bold mt-1 ${isAvailable ? "text-primary" : "text-muted-foreground"}`}>
                          {isAvailable ? `\u20B9${s.price}` : "Booked"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onOpenChange={setBookingDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              {confirmResult ? "Booking Confirmed!" : "Confirm Booking"}
            </DialogTitle>
          </DialogHeader>

          {confirmResult ? (
            <div className="space-y-4">
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
                onClick={() => { setBookingDialog(false); setConfirmResult(null); setSelectedSlot(null); }}
                data-testid="booking-done-btn">Done</Button>
            </div>
          ) : selectedSlot && (
            <div className="space-y-4">
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
