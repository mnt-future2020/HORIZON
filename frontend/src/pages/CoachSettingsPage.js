import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { coachingAPI } from "@/lib/api";
import { fmt12h } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  MessageCircle,
  Dumbbell,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
  Smartphone,
  Bell,
  AlertTriangle,
  Banknote,
  Smile,
  BarChart3,
  Mail,
  ChevronRight,
  Settings2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

/* ─── URL param utils (zero re-renders) ─── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false)
      url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TIME_PRESETS = [
  { label: "5-6 AM", start: "05:00", end: "06:00" },
  { label: "6-7 AM", start: "06:00", end: "07:00" },
  { label: "7-8 AM", start: "07:00", end: "08:00" },
  { label: "8-9 AM", start: "08:00", end: "09:00" },
  { label: "4-5 PM", start: "16:00", end: "17:00" },
  { label: "5-6 PM", start: "17:00", end: "18:00" },
  { label: "6-7 PM", start: "18:00", end: "19:00" },
  { label: "7-8 PM", start: "19:00", end: "20:00" },
];
const DAY_SHORTCUTS = [
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
  { label: "All", days: [0, 1, 2, 3, 4, 5, 6] },
];
const ALL_SPORTS = [
  "football",
  "cricket",
  "badminton",
  "tennis",
  "basketball",
  "volleyball",
  "table_tennis",
  "swimming",
  "athletics",
  "kabaddi",
  "hockey",
  "chess",
  "cycling",
  "yoga",
  "fitness",
];
const AUTOMATIONS = [
  {
    key: "welcome",
    icon: Smartphone,
    title: "Welcome Message",
    desc: "Sent when you add a new offline client with a phone number",
  },
  {
    key: "booking_confirmation",
    icon: CheckCircle2,
    title: "Booking Confirmation",
    desc: "Sent when an online session is confirmed",
  },
  {
    key: "session_reminder",
    icon: Bell,
    title: "Session Reminder",
    desc: "Sent to the player before an upcoming session",
    config: {
      field: "hours_before",
      label: "Remind",
      options: [
        { v: 1, l: "1 hour before" },
        { v: 2, l: "2 hours before" },
        { v: 12, l: "12 hours before" },
        { v: 24, l: "1 day before" },
        { v: 48, l: "2 days before" },
      ],
    },
  },
  {
    key: "package_expiry",
    icon: AlertTriangle,
    title: "Package Expiry Alert",
    desc: "Sent when a student's package is about to expire",
    config: {
      field: "days_before",
      label: "Alert",
      options: [
        { v: 1, l: "1 day before" },
        { v: 2, l: "2 days before" },
        { v: 3, l: "3 days before" },
        { v: 5, l: "5 days before" },
        { v: 7, l: "7 days before" },
      ],
    },
  },
  {
    key: "payment_reminder",
    icon: Banknote,
    title: "Payment Reminder",
    desc: "Sent daily with payment link when fee is due",
  },
  {
    key: "no_show_followup",
    icon: Smile,
    title: "No-Show Follow-up",
    desc: "Sent at 9 PM when a client misses a session",
  },
  {
    key: "monthly_progress",
    icon: BarChart3,
    title: "Monthly Progress Report",
    desc: "Sent to active subscribers on the last day of each month",
  },
];
const ICON_MAP = {
  welcome: Smartphone,
  booking_confirmation: CheckCircle2,
  session_reminder: Bell,
  package_expiry: AlertTriangle,
  payment_reminder: Banknote,
  no_show_followup: Smile,
  monthly_progress: BarChart3,
};

const TABS = [
  { id: "availability", icon: Clock, label: "Availability" },
  { id: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { id: "sports", icon: Dumbbell, label: "Sports" },
];

export default function CoachSettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [tab, setTab] = useState(() => getInitParam("tab") || "availability");

  // ── Availability ──
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    days_of_week: [],
    start_time: "09:00",
    end_time: "10:00",
    sports: [],
  });
  const [saving, setSaving] = useState(false);

  // ── WhatsApp ──
  const [waSettings, setWaSettings] = useState({});
  const [waLogs, setWaLogs] = useState([]);
  const [waLoading, setWaLoading] = useState(false);

  // ── Sports ──
  const [coachSports, setCoachSports] = useState(user?.coaching_sports || []);
  const [sportsSaving, setSportsSaving] = useState(false);
  const [customSportInput, setCustomSportInput] = useState("");

  useEffect(() => {
    loadSlots();
  }, []);
  useEffect(() => {
    if (tab === "whatsapp" && !Object.keys(waSettings).length) loadWa();
  }, [tab]);

  const loadSlots = async () => {
    setSlotsLoading(true);
    try {
      const res = await coachingAPI.getAvailability();
      setSlots(res.data || []);
    } catch {
      /* silent */
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadWa = async () => {
    setWaLoading(true);
    try {
      const [s, l] = await Promise.all([
        coachingAPI.getWaSettings(),
        coachingAPI.getWaLogs(),
      ]);
      setWaSettings(s.data || {});
      setWaLogs(l.data || []);
    } catch {
      /* silent */
    } finally {
      setWaLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!form.days_of_week.length) {
      toast.error("Select at least one day");
      return;
    }
    if (!form.sports.length) {
      toast.error("Select at least one sport for this slot");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        form.days_of_week.map((day) =>
          coachingAPI.addAvailability({
            day_of_week: day,
            start_time: form.start_time,
            end_time: form.end_time,
            sports: form.sports,
          }),
        ),
      );
      toast.success(
        `${form.days_of_week.length > 1 ? form.days_of_week.length + " slots" : "Slot"} added`,
      );
      setAddOpen(false);
      setForm({
        days_of_week: [],
        start_time: "09:00",
        end_time: "10:00",
        sports: [],
      });
      loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSlot = async (id) => {
    try {
      await coachingAPI.removeAvailability(id);
      setSlots((p) => p.filter((s) => s.id !== id));
      toast.success("Removed");
    } catch {
      toast.error("Failed");
    }
  };

  const handleWaToggle = async (key, enabled) => {
    const next = { ...waSettings, [key]: { ...waSettings[key], enabled } };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({
        [key]: { ...next[key] },
      });
      setWaSettings(res.data);
      toast.success(enabled ? "Enabled" : "Disabled");
    } catch {
      toast.error("Failed");
      setWaSettings(waSettings);
    }
  };

  const handleWaConfig = async (key, field, value) => {
    const next = {
      ...waSettings,
      [key]: { ...waSettings[key], [field]: value },
    };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({ [key]: next[key] });
      setWaSettings(res.data);
    } catch {
      /* silent */
    }
  };

  const toggleSport = (sport) => {
    setCoachSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport],
    );
  };

  const handleSaveSports = async () => {
    setSportsSaving(true);
    try {
      await coachingAPI.updateProfile({ coaching_sports: coachSports });
      if (setUser)
        setUser((prev) => ({ ...prev, coaching_sports: coachSports }));
      toast.success("Sports updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSportsSaving(false);
    }
  };

  const toggleFormDay = (d) =>
    setForm((p) => ({
      ...p,
      days_of_week: p.days_of_week.includes(d)
        ? p.days_of_week.filter((x) => x !== d)
        : [...p.days_of_week, d],
    }));
  const toggleFormSport = (s) =>
    setForm((p) => ({
      ...p,
      sports: p.sports.includes(s)
        ? p.sports.filter((x) => x !== s)
        : [...p.sports, s],
    }));

  const handleChangeTab = (id) => {
    setTab(id);
    replaceParams({ tab: id === "availability" ? null : id });
  };

  const takenDays = new Set(slots.map((s) => s.day_of_week));

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/15">
        <div className=" mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-14 sm:h-16">
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
              aria-label="Go back"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/5 flex items-center justify-center flex-shrink-0">
                <Settings2 className="h-4 w-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold text-foreground leading-tight">
                  Coach Settings
                </h1>
                <p className="text-[11px] text-muted-foreground/50 leading-tight">
                  Manage your coaching preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar ─── */}
      <div className=" mx-auto px-4 sm:px-6 pt-4 pb-1">
        <div className="flex gap-1 bg-secondary/30 p-1 rounded-2xl">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleChangeTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all touch-manipulation ${
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground/60 hover:text-foreground/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className=" mx-auto px-4 sm:px-6 pt-4">
        <AnimatePresence mode="wait">
          {/* ═══ AVAILABILITY TAB ═══ */}
          {tab === "availability" && (
            <motion.div
              key="availability"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-foreground">
                    Weekly Availability
                  </h2>
                  <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                    Set your available time slots for bookings
                  </p>
                </div>
                <button
                  onClick={() => {
                    setForm({
                      days_of_week: [],
                      start_time: "09:00",
                      end_time: "10:00",
                      sports: [],
                    });
                    setAddOpen(true);
                  }}
                  className="h-9 px-4 rounded-full bg-brand-600 text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-brand-500 active:scale-95 transition-all shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Slot
                </button>
              </div>

              {/* Slots list */}
              {slotsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600/60" />
                  <p className="text-[12px] text-muted-foreground/40">
                    Loading availability...
                  </p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
                    <Clock className="h-7 w-7 text-muted-foreground/25" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-foreground/70 mb-1">
                    No availability set
                  </h3>
                  <p className="text-[12px] text-muted-foreground/40 max-w-[240px] leading-relaxed">
                    Add your weekly time slots so players can book sessions with
                    you.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {DAY_LABELS.map((day, dayIdx) => {
                    const daySlots = slots.filter(
                      (s) => s.day_of_week === dayIdx,
                    );
                    if (!daySlots.length) return null;
                    return (
                      <div
                        key={dayIdx}
                        className="rounded-2xl bg-card border border-border/20 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-secondary/15 border-b border-border/10">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
                            {DAY_FULL[dayIdx]}
                          </span>
                        </div>
                        <div className="p-3 space-y-2">
                          {daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/15 group"
                            >
                              <div className="h-8 w-8 rounded-full bg-brand-600/8 flex items-center justify-center flex-shrink-0">
                                <Clock className="h-3.5 w-3.5 text-brand-600/70" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-foreground">
                                  {fmt12h(slot.start_time)} -{" "}
                                  {fmt12h(slot.end_time)}
                                </p>
                                {(slot.sports || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {slot.sports.map((s) => (
                                      <span
                                        key={s}
                                        className="text-[10px] font-medium text-brand-600/70 bg-brand-600/8 px-2 py-0.5 rounded-full capitalize"
                                      >
                                        {s.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveSlot(slot.id)}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 active:scale-90 transition-all flex-shrink-0"
                                aria-label="Remove slot"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Availability Bottom Sheet / Modal */}
              <AnimatePresence>
                {addOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setAddOpen(false)}
                  >
                    <motion.div
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: "100%", opacity: 0 }}
                      transition={{
                        type: "spring",
                        damping: 30,
                        stiffness: 250,
                      }}
                      className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto border border-border/20 shadow-2xl"
                      style={{
                        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Handle bar (mobile) */}
                      <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                        <div className="w-8 h-1 rounded-full bg-border/50" />
                      </div>

                      {/* Header */}
                      <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-border/15">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-brand-600/10 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-brand-600" />
                          </div>
                          <div>
                            <h2 className="text-[15px] font-bold">
                              Add Availability
                            </h2>
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                              Create a new time slot
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setAddOpen(false)}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40 transition-all active:scale-90"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="px-5 py-4 space-y-5">
                        {/* Days */}
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-[12px] font-semibold text-foreground/70">
                              Select Days
                            </p>
                            <div className="flex gap-1">
                              {DAY_SHORTCUTS.map(({ label, days }) => {
                                const availableDays = days.filter(
                                  (d) => !takenDays.has(d),
                                );
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    disabled={availableDays.length === 0}
                                    onClick={() =>
                                      setForm((p) => ({
                                        ...p,
                                        days_of_week: availableDays,
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                      availableDays.length === 0
                                        ? "text-muted-foreground/20 cursor-not-allowed"
                                        : "text-muted-foreground/60 hover:text-brand-600 hover:bg-brand-600/5"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1.5">
                            {DAY_LABELS.map((day, i) => {
                              const selected = form.days_of_week.includes(i);
                              const taken = takenDays.has(i);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={taken}
                                  onClick={() => !taken && toggleFormDay(i)}
                                  title={taken ? "Slot already exists" : ""}
                                  className={`h-10 rounded-xl text-[11px] font-bold transition-all ${
                                    taken
                                      ? "text-muted-foreground/20 cursor-not-allowed line-through"
                                      : selected
                                        ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                                        : "bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50 hover:text-foreground"
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time presets */}
                        <div>
                          <p className="text-[12px] font-semibold text-foreground/70 mb-2.5">
                            Time Slot
                          </p>
                          <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {TIME_PRESETS.map((preset) => {
                              const active =
                                preset.start === form.start_time &&
                                preset.end === form.end_time;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      start_time: preset.start,
                                      end_time: preset.end,
                                    }))
                                  }
                                  className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                                    active
                                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                                      : "bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50 hover:text-foreground"
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                                Start
                              </label>
                              <input
                                type="time"
                                value={form.start_time}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    start_time: e.target.value,
                                  }))
                                }
                                className="w-full h-10 px-3 bg-secondary/20 border border-border/20 rounded-xl text-[13px] text-foreground outline-none focus:border-brand-600/40 focus:bg-secondary/30 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                                End
                              </label>
                              <input
                                type="time"
                                value={form.end_time}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    end_time: e.target.value,
                                  }))
                                }
                                className="w-full h-10 px-3 bg-secondary/20 border border-border/20 rounded-xl text-[13px] text-foreground outline-none focus:border-brand-600/40 focus:bg-secondary/30 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sports */}
                        <div>
                          <p className="text-[12px] font-semibold text-foreground/70 mb-2.5">
                            Sports
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(coachSports.length
                              ? coachSports
                              : ALL_SPORTS.slice(0, 8)
                            ).map((sport) => {
                              const selected = form.sports.includes(sport);
                              return (
                                <button
                                  key={sport}
                                  type="button"
                                  onClick={() => toggleFormSport(sport)}
                                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all capitalize ${
                                    selected
                                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                                      : "bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50 hover:text-foreground"
                                  }`}
                                >
                                  {sport.replace(/_/g, " ")}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Info note */}
                        {form.days_of_week.length > 1 && (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600/5 border border-brand-600/10">
                            <Zap className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                            <p className="text-[11px] text-brand-600/70">
                              {form.days_of_week.length} slots will be created —
                              one for each selected day
                            </p>
                          </div>
                        )}

                        {/* Submit */}
                        <button
                          onClick={handleAddSlot}
                          disabled={
                            saving ||
                            form.days_of_week.length === 0 ||
                            form.sports.length === 0
                          }
                          className="w-full h-11 rounded-xl bg-brand-600 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-brand-500 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {saving && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {form.days_of_week.length > 1
                            ? `Add ${form.days_of_week.length} Slots`
                            : "Add Slot"}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═══ WHATSAPP TAB ═══ */}
          {tab === "whatsapp" && (
            <motion.div
              key="whatsapp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-[15px] font-bold text-foreground">
                  WhatsApp Automations
                </h2>
                <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                  Automatic messages sent to your clients via WhatsApp
                </p>
              </div>

              {waLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600/60" />
                  <p className="text-[12px] text-muted-foreground/40">
                    Loading automations...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {AUTOMATIONS.map((a, idx) => {
                      const cfg = waSettings[a.key] || {};
                      const enabled = cfg.enabled ?? false;
                      const Icon = a.icon;
                      return (
                        <motion.div
                          key={a.key}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`rounded-2xl bg-card border p-4 transition-all ${
                            enabled
                              ? "border-brand-600/15"
                              : "border-border/20 opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                enabled ? "bg-brand-600/10" : "bg-secondary/30"
                              }`}
                            >
                              <Icon
                                className={`h-4.5 w-4.5 ${enabled ? "text-brand-600" : "text-muted-foreground/40"}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-foreground">
                                    {a.title}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">
                                    {a.desc}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    handleWaToggle(a.key, !enabled)
                                  }
                                  className={`relative shrink-0 w-11 h-[26px] rounded-full transition-colors ${
                                    enabled ? "bg-brand-600" : "bg-secondary/60"
                                  }`}
                                  aria-label={`Toggle ${a.title}`}
                                >
                                  <span
                                    className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                      enabled
                                        ? "translate-x-[18px]"
                                        : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </div>
                              {a.config && enabled && (
                                <div className="mt-3 flex items-center gap-2.5">
                                  <span className="text-[11px] text-muted-foreground/50 font-medium">
                                    {a.config.label}:
                                  </span>
                                  <select
                                    value={String(
                                      cfg[a.config.field] ??
                                        a.config.options[0].v,
                                    )}
                                    onChange={(e) =>
                                      handleWaConfig(
                                        a.key,
                                        a.config.field,
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-8 px-2.5 pr-7 bg-secondary/20 border border-border/20 rounded-lg text-[11px] font-medium text-foreground outline-none focus:border-brand-600/40 transition-colors appearance-none cursor-pointer"
                                    style={{
                                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                                      backgroundRepeat: "no-repeat",
                                      backgroundPosition: "right 8px center",
                                    }}
                                  >
                                    {a.config.options.map((o) => (
                                      <option key={o.v} value={String(o.v)}>
                                        {o.l}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Recent logs */}
                  {waLogs.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">
                          Recent Activity
                        </p>
                        <button
                          onClick={loadWa}
                          className="text-[11px] text-brand-600/60 hover:text-brand-600 font-medium transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                        {waLogs.slice(0, 20).map((log, idx) => {
                          const IC = ICON_MAP[log.automation_type] || Mail;
                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: idx * 0.02 }}
                              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border/15"
                            >
                              <div className="h-8 w-8 rounded-lg bg-secondary/30 flex items-center justify-center flex-shrink-0">
                                <IC className="h-3.5 w-3.5 text-muted-foreground/40" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">
                                  {log.client_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground/40 capitalize">
                                  {log.automation_type?.replace(/_/g, " ")}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    log.status === "sent"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-red-500/10 text-red-500"
                                  }`}
                                >
                                  {log.status}
                                </span>
                                <p className="text-[10px] text-muted-foreground/30 mt-0.5">
                                  {log.sent_at
                                    ? new Date(log.sent_at).toLocaleDateString()
                                    : ""}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ SPORTS TAB ═══ */}
          {tab === "sports" &&
            (() => {
              const customSports = coachSports.filter(
                (s) => !ALL_SPORTS.includes(s),
              );
              const allDisplaySports = [...ALL_SPORTS, ...customSports];
              const handleAddCustomSport = () => {
                const val = customSportInput
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "_");
                if (!val) return;
                if (allDisplaySports.includes(val)) {
                  if (!coachSports.includes(val)) toggleSport(val);
                  setCustomSportInput("");
                  return;
                }
                setCoachSports((prev) => [...prev, val]);
                setCustomSportInput("");
              };
              return (
                <motion.div
                  key="sports"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-[15px] font-bold text-foreground">
                      Coaching Sports
                    </h2>
                    <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                      Select the sports you coach — only these appear in your
                      forms and packages
                    </p>
                  </div>

                  {/* Sport chips */}
                  <div className="flex flex-wrap gap-2">
                    {allDisplaySports.map((sport) => {
                      const active = coachSports.includes(sport);
                      const isCustom = !ALL_SPORTS.includes(sport);
                      return (
                        <button
                          key={sport}
                          onClick={() => toggleSport(sport)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12px] font-semibold transition-all capitalize touch-manipulation ${
                            active
                              ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                              : "bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50 hover:text-foreground border border-border/15"
                          }`}
                        >
                          {active && (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                          {sport.replace(/_/g, " ")}
                          {isCustom && !active && (
                            <span className="text-[9px] text-muted-foreground/30 ml-0.5">
                              custom
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add custom sport */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        placeholder="Add a custom sport..."
                        value={customSportInput}
                        onChange={(e) => setCustomSportInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddCustomSport()
                        }
                        className="w-full h-10 pl-3.5 pr-3.5 bg-secondary/20 border border-border/20 rounded-xl text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-brand-600/40 focus:bg-secondary/30 transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleAddCustomSport}
                      disabled={!customSportInput.trim()}
                      className="h-10 px-4 rounded-xl bg-secondary/30 border border-border/20 text-[12px] font-semibold text-foreground/70 hover:bg-secondary/50 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>

                  {/* Selected summary */}
                  {coachSports.length > 0 && (
                    <div className="rounded-2xl bg-card border border-border/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[12px] font-semibold text-foreground/60">
                          Selected ({coachSports.length})
                        </p>
                        <p className="text-[10px] text-muted-foreground/30">
                          These appear in all your forms
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {coachSports.map((s) => (
                          <span
                            key={s}
                            className="flex items-center gap-1 bg-brand-600/8 text-brand-600 border border-brand-600/15 rounded-full px-3 py-1 text-[11px] font-semibold capitalize"
                          >
                            {s.replace(/_/g, " ")}
                            <button
                              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                              onClick={() => toggleSport(s)}
                              aria-label={`Remove ${s}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <button
                    onClick={handleSaveSports}
                    disabled={sportsSaving}
                    className="w-full h-11 rounded-xl bg-brand-600 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-brand-500 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
                  >
                    {sportsSaving && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Save Sports
                  </button>
                </motion.div>
              );
            })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
