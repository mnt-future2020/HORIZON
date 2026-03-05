import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { coachingAPI } from "@/lib/api";
import { fmt12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, MessageCircle, Dumbbell, Plus, Trash2,
  Loader2, CheckCircle2, X, Smartphone, Bell, AlertTriangle, Banknote, Smile, BarChart3, Mail,
} from "lucide-react";
import { toast } from "sonner";

/* ─── URL param utils (zero re-renders, no useSearchParams) ──── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_PRESETS = [
  { label: "5–6 AM",  start: "05:00", end: "06:00" },
  { label: "6–7 AM",  start: "06:00", end: "07:00" },
  { label: "7–8 AM",  start: "07:00", end: "08:00" },
  { label: "8–9 AM",  start: "08:00", end: "09:00" },
  { label: "4–5 PM",  start: "16:00", end: "17:00" },
  { label: "5–6 PM",  start: "17:00", end: "18:00" },
  { label: "6–7 PM",  start: "18:00", end: "19:00" },
  { label: "7–8 PM",  start: "19:00", end: "20:00" },
];
const DAY_SHORTCUTS = [
  { label: "Weekdays", days: [1,2,3,4,5] },
  { label: "Weekends", days: [0,6] },
  { label: "Everyday", days: [0,1,2,3,4,5,6] },
];
const ALL_SPORTS = [
  "football", "cricket", "badminton", "tennis", "basketball",
  "volleyball", "table_tennis", "swimming", "athletics", "kabaddi",
  "hockey", "chess", "cycling", "yoga", "fitness",
];
const AUTOMATIONS = [
  { key: "welcome",              icon: Smartphone,     title: "Welcome Message",         desc: "Sent automatically when you add a new offline client with a phone number" },
  { key: "booking_confirmation", icon: CheckCircle2,   title: "Booking Confirmation",    desc: "Sent when an online session is confirmed (payment or package)" },
  { key: "session_reminder",     icon: Bell,           title: "Session Reminder",        desc: "Sent to the player before an upcoming session",
    config: { field: "hours_before", label: "Remind", options: [{ v: 1, l: "1 hour before" }, { v: 2, l: "2 hours before" }, { v: 12, l: "12 hours before" }, { v: 24, l: "1 day before" }, { v: 48, l: "2 days before" }] } },
  { key: "package_expiry",       icon: AlertTriangle,  title: "Package Expiry Alert",    desc: "Sent when a student's package is about to expire",
    config: { field: "days_before", label: "Alert", options: [{ v: 1, l: "1 day before" }, { v: 2, l: "2 days before" }, { v: 3, l: "3 days before" }, { v: 5, l: "5 days before" }, { v: 7, l: "7 days before" }] } },
  { key: "payment_reminder",     icon: Banknote,       title: "Payment Reminder",        desc: "Sent daily with Razorpay link when monthly fee is due (until paid)" },
  { key: "no_show_followup",     icon: Smile,          title: "No-Show Follow-up",       desc: "Sent at 9 PM when a client misses a confirmed session" },
  { key: "monthly_progress",     icon: BarChart3,      title: "Monthly Progress Report", desc: "Sent to all active subscribers on the last day of each month" },
];
const ICON_MAP = { welcome: Smartphone, booking_confirmation: CheckCircle2, session_reminder: Bell, package_expiry: AlertTriangle, payment_reminder: Banknote, no_show_followup: Smile, monthly_progress: BarChart3 };

const TABS = [
  { id: "availability", icon: Clock,          label: "Availability" },
  { id: "whatsapp",     icon: MessageCircle,  label: "WhatsApp" },
  { id: "sports",       icon: Dumbbell,       label: "Sports" },
];

export default function CoachSettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [tab, setTab] = useState(() => getInitParam("tab") || "availability");

  // ── Availability ──
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ days_of_week: [], start_time: "09:00", end_time: "10:00", sports: [] });
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
    } catch { /* silent */ }
    finally { setSlotsLoading(false); }
  };

  const loadWa = async () => {
    setWaLoading(true);
    try {
      const [s, l] = await Promise.all([coachingAPI.getWaSettings(), coachingAPI.getWaLogs()]);
      setWaSettings(s.data || {});
      setWaLogs(l.data || []);
    } catch { /* silent */ }
    finally { setWaLoading(false); }
  };

  const handleAddSlot = async () => {
    if (!form.days_of_week.length) { toast.error("Select at least one day"); return; }
    if (!form.sports.length) { toast.error("Select at least one sport for this slot"); return; }
    setSaving(true);
    try {
      await Promise.all(form.days_of_week.map(day =>
        coachingAPI.addAvailability({ day_of_week: day, start_time: form.start_time, end_time: form.end_time, sports: form.sports })
      ));
      toast.success(`${form.days_of_week.length > 1 ? form.days_of_week.length + " slots" : "Slot"} added!`);
      setAddOpen(false);
      setForm({ days_of_week: [], start_time: "09:00", end_time: "10:00", sports: [] });
      loadSlots();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleRemoveSlot = async (id) => {
    try {
      await coachingAPI.removeAvailability(id);
      setSlots(p => p.filter(s => s.id !== id));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  const handleWaToggle = async (key, enabled) => {
    const next = { ...waSettings, [key]: { ...waSettings[key], enabled } };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({ [key]: { ...next[key] } });
      setWaSettings(res.data);
      toast.success(enabled ? "Enabled" : "Disabled");
    } catch { toast.error("Failed"); setWaSettings(waSettings); }
  };

  const handleWaConfig = async (key, field, value) => {
    const next = { ...waSettings, [key]: { ...waSettings[key], [field]: value } };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({ [key]: next[key] });
      setWaSettings(res.data);
    } catch { /* silent */ }
  };

  const toggleSport = (sport) => {
    setCoachSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const handleSaveSports = async () => {
    setSportsSaving(true);
    try {
      const res = await coachingAPI.updateProfile({ coaching_sports: coachSports });
      if (setUser) setUser(prev => ({ ...prev, coaching_sports: coachSports }));
      toast.success("Sports updated!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSportsSaving(false); }
  };

  const toggleFormDay = (d) => setForm(p => ({ ...p, days_of_week: p.days_of_week.includes(d) ? p.days_of_week.filter(x => x !== d) : [...p.days_of_week, d] }));
  const toggleFormSport = (s) => setForm(p => ({ ...p, sports: p.sports.includes(s) ? p.sports.filter(x => x !== s) : [...p.sports, s] }));

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="admin-page-title text-xl">Coach Settings</h1>
          <p className="text-xs text-muted-foreground">Availability · WhatsApp · Sports</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-secondary/20 p-1 rounded-[28px] mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); replaceParams({ tab: t.id === "availability" ? null : t.id }); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── AVAILABILITY TAB ── */}
      {tab === "availability" && (() => {
        const activePreset = TIME_PRESETS.find(p => p.start === form.start_time && p.end === form.end_time);
        const takenDays = new Set(slots.map(s => s.day_of_week));
        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm">Weekly Availability</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set your available time slots</p>
              </div>
              <Button size="sm" className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                onClick={() => { setForm({ days_of_week: [], start_time: "09:00", end_time: "10:00", sports: [] }); setAddOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
              </Button>
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No availability set. Add your time slots to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {DAY_LABELS.map((day, dayIdx) => {
                  const daySlots = slots.filter(s => s.day_of_week === dayIdx);
                  if (!daySlots.length) return null;
                  return (
                    <div key={dayIdx} className="rounded-[28px] bg-card border border-border/40 shadow-sm p-3">
                      <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{day}</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {daySlots.map(slot => (
                          <div key={slot.id} className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-1.5 text-xs admin-btn">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>{fmt12h(slot.start_time)} - {fmt12h(slot.end_time)}</span>
                            {(slot.sports || []).map(s => (
                              <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>
                            ))}
                            <button onClick={() => handleRemoveSlot(slot.id)}
                              className="text-destructive hover:text-red-400 ml-1 shrink-0"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Availability Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogContent className="bg-card border-border/40 max-w-[95vw] sm:max-w-sm rounded-[28px]">
                <DialogHeader><DialogTitle className="admin-heading">Add Availability Slot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {/* Days */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Days *</Label>
                      <div className="flex gap-1">
                        {DAY_SHORTCUTS.map(({ label, days }) => {
                          const availableDays = days.filter(d => !takenDays.has(d));
                          return (
                            <button key={label} type="button"
                              disabled={availableDays.length === 0}
                              onClick={() => setForm(p => ({ ...p, days_of_week: availableDays }))}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                                availableDays.length === 0
                                  ? "border-border text-muted-foreground/30 cursor-not-allowed opacity-40"
                                  : "border-border/40 text-muted-foreground hover:border-brand-600/40 hover:text-brand-600"
                              }`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {DAY_LABELS.map((day, i) => {
                        const selected = form.days_of_week.includes(i);
                        const taken = takenDays.has(i);
                        return (
                          <button key={i} type="button"
                            disabled={taken}
                            onClick={() => !taken && setForm(p => ({
                              ...p,
                              days_of_week: selected ? p.days_of_week.filter(d => d !== i) : [...p.days_of_week, i],
                            }))}
                            title={taken ? "Slot already exists for this day" : ""}
                            className={`flex-1 h-9 rounded-xl text-[11px] font-bold border transition-all relative ${
                              taken
                                ? "border-border/30 text-muted-foreground/30 bg-muted/20 cursor-not-allowed line-through"
                                : selected
                                  ? "bg-brand-600/15 border-brand-600/50 text-brand-600"
                                  : "border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
                            }`}>
                            {day}
                            {taken && (
                              <span className="absolute -top-1 -right-0.5 w-2 h-2 rounded-full bg-muted-foreground/40" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {takenDays.size > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">Strikethrough days already have a slot</p>
                    )}
                    {form.days_of_week.length === 0 && (
                      <p className="text-[10px] text-amber-500 mt-1">Select at least one day</p>
                    )}
                  </div>

                  {/* Time presets */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Time *</Label>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      {TIME_PRESETS.map(preset => (
                        <button key={preset.label} type="button"
                          onClick={() => setForm(p => ({ ...p, start_time: preset.start, end_time: preset.end }))}
                          className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            activePreset?.label === preset.label
                              ? "bg-brand-600/15 border-brand-600/50 text-brand-600"
                              : "border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
                          }`}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Custom start</Label>
                        <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className="mt-1 h-8 text-xs bg-secondary/20 border-border/40 rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Custom end</Label>
                        <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className="mt-1 h-8 text-xs bg-secondary/20 border-border/40 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  {/* Sports */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Sports *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(coachSports.length ? coachSports : ALL_SPORTS.slice(0, 8)).map(sport => (
                        <button key={sport} type="button" onClick={() => toggleFormSport(sport)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all capitalize ${
                            form.sports.includes(sport) ? "bg-brand-600/15 border-brand-600/40 text-brand-600" : "border-border/40 text-muted-foreground hover:text-foreground"
                          }`}>
                          {sport.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                    {form.sports.length === 0 && (
                      <p className="text-[10px] text-amber-500 mt-1">Select at least one sport</p>
                    )}
                  </div>

                  {form.days_of_week.length > 1 && (
                    <p className="text-[10px] text-muted-foreground bg-brand-600/5 border border-brand-600/20 rounded-xl px-3 py-2">
                      {form.days_of_week.length} slots will be created — one for each selected day.
                    </p>
                  )}
                  <Button className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                    disabled={saving || form.days_of_week.length === 0 || form.sports.length === 0}
                    onClick={handleAddSlot}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {form.days_of_week.length > 1 ? `Add ${form.days_of_week.length} Slots` : "Add Slot"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        );
      })()}

      {/* ── WHATSAPP TAB ── */}
      {tab === "whatsapp" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h2 className="font-bold text-sm">WhatsApp Automations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatic messages sent to your clients. Configure WhatsApp credentials in SuperAdmin → Platform Settings first.
            </p>
          </div>

          {waLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {AUTOMATIONS.map(a => {
                  const cfg = waSettings[a.key] || {};
                  const enabled = cfg.enabled ?? false;
                  return (
                    <div key={a.key} className={`rounded-[24px] bg-card shadow-sm p-4 border transition-all ${enabled ? "border-brand-600/20" : "border-border/40 opacity-70"}`}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-muted-foreground"><a.icon className="h-5 w-5" /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
                            </div>
                            <button onClick={() => handleWaToggle(a.key, !enabled)}
                              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? "bg-brand-600" : "bg-muted"}`}>
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>
                          {a.config && enabled && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{a.config.label}:</span>
                              <Select value={String(cfg[a.config.field] ?? a.config.options[0].v)}
                                onValueChange={v => handleWaConfig(a.key, a.config.field, Number(v))}>
                                <SelectTrigger className="h-7 text-xs w-36 bg-secondary/20 border-border/40 rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {a.config.options.map(o => (
                                    <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent logs */}
              {waLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Activity</p>
                    <button onClick={loadWa} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {waLogs.slice(0, 20).map(log => (
                      <div key={log.id} className="flex items-center gap-2 px-3 py-2 rounded-[28px] bg-card border border-border/40 shadow-sm">
                        <span className="shrink-0 text-muted-foreground">{(() => { const IC = ICON_MAP[log.automation_type] || Mail; return <IC className="h-4 w-4" />; })()}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{log.client_name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{log.automation_type?.replace(/_/g, " ")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${log.status === "sent" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                            {log.status}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {log.sent_at ? new Date(log.sent_at).toLocaleDateString() : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ── SPORTS TAB ── */}
      {tab === "sports" && (() => {
        // Combine predefined list + any custom sports the coach already has
        const customSports = coachSports.filter(s => !ALL_SPORTS.includes(s));
        const allDisplaySports = [...ALL_SPORTS, ...customSports];
        const handleAddCustomSport = () => {
          const val = customSportInput.trim().toLowerCase().replace(/\s+/g, "_");
          if (!val) return;
          if (allDisplaySports.includes(val)) {
            if (!coachSports.includes(val)) toggleSport(val);
            setCustomSportInput("");
            return;
          }
          setCoachSports(prev => [...prev, val]);
          setCustomSportInput("");
        };
        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div>
              <h2 className="font-bold text-sm">Coaching Sports</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select the sports you coach. Only these will appear in your session slots, packages, and client forms.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {allDisplaySports.map(sport => {
                const active = coachSports.includes(sport);
                const isCustom = !ALL_SPORTS.includes(sport);
                return (
                  <button key={sport} onClick={() => toggleSport(sport)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all capitalize ${active ? "bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-600/20" : "border-border/40 text-muted-foreground hover:border-brand-600/50 hover:text-foreground"}`}>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                    {sport.replace(/_/g, " ")}
                    {isCustom && <span className="ml-1 text-[10px] opacity-60">custom</span>}
                  </button>
                );
              })}
            </div>

            {/* Add custom sport */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a sport not listed above…"
                value={customSportInput}
                onChange={e => setCustomSportInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCustomSport()}
                className="h-9 text-sm bg-secondary/20 border-border/40 rounded-xl flex-1"
              />
              <Button size="sm" variant="outline" onClick={handleAddCustomSport}
                disabled={!customSportInput.trim()}
                className="h-9 px-4 font-bold text-xs shrink-0">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            {coachSports.length > 0 && (
              <div className="rounded-[28px] bg-card border border-border/40 shadow-sm p-4">
                <p className="text-xs text-muted-foreground mb-2">Selected ({coachSports.length}) — these are the only sports shown in all your forms</p>
                <div className="flex flex-wrap gap-1.5">
                  {coachSports.map(s => (
                    <Badge key={s} className="bg-brand-600/10 text-brand-600 border-brand-600/20 capitalize text-xs admin-btn">
                      {s.replace(/_/g, " ")}
                      <button className="ml-1.5 opacity-60 hover:opacity-100" onClick={() => toggleSport(s)}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleSaveSports} disabled={sportsSaving}>
              {sportsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Sports
            </Button>
          </motion.div>
        );
      })()}
    </div>
  );
}
