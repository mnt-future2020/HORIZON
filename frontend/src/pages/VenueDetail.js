import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fmt12h } from "@/lib/utils";
import { useParams, Link } from "react-router-dom";
import { venueAPI, bookingAPI, slotLockAPI, paymentAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  MapPin,
  Clock,
  Zap,
  Users,
  Copy,
  Check,
  Loader2,
  Send,
  Phone,
  ChevronLeft,
  Minus,
  Plus,
  ShoppingCart,
  X,
  Trash2,
  CalendarDays,
  Timer,
} from "lucide-react";
import { format } from "date-fns";
import { useRazorpay } from "@/hooks/useRazorpay";
import BookingReceipt from "@/components/BookingReceipt";

const cleanPhone = (v) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  return d.slice(0, 10);
};

function EnquiryForm({ venue }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    sport: venue.sports?.[0] || "",
    date: "",
    time: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await venueAPI.submitEnquiry(venue.id, form);
      setSent(true);
      if (res.data?.whatsapp_sent) {
        toast.success("Enquiry sent via WhatsApp!");
      } else {
        toast.success("Enquiry submitted! The venue will be notified.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to send enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-12 text-center">
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-8">
          <Check className="h-12 w-12 text-brand-400 mx-auto mb-4" />
          <h3 className="font-display text-xl admin-heading mb-2">
            Enquiry Sent!
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your enquiry has been sent to the venue owner. They will contact you
            soon.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSent(false);
              setForm({
                name: "",
                phone: "",
                sport: venue.sports?.[0] || "",
                date: "",
                time: "",
                message: "",
              });
            }}
          >
            Send Another Enquiry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 md:px-6 py-8">
      <div className="rounded-2xl border border-amber-500/30 bg-card/50 backdrop-blur-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Phone className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display text-lg admin-heading">
              Enquire via WhatsApp
            </h3>
            <p className="text-xs text-muted-foreground">
              This venue accepts enquiries only. Fill the form to contact the
              owner.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground admin-label">
                Your Name *
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Rahul Kumar"
                className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground admin-label">
                Phone Number *
              </Label>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs admin-label text-muted-foreground select-none">
                  +91
                </span>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      phone: cleanPhone(e.target.value),
                    }))
                  }
                  placeholder="98765 43210"
                  className="rounded-l-none h-11 rounded-xl bg-secondary/20 border-border/40"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground admin-label">
                Sport
              </Label>
              <select
                value={form.sport}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sport: e.target.value }))
                }
                className="mt-1 w-full h-11 rounded-xl border border-border/40 bg-secondary/20 px-3 text-sm"
              >
                {(venue.sports || ["football"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground admin-label">
                Preferred Date
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground admin-label">
              Preferred Time
            </Label>
            <Input
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              placeholder="6:00 PM - 7:00 PM"
              className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground admin-label">
              Message (optional)
            </Label>
            <Input
              value={form.message}
              onChange={(e) =>
                setForm((p) => ({ ...p, message: e.target.value }))
              }
              placeholder="Looking for a regular slot..."
              className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40"
            />
          </div>
          <Button
            className="w-full bg-brand-600 hover:bg-brand-700 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-11 gap-2"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Enquiry via WhatsApp
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Cart Panel ─────────────────────────────────────────────────────────────
function CartPanel({ cart, cartTotal, onRemove, onCheckout, checkoutLoading }) {
  if (cart.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-8 text-center">
        <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm admin-label text-muted-foreground">
          Cart Is Empty
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Select a sport, court, and time to book
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-6 sticky top-24">
      <h3 className="font-display text-lg admin-heading mb-4 uppercase tracking-wide flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-brand-600" />
        Cart ({cart.length})
      </h3>
      <div className="space-y-3 max-h-[45vh] overflow-y-auto">
        {cart.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-border/50 bg-background/50 p-4"
          >
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="admin-name text-sm truncate">
                  {item.court.turf_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {item.sport} &middot; {item.numPlayers} lobbian
                  {item.numPlayers > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.date} &middot; {item.startTime} - {item.endTime}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <span className="font-display admin-value text-brand-600">
                  ₹{item.price}
                </span>
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-1 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="border-t border-border/50 mt-4 pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm admin-label uppercase text-muted-foreground">
            Total
          </span>
          <span className="font-display text-2xl admin-value text-brand-600">
            ₹{cartTotal}
          </span>
        </div>
        <Button
          onClick={onCheckout}
          disabled={checkoutLoading}
          className="w-full h-12 bg-brand-600 text-white admin-btn uppercase tracking-wide rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Booking...
            </>
          ) : (
            "Book Now"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function VenueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { openCheckout } = useRazorpay();
  const [venue, setVenue] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [durationSlots, setDurationSlots] = useState(1);
  const [numPlayers, setNumPlayers] = useState(1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const calendarRef = useRef(null);
  const timePickerRef = useRef(null);

  // Cart state
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Checkout / payment state
  const activeLocks = useRef([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [payMode, setPayMode] = useState("full");
  const [splitCount, setSplitCount] = useState(10);

  const [confirmResults, setConfirmResults] = useState([]);
  const [payStep, setPayStep] = useState(null);
  const [copied, setCopied] = useState(false);

  // ─── Release locks on tab close / navigate away ────────────────
  useEffect(() => {
    const releaseLocks = () => {
      const locks = activeLocks.current;
      if (!locks.length) return;
      const token = localStorage.getItem("horizon_token");
      const base = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
      for (const lk of locks) {
        fetch(`${base}/api/slots/unlock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(lk),
          keepalive: true,
        }).catch(() => {});
      }
      activeLocks.current = [];
    };
    window.addEventListener("beforeunload", releaseLocks);
    return () => window.removeEventListener("beforeunload", releaseLocks);
  }, []);

  // ─── Data Loading ───────────────────────────────────────────────
  useEffect(() => {
    venueAPI
      .get(id)
      .then((res) => setVenue(res.data))
      .catch(() => toast.error("Venue not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const loadSlots = useCallback(() => {
    if (!id || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    venueAPI
      .getSlots(id, dateStr)
      .then((res) => setSlots(res.data?.slots || []))
      .catch(() => setSlots([]));
  }, [id, selectedDate]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Auto-refresh slots every 15s
  useEffect(() => {
    const interval = setInterval(loadSlots, 15000);
    return () => clearInterval(interval);
  }, [loadSlots]);

  // Close popups on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (
        showCalendar &&
        calendarRef.current &&
        !calendarRef.current.contains(e.target)
      )
        setShowCalendar(false);
      if (
        showTimePicker &&
        timePickerRef.current &&
        !timePickerRef.current.contains(e.target)
      )
        setShowTimePicker(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCalendar, showTimePicker]);

  // Booking restrictions
  const isAdmin = user?.role === "super_admin";
  const isOwnVenue =
    user?.role === "venue_owner" &&
    venue?.owner_id &&
    venue.owner_id === user?.id;
  const canBook = !isAdmin && !isOwnVenue;

  // ─── Derived Data ───────────────────────────────────────────────
  const availableSports = useMemo(() => {
    if (venue?.turf_config?.length) {
      return [
        ...new Set(venue.turf_config.map((tc) => tc.sport).filter(Boolean)),
      ];
    }
    return venue?.sports || [];
  }, [venue]);

  // Auto-select first sport
  useEffect(() => {
    if (availableSports.length > 0 && !selectedSport) {
      setSelectedSport(availableSports[0]);
    }
  }, [availableSports, selectedSport]);

  const courtsForSport = useMemo(() => {
    if (!selectedSport || !venue) return [];
    if (venue.turf_config?.length) {
      const courts = [];
      let idx = 1;
      for (const tc of venue.turf_config) {
        for (const turf of tc.turfs || []) {
          if (tc.sport === selectedSport) {
            courts.push({
              turf_number: idx,
              turf_name: turf.name || `Turf ${idx}`,
              price: turf.price || venue.base_price || 2000,
            });
          }
          idx++;
        }
      }
      return courts;
    }
    // Legacy fallback: generic turfs
    return Array.from({ length: venue.turfs || 1 }, (_, i) => ({
      turf_number: i + 1,
      turf_name: `Turf ${i + 1}`,
      price: venue.base_price || 2000,
    }));
  }, [selectedSport, venue]);

  // Auto-select single court
  useEffect(() => {
    if (courtsForSport.length === 1 && !selectedCourt) {
      setSelectedCourt(courtsForSport[0]);
    } else if (courtsForSport.length > 0 && selectedCourt) {
      // Ensure selected court is still valid for this sport
      if (
        !courtsForSport.find((c) => c.turf_number === selectedCourt.turf_number)
      ) {
        setSelectedCourt(null);
      }
    }
  }, [courtsForSport, selectedCourt]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const availableStartTimes = useMemo(() => {
    if (!selectedCourt) return [];
    const now = new Date();
    const isToday = dateStr === format(now, "yyyy-MM-dd");
    const nowHHMM = isToday
      ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      : null;
    return slots
      .filter((s) => {
        if (s.turf_number !== selectedCourt.turf_number) return false;
        if (s.status !== "available") return false;
        // Hide past slots for today
        if (isToday && s.start_time <= nowHHMM) return false;
        // Exclude slots that overlap with cart items
        const inCart = cart.some(
          (item) =>
            item.court.turf_number === s.turf_number &&
            item.date === dateStr &&
            item.startTime <= s.start_time &&
            item.endTime > s.start_time,
        );
        return !inCart;
      })
      .map((s) => ({
        time: s.start_time,
        endTime: s.end_time,
        price: s.price,
        hasOffer: s.has_offer,
        originalPrice: s.original_price,
      }));
  }, [slots, selectedCourt, cart, dateStr]);

  const slotDuration = venue?.slot_duration_minutes || 60;

  const maxDurationSlots = useMemo(() => {
    if (!selectedStartTime || !selectedCourt) return 1;
    const courtSlots = slots
      .filter((s) => s.turf_number === selectedCourt.turf_number)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const startIdx = courtSlots.findIndex(
      (s) => s.start_time === selectedStartTime,
    );
    if (startIdx < 0) return 1;
    let count = 0;
    for (let i = startIdx; i < courtSlots.length; i++) {
      if (courtSlots[i].status !== "available") break;
      // Check not in cart
      const inCart = cart.some(
        (item) =>
          item.court.turf_number === selectedCourt.turf_number &&
          item.date === dateStr &&
          item.startTime <= courtSlots[i].start_time &&
          item.endTime > courtSlots[i].start_time,
      );
      if (inCart) break;
      count++;
    }
    return Math.max(count, 1);
  }, [selectedStartTime, selectedCourt, slots, cart, dateStr]);

  const selectionPrice = useMemo(() => {
    if (!selectedStartTime || !selectedCourt) return 0;
    const courtSlots = slots
      .filter((s) => s.turf_number === selectedCourt.turf_number)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const startIdx = courtSlots.findIndex(
      (s) => s.start_time === selectedStartTime,
    );
    if (startIdx < 0) return 0;
    let total = 0;
    for (
      let i = startIdx;
      i < startIdx + durationSlots && i < courtSlots.length;
      i++
    ) {
      total += courtSlots[i].price;
    }
    return total;
  }, [selectedStartTime, selectedCourt, durationSlots, slots]);

  const selectionOriginalPrice = useMemo(() => {
    if (!selectedStartTime || !selectedCourt) return 0;
    const courtSlots = slots
      .filter((s) => s.turf_number === selectedCourt.turf_number)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const startIdx = courtSlots.findIndex(
      (s) => s.start_time === selectedStartTime,
    );
    if (startIdx < 0) return 0;
    let total = 0;
    for (
      let i = startIdx;
      i < startIdx + durationSlots && i < courtSlots.length;
      i++
    ) {
      total += courtSlots[i].original_price || courtSlots[i].price;
    }
    return total;
  }, [selectedStartTime, selectedCourt, durationSlots, slots]);

  const selectionEndTime = useMemo(() => {
    if (!selectedStartTime) return "";
    const [h, m] = selectedStartTime.split(":").map(Number);
    const endMin = h * 60 + m + slotDuration * durationSlots;
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [selectedStartTime, durationSlots, slotDuration]);

  // ─── Cascade Resets ─────────────────────────────────────────────
  const handleSportChange = (sport) => {
    setSelectedSport(sport);
    setSelectedCourt(null);
    setSelectedStartTime("");
    setDurationSlots(1);
  };

  const handleCourtChange = (turfNumber) => {
    const court = courtsForSport.find((c) => c.turf_number === turfNumber);
    setSelectedCourt(court || null);
    setSelectedStartTime("");
    setDurationSlots(1);
  };

  const handleStartTimeChange = (time) => {
    setSelectedStartTime(time);
    setDurationSlots(1);
  };

  // ─── Cart Functions ─────────────────────────────────────────────
  const addToCart = () => {
    if (!canBook) {
      toast.error(
        isAdmin
          ? "Admins cannot book venues"
          : "You cannot book your own venue",
      );
      return;
    }
    if (!selectedSport || !selectedCourt || !selectedStartTime) {
      toast.error("Please complete all selections");
      return;
    }
    // Check overlap with existing cart items
    const overlaps = cart.some(
      (item) =>
        item.court.turf_number === selectedCourt.turf_number &&
        item.date === dateStr &&
        item.startTime < selectionEndTime &&
        selectedStartTime < item.endTime,
    );
    if (overlaps) {
      toast.error("This overlaps with an item already in your cart");
      return;
    }
    const newItem = {
      id: crypto.randomUUID(),
      sport: selectedSport,
      date: dateStr,
      court: selectedCourt,
      startTime: selectedStartTime,
      endTime: selectionEndTime,
      durationSlots,
      price: selectionPrice,
      numPlayers,
      venueId: id,
      venueName: venue.name,
    };
    setCart((prev) => [...prev, newItem]);
    toast.success("Added to cart!");
    setSelectedStartTime("");
    setDurationSlots(1);
    setNumPlayers(1);
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const releaseAllLocks = async (keys) => {
    for (const lk of keys) {
      await slotLockAPI.unlock(lk).catch(() => {});
    }
    activeLocks.current = [];
  };

  // ─── Checkout Flow ──────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!cart.length) return;
    setCheckoutLoading(true);
    const lockedKeys = [];

    try {
      // STEP 0: Fresh availability check before locking
      for (const item of cart) {
        try {
          const res = await venueAPI.getSlots(id, item.date);
          const freshSlots = res.data?.slots || [];
          const [sh, sm] = item.startTime.split(":").map(Number);
          const [eh, em] = item.endTime.split(":").map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          for (let min = startMin; min < endMin; min += slotDuration) {
            const h = Math.floor(min / 60);
            const m = min % 60;
            const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            const fresh = freshSlots.find(
              (s) =>
                s.start_time === slotStart &&
                s.turf_number === item.court.turf_number,
            );
            if (fresh && fresh.status === "booked") {
              toast.error(
                `${item.court.turf_name} at ${fmt12h(slotStart)} is already booked. Please update your cart.`,
              );
              loadSlots();
              setCheckoutLoading(false);
              return;
            }
          }
        } catch {
          // If fetch fails, proceed — lock step will catch conflicts
        }
      }

      // STEP 1: Lock all constituent slots for all cart items
      for (const item of cart) {
        const [sh, sm] = item.startTime.split(":").map(Number);
        const [eh, em] = item.endTime.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        for (let min = startMin; min < endMin; min += slotDuration) {
          const h = Math.floor(min / 60);
          const m = min % 60;
          const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const lockData = {
            venue_id: id,
            date: item.date,
            start_time: slotStart,
            turf_number: item.court.turf_number,
          };
          try {
            await slotLockAPI.lock(lockData);
            lockedKeys.push(lockData);
            activeLocks.current = [...lockedKeys];
          } catch (err) {
            if (err.response?.status === 409) {
              // Release all acquired locks
              await releaseAllLocks(lockedKeys);
              toast.error(
                `Slot ${slotStart} on ${item.court.turf_name} is no longer available`,
              );
              loadSlots();
              setCheckoutLoading(false);
              return;
            }
            // Non-409: proceed without lock (Redis may be down)
          }
        }
      }

      // STEP 2: Extend all locks to hard (30 min)
      for (const lk of lockedKeys) {
        await slotLockAPI.extendLock(lk).catch(() => {});
      }

      // STEP 3: Check if Razorpay is available
      const gwRes = await paymentAPI.gatewayInfo();
      const hasGateway = gwRes.data?.has_gateway;

      if (hasGateway) {
        // ── RAZORPAY FLOW: Create order only, NO booking until payment done ──
        const orderRes = await paymentAPI.createOrder({
          amount: cartTotal,
          notes: { venue_id: id, items: cart.length, type: "booking" },
        });

        if (orderRes.data.payment_gateway === "razorpay") {
          const loaded = await openCheckout({
            keyId: orderRes.data.key_id,
            orderId: orderRes.data.order_id,
            amount: cartTotal,
            name: venue?.name || "LOBBI",
            description: `${cart.length} booking${cart.length > 1 ? "s" : ""}`,
            onSuccess: async (response) => {
              const successBookings = [];
              const failedItems = [];
              try {
                // Payment done → NOW create bookings as confirmed
                for (const item of cart) {
                  const data = {
                    venue_id: id,
                    date: item.date,
                    start_time: item.startTime,
                    end_time: item.endTime,
                    turf_number: item.court.turf_number,
                    sport: item.sport,
                    payment_mode: payMode,
                    num_players: item.numPlayers || 1,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  };
                  if (payMode === "split") data.split_count = splitCount;
                  try {
                    const res = await bookingAPI.create(data);
                    successBookings.push(res.data);
                  } catch (itemErr) {
                    console.error("Booking creation failed for item:", item, itemErr);
                    failedItems.push(item);
                  }
                }
                if (successBookings.length > 0) {
                  setConfirmResults(successBookings);
                  setPayStep("done");
                  setBookingDialog(true);
                  setCart([]);
                }
                if (failedItems.length > 0 && successBookings.length > 0) {
                  toast.error(`${failedItems.length} booking(s) failed after payment. ${successBookings.length} succeeded. Contact support for a partial refund.`);
                } else if (failedItems.length > 0) {
                  toast.error("All bookings failed after payment. Contact support for a refund.");
                } else {
                  toast.success("Payment successful! All bookings confirmed.");
                }
                loadSlots();
              } catch (err) {
                const detail =
                  err.response?.data?.detail || err.message || "Unknown error";
                console.error(
                  "Booking creation after payment failed:",
                  detail,
                  err,
                );
                toast.error(`Booking creation failed: ${detail}`);
              } finally {
                // Always release remaining locks (backend already released locks for successful bookings)
                await releaseAllLocks(lockedKeys);
                setCheckoutLoading(false);
              }
            },
            onDismiss: async () => {
              // No bookings to cancel — just release locks
              await releaseAllLocks(lockedKeys);
              toast.info("Payment cancelled");
              setCheckoutLoading(false);
              loadSlots();
            },
          });
          if (!loaded) {
            toast.error("Payment gateway failed to load");
            setCheckoutLoading(false);
            return;
          }
          return;
        }
      }

      // No payment gateway → block checkout
      await releaseAllLocks(lockedKeys);
      toast.error("Payment gateway not configured. Please contact the venue.");
      return;
    } catch (err) {
      await releaseAllLocks(lockedKeys);
      toast.error(err.response?.data?.detail || "Booking failed");
      loadSlots();
    } finally {
      setCheckoutLoading(false);
    }
  };

  const confirmTotal = confirmResults.reduce(
    (sum, b) => sum + (b.total_amount || 0),
    0,
  );

  const handleDialogClose = async (open) => {
    if (!open && payStep !== "processing") {
      if (confirmResults.length > 0 && payStep !== "done") {
        await releaseAllLocks(activeLocks.current);
        loadSlots();
      }
      setConfirmResults([]);
      setPayStep(null);
    }
    setBookingDialog(open);
  };

  const copyLink = () => {
    const token = confirmResults[0]?.split_config?.split_token;
    if (token) {
      navigator.clipboard.writeText(`${window.location.origin}/split/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Split link copied!");
    }
  };

  // fmt12h imported from @/lib/utils

  // ─── Render ─────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!venue)
    return (
      <div className="p-6 text-center text-muted-foreground">
        Venue not found
      </div>
    );

  return (
    <div
      className="min-h-screen bg-background pb-20 md:pb-6"
      data-testid="venue-detail"
    >
      {/* Compact Booking Page Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {venue.slug ? (
              <Link
                to={`/venue/${venue.slug}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Link>
            ) : (
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div className="h-5 w-px bg-border/50" />
            <div>
              <h1 className="font-display text-lg md:text-xl admin-heading tracking-tight">
                {venue.name}
              </h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {venue.city || venue.address}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {venue.opening_hour}:00 - {venue.closing_hour}:00
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {venue.sports?.map((s) => (
              <Badge
                key={s}
                variant="athletic"
                className="uppercase text-[10px]"
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Enquiry Form — shown for enquiry-badge venues */}
      {venue.badge === "enquiry" ? (
        <EnquiryForm venue={venue} />
      ) : (
        /* Booking Section — Form + Cart */
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {/* ─── Booking Form ─── */}
            <div className="lg:col-span-7">
              {/* Booking restriction warning */}
              {!canBook && venue?.badge === "bookable" && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-amber-400 shrink-0" />
                  <p className="text-sm font-semibold text-amber-300">
                    {isAdmin
                      ? "Admins can view slots but cannot book venues."
                      : "You cannot book your own venue."}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card">
                {/* Venue header inside card */}
                <div className="px-6 pt-5 pb-3 border-b border-border/50 rounded-t-2xl">
                  <h2 className="font-display text-lg admin-heading">
                    {venue.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {venue.area || venue.city || venue.address}
                  </p>
                </div>

                {/* Form rows */}
                <div className="divide-y divide-border/50">
                  {/* Sports Row */}
                  <div className="flex items-center px-6 py-4">
                    <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                      Sports
                    </span>
                    <div className="flex-1">
                      <Select
                        value={selectedSport}
                        onValueChange={handleSportChange}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40">
                          <SelectValue placeholder="Select sport" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSports.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Date Row */}
                  <div className="relative px-6 py-4" ref={calendarRef}>
                    <div className="flex items-center">
                      <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                        Date
                      </span>
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="flex-1 flex items-center justify-between h-10 px-3 rounded-xl border border-border/40 bg-secondary/20 text-sm hover:border-brand-600/50 transition-colors"
                      >
                        <span>{format(selectedDate, "yyyy-MM-dd")}</span>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    {showCalendar && (
                      <div className="absolute left-6 right-6 mt-2 z-20 rounded-xl border border-border bg-card shadow-lg p-3">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => {
                            if (d) {
                              setSelectedDate(d);
                              setSelectedStartTime("");
                              setDurationSlots(1);
                              setShowCalendar(false);
                            }
                          }}
                          className="text-foreground mx-auto"
                          disabled={(d) =>
                            d < new Date(new Date().toDateString())
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Start Time Row */}
                  {selectedCourt && (
                    <div className="relative px-6 py-4" ref={timePickerRef}>
                      <div className="flex items-center">
                        <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                          Start Time
                        </span>
                        <button
                          onClick={() => setShowTimePicker(!showTimePicker)}
                          className="flex-1 flex items-center justify-between h-10 px-3 rounded-xl border border-border/40 bg-secondary/20 text-sm hover:border-brand-600/50 transition-colors"
                        >
                          <span>
                            {selectedStartTime
                              ? fmt12h(selectedStartTime)
                              : "Select time"}
                          </span>
                          <Timer className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                      {showTimePicker && (
                        <div className="absolute left-6 right-6 mt-2 z-20 rounded-xl border border-border bg-card shadow-lg p-4 max-h-[300px] overflow-y-auto">
                          {availableStartTimes.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {availableStartTimes.map((t) => (
                                <button
                                  key={t.time}
                                  onClick={() => {
                                    handleStartTimeChange(t.time);
                                    setShowTimePicker(false);
                                  }}
                                  className={`relative py-2.5 px-3 rounded-lg text-sm font-semibold text-center transition-all ${
                                    selectedStartTime === t.time
                                      ? "bg-brand-600 text-white shadow-md"
                                      : "bg-secondary/50 text-foreground hover:bg-white/5"
                                  }`}
                                >
                                  {fmt12h(t.time)}
                                  {t.hasOffer && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">
                                      OFFER
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-amber-400 font-semibold text-center py-4">
                              No available slots for this date & court
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Court Row */}
                  {selectedSport && courtsForSport.length > 0 && (
                    <div className="flex items-center px-6 py-4">
                      <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                        Court
                      </span>
                      <div className="flex-1">
                        <Select
                          value={
                            selectedCourt
                              ? String(selectedCourt.turf_number)
                              : ""
                          }
                          onValueChange={(v) => handleCourtChange(Number(v))}
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40">
                            <SelectValue placeholder="--Select Court--" />
                          </SelectTrigger>
                          <SelectContent>
                            {courtsForSport.map((c) => (
                              <SelectItem
                                key={c.turf_number}
                                value={String(c.turf_number)}
                              >
                                {c.turf_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {/* Duration Row */}
                  <div className="flex items-center px-6 py-4">
                    <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                      Duration
                    </span>
                    <div className="flex-1 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full border-border"
                        onClick={() =>
                          setDurationSlots((d) => Math.max(1, d - 1))
                        }
                        disabled={durationSlots <= 1 || !selectedStartTime}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-display text-lg admin-value">
                        {durationSlots * slotDuration} Mins
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full border-brand-600 text-brand-600 bg-brand-600/10"
                        onClick={() =>
                          setDurationSlots((d) =>
                            Math.min(maxDurationSlots, d + 1),
                          )
                        }
                        disabled={
                          durationSlots >= maxDurationSlots ||
                          !selectedStartTime
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Lobbians Row */}
                  <div className="flex items-center px-6 py-4">
                    <span className="w-28 shrink-0 text-sm font-semibold text-foreground admin-section-label">
                      Lobbians
                    </span>
                    <div className="flex-1 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full border-border"
                        onClick={() => setNumPlayers((n) => Math.max(1, n - 1))}
                        disabled={numPlayers <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-display text-lg admin-value">
                        {numPlayers}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full border-brand-600 text-brand-600 bg-brand-600/10"
                        onClick={() => setNumPlayers((n) => n + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <div className="px-6 py-4 border-t border-border/50">
                  {selectedStartTime ? (
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Price
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p className="font-display text-2xl admin-value text-brand-600">
                            ₹{selectionPrice}
                          </p>
                          {selectionOriginalPrice > selectionPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ₹{selectionOriginalPrice}
                            </span>
                          )}
                        </div>
                        {selectionOriginalPrice > selectionPrice && (
                          <span className="text-[10px] admin-label text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-full">
                            🏷 OFFER — Save ₹
                            {selectionOriginalPrice - selectionPrice}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmt12h(selectedStartTime)} — {fmt12h(selectionEndTime)}
                      </p>
                    </div>
                  ) : null}
                  <Button
                    className="w-full h-11 gap-2 bg-brand-600 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all uppercase tracking-wide"
                    onClick={addToCart}
                    disabled={!selectedStartTime || !selectedCourt}
                  >
                    <ShoppingCart className="h-4 w-4" /> Add To Cart
                  </Button>
                </div>
              </div>
            </div>

            {/* ─── Cart (Desktop) ─── */}
            <div className="hidden lg:block lg:col-span-5">
              <h2 className="font-display text-xl admin-heading mb-6 uppercase tracking-wide">
                &nbsp;
              </h2>
              <CartPanel
                cart={cart}
                cartTotal={cartTotal}
                onRemove={removeFromCart}
                onCheckout={handleCheckout}
                checkoutLoading={checkoutLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile floating cart button */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-40">
          <Button
            onClick={() => setCartOpen(true)}
            className="rounded-full h-14 px-6 bg-brand-600 shadow-lg shadow-brand-600/20 gap-2 admin-btn text-white active:scale-[0.98] transition-all"
          >
            <ShoppingCart className="h-5 w-5" />
            Cart ({cart.length}) &middot; ₹{cartTotal}
          </Button>
        </div>
      )}

      {/* Mobile cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
          <SheetHeader>
            <SheetTitle className="font-display text-lg admin-heading uppercase tracking-wide">
              Your Cart
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CartPanel
              cart={cart}
              cartTotal={cartTotal}
              onRemove={removeFromCart}
              onCheckout={() => {
                setCartOpen(false);
                handleCheckout();
              }}
              checkoutLoading={checkoutLoading}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Loading overlay */}
      {checkoutLoading && (
        <div className="fixed inset-0 z-50 bg-background/50 flex items-center justify-center">
          <div className="bg-card rounded-[28px] border border-border/40 p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            <span className="text-sm font-medium">Booking your slots...</span>
          </div>
        </div>
      )}

      {/* ─── Booking Dialog (Payment Flow) ─── */}
      <Dialog open={bookingDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-card border border-border/40 max-w-[95vw] sm:max-w-md p-8 rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl admin-heading uppercase tracking-wide text-foreground">
              {payStep === "done" || (confirmResults.length > 0 && !payStep)
                ? "Booking Confirmed!"
                : payStep === "processing"
                  ? "Processing Payment..."
                  : payStep === "review"
                    ? "Complete Payment"
                    : "Confirm Booking"}
            </DialogTitle>
          </DialogHeader>

          {/* Payment Processing */}
          {payStep === "processing" && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-brand-600/20 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Confirming your booking{confirmResults.length > 1 ? "s" : ""}...
              </p>
              <p className="text-xs text-muted-foreground/60">
                Please do not close this window
              </p>
            </div>
          )}

          {/* Booking Confirmed */}
          {(payStep === "done" || (confirmResults.length > 0 && !payStep)) &&
            confirmResults.length > 0 && (
              <div className="space-y-4">
                {confirmResults.map((b) => (
                  <BookingReceipt key={b.id} booking={b} />
                ))}
                {confirmResults.length > 1 && (
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm uppercase tracking-wide text-muted-foreground admin-label">
                      Total
                    </span>
                    <span className="font-display admin-value text-2xl text-brand-600">
                      ₹{confirmTotal}
                    </span>
                  </div>
                )}
                {confirmResults[0].split_config && (
                  <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-brand-600" />
                      </div>
                      <span className="font-display text-base admin-heading">
                        Split Payment Link
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-semibold mb-4">
                      Share this link with{" "}
                      {confirmResults[0].split_config.total_shares - 1} friends.
                      Each pays{" "}
                      <span className="text-brand-600 admin-value">
                        ₹
                        {Math.floor(
                          confirmTotal /
                            confirmResults[0].split_config.total_shares,
                        )}
                      </span>
                      .
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/split/${confirmResults[0].split_config.split_token}`}
                        className="bg-secondary/20 border border-border/40 text-sm font-mono h-11 rounded-xl"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={copyLink}
                        className="h-11 w-11 rounded-xl border hover:border-brand-600/50 hover:bg-white/5 transition-colors"
                      >
                        {copied ? (
                          <Check className="h-5 w-5 text-brand-600" />
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <Button
                  className="w-full bg-brand-600 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                  onClick={() => {
                    setBookingDialog(false);
                    setConfirmResults([]);
                    setPayStep(null);
                    loadSlots();
                  }}
                >
                  Done
                </Button>
              </div>
            )}

          {/* Initial Booking Form — payment mode selector (shown before checkout creates booking) */}
          {confirmResults.length === 0 && !payStep && (
            <div className="space-y-4">
              <div className="bg-card rounded-[28px] border border-border/40 p-4 space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.court.turf_name} &middot; {fmt12h(item.startTime)}-
                      {fmt12h(item.endTime)}
                    </span>
                    <span className="admin-value text-brand-600">
                      ₹{item.price}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                  <span className="text-muted-foreground admin-label">
                    Total
                  </span>
                  <span className="admin-value text-brand-600 text-lg">
                    ₹{cartTotal}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground admin-section-label">
                  Payment Mode
                </Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={() => setPayMode("full")}
                    className={`p-3 rounded-xl border text-center transition-all hover:bg-white/5 ${payMode === "full" ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border/40 bg-card"}`}
                  >
                    <Zap className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs admin-label">Full Payment</div>
                  </button>
                  <button
                    onClick={() => setPayMode("split")}
                    className={`p-3 rounded-xl border text-center transition-all hover:bg-white/5 ${payMode === "split" ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border/40 bg-card"}`}
                  >
                    <Users className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs admin-label">Split Payment</div>
                  </button>
                </div>
              </div>

              {payMode === "split" && (
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground admin-section-label">
                    Number of Lobbians
                  </Label>
                  <Select
                    value={String(splitCount)}
                    onValueChange={(v) => setSplitCount(Number(v))}
                  >
                    <SelectTrigger className="mt-2 h-11 rounded-xl bg-secondary/20 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 22].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Lobbians (₹{Math.floor(cartTotal / n)}/each)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full bg-brand-600 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all uppercase tracking-wide h-11"
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading
                  ? "Processing..."
                  : payMode === "split"
                    ? `Pay ₹${Math.floor(cartTotal / splitCount)} (Your Share)`
                    : `Pay ₹${cartTotal}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
