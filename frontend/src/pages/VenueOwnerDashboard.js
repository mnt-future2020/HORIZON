import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { venueAPI, bookingAPI, analyticsAPI, subscriptionAPI, uploadAPI, payoutAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AthleticStatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, IndianRupee, TrendingUp, TrendingDown, Calendar, Plus, Trash2, BarChart2, BarChart3, Clock, ShieldAlert, Crown, CheckCircle, Pencil, Users, CreditCard, X, ChevronLeft, ChevronRight, Filter, History, CalendarDays, CircleDot, AlertCircle, ArrowUpDown, Star, MessageSquare, QrCode, ExternalLink, Copy, Check, Globe, ImagePlus, Upload, Brain, Zap, Camera, UserCheck, UserX, ClipboardList, Loader2, XCircle, Banknote, Eye, Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Professional / venue owner imagery
const OWNER_HERO = "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80";
const VENUE_BANNER = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Image upload component for venue images — S3 priority, local fallback */
function VenueImageUpload({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFiles = async (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    const uploaded = [...images];
    for (const file of arr) {
      try {
        const res = await uploadAPI.image(file, (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        uploaded.push(res.data.url);
        setUploadProgress(0);
      } catch (err) {
        toast.error(`Upload failed: ${err?.response?.data?.detail || "Unknown error"}`);
        break;
      }
    }
    onChange(uploaded);
    setUploading(false);
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Venue Images</Label>
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Upload button */}
      <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium ${uploading ? "opacity-60 pointer-events-none border-border" : "border-primary/40 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary"}`}>
        {uploading ? (
          <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Uploading {uploadProgress > 0 ? `${uploadProgress}%` : "..."}</>
        ) : (
          <><ImagePlus className="h-4 w-4" />{images.length > 0 ? "Add more images" : "Upload venue images"}</>
        )}
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} disabled={uploading} />
      </label>
      <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP · max 10 MB each. Images appear on your public venue page.</p>
    </div>
  );
}

export default function VenueOwnerDashboard({ defaultView }) {
  const { user } = useAuth();

  // Pending/rejected/suspended account gate
  if (user?.account_status === "pending") {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center" data-testid="pending-approval-screen">
        <div className="glass-card rounded-lg p-8 space-y-4">
          <ShieldAlert className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="font-display text-xl font-black">Account Pending Approval</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your venue owner registration is being reviewed by the Horizon team. You'll receive a notification once approved.
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            Check back soon — most approvals happen within 24 hours.
          </div>
        </div>
      </div>
    );
  }
  if (user?.account_status === "rejected" || user?.account_status === "suspended") {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center" data-testid="account-blocked-screen">
        <div className="glass-card rounded-lg p-8 space-y-4">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="font-display text-xl font-black">Account {user.account_status === "rejected" ? "Not Approved" : "Suspended"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {user.account_status === "rejected"
              ? "Your venue owner registration was not approved. Please contact support for more information."
              : "Your account has been suspended. Please contact support to resolve this."}
          </p>
        </div>
      </div>
    );
  }

  return <VenueOwnerDashboardContent defaultView={defaultView} />;
}

function VenueOwnerDashboardContent({ defaultView }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isManageView = location.pathname === "/owner/manage";
  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get("tab");
  const VALID_TABS = ["bookings", "slots", "reviews", "pricing", "checkin", "plan", "payouts"];
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : "bookings";
  const setActiveTab = (tab) => {
    const sp = new URLSearchParams(location.search);
    sp.set("tab", tab);
    navigate({ search: sp.toString() }, { replace: true });
  };
  const [venues, setVenues] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pricingRules, setPricingRules] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createVenueOpen, setCreateVenueOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [bookingView, setBookingView] = useState("list");
  const [pricingView, setPricingView] = useState("rules");
  const [venueReviews, setVenueReviews] = useState([]);
  const [showVenueQR, setShowVenueQR] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [editVenueForm, setEditVenueForm] = useState({});
  const [savingVenue, setSavingVenue] = useState(false);
  const [baseTurf, setBaseTurf] = useState(null);     // { sport, idx } — create form selected base
  const [editBaseTurf, setEditBaseTurf] = useState(null); // edit form selected base
  const SPORT_SUGGESTIONS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball", "Table Tennis", "Hockey", "Pickleball", "Swimming"];
  const AMENITY_SUGGESTIONS = ["Parking", "Washroom", "Changing Room", "Drinking Water", "Floodlights", "Cafeteria", "First Aid", "WiFi", "Seating Area", "Scoreboard"];
  const [sportInput, setSportInput] = useState("");
  const [amenityInput, setAmenityInput] = useState("");
  const [venueForm, setVenueForm] = useState({
    name: "", description: "", sports: [], address: "", area: "", city: "Bengaluru",
    slot_duration_minutes: 60, opening_hour: 6, closing_hour: 23,
    amenities: [], images: [], turf_config: [],
  });

  // Shared venue form helpers — used by both create and edit forms
  const makeVenueHelpers = (setForm, setSportInp, setAmenityInp) => ({
    addSport: (sport) => {
      const s = sport.trim().toLowerCase();
      setForm(p => {
        if (!s || (p.sports || []).includes(s)) return p;
        return { ...p, sports: [...(p.sports || []), s], turf_config: [...(p.turf_config || []), { sport: s, turfs: [{ name: `${sport.trim()} Turf 1`, price: 2000 }] }] };
      });
      setSportInp("");
    },
    removeSport: (sport) => setForm(p => ({ ...p, sports: (p.sports || []).filter(s => s !== sport), turf_config: (p.turf_config || []).filter(tc => tc.sport !== sport) })),
    addAmenity: (amenity) => {
      const a = amenity.trim();
      setForm(p => {
        if (!a || (p.amenities || []).includes(a)) return p;
        return { ...p, amenities: [...(p.amenities || []), a] };
      });
      setAmenityInp("");
    },
    removeAmenity: (amenity) => setForm(p => ({ ...p, amenities: (p.amenities || []).filter(a => a !== amenity) })),
    addTurf: (sport) => setForm(p => ({ ...p, turf_config: (p.turf_config || []).map(tc => tc.sport === sport ? { ...tc, turfs: [...tc.turfs, { name: `${sport} Turf ${tc.turfs.length + 1}`, price: 2000 }] } : tc) })),
    removeTurf: (sport, idx) => setForm(p => ({ ...p, turf_config: (p.turf_config || []).map(tc => tc.sport === sport ? { ...tc, turfs: tc.turfs.filter((_, i) => i !== idx) } : tc) })),
    renameTurf: (sport, idx, name) => setForm(p => ({ ...p, turf_config: (p.turf_config || []).map(tc => tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, name } : t) } : tc) })),
    updateTurfPrice: (sport, idx, price) => setForm(p => ({ ...p, turf_config: (p.turf_config || []).map(tc => tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, price: Number(price) } : t) } : tc) })),
  });

  const createH = makeVenueHelpers(setVenueForm, setSportInput, setAmenityInput);
  const addSport = createH.addSport, removeSport = createH.removeSport;
  const addAmenity = createH.addAmenity, removeAmenity = createH.removeAmenity;
  const addTurfToSport = createH.addTurf, removeTurfFromSport = createH.removeTurf;
  const renameTurf = createH.renameTurf, updateTurfPrice = createH.updateTurfPrice;
  // AM/PM helpers
  const to12h = (h24) => {
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return { hour: h12, ampm };
  };
  const to24h = (h12, ampm) => {
    if (ampm === "AM") return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  };
  const emptyRule = {
    name: "",
    rule_type: "discount",
    value_type: "percent",
    value: 20,
    schedule_type: "recurring",
    conditions: { days: [], time_range: { start: "18:00", end: "22:00" } },
    date_from: "", date_to: "",
    time_from: "18:00", time_to: "22:00",
    is_active: true,
  };
  const [ruleForm, setRuleForm] = useState({ ...emptyRule });

  useEffect(() => {
    subscriptionAPI.myPlan().then(r => setPlanData(r.data)).catch(() => {});
  }, []);

  const handleUpgrade = async (planId) => {
    setUpgrading(true);
    try {
      await subscriptionAPI.upgrade({ plan_id: planId });
      const r = await subscriptionAPI.myPlan();
      setPlanData(r.data);
      toast.success("Plan upgraded!");
    } catch (err) { toast.error(err.response?.data?.detail || "Upgrade failed"); }
    finally { setUpgrading(false); }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, bRes] = await Promise.all([
        venueAPI.getOwnerVenues().catch(() => ({ data: [] })),
        bookingAPI.list().catch(() => ({ data: [] })),
      ]);
      const venueList = Array.isArray(vRes.data) ? vRes.data : [];
      const bookingList = Array.isArray(bRes.data) ? bRes.data : [];
      setVenues(venueList);
      setBookings(bookingList);
      if (venueList.length > 0) {
        const v = selectedVenue || venueList[0];
        setSelectedVenue(v);
        const [aRes, pRes] = await Promise.all([
          analyticsAPI.venue(v.id).catch(() => ({ data: null })),
          venueAPI.getPricingRules(v.id).catch(() => ({ data: [] })),
        ]);
        setAnalytics(aRes.data);
        setPricingRules(Array.isArray(pRes.data) ? pRes.data : []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load payout data
  const loadPayoutData = useCallback(async () => {
    try {
      const [summaryRes, payoutsRes, accountRes] = await Promise.allSettled([
        payoutAPI.mySummary(),
        payoutAPI.myPayouts(),
        payoutAPI.getLinkedAccount(),
      ]);
      if (summaryRes.status === "fulfilled") setPayoutSummary(summaryRes.value.data);
      if (payoutsRes.status === "fulfilled") { const pd = payoutsRes.value.data; setMyPayouts(Array.isArray(pd) ? pd : pd?.settlements || []); }
      if (accountRes.status === "fulfilled") { const ad = accountRes.value.data; setLinkedAccount(ad?.linked === false ? null : ad); }
    } catch {}
  }, []);

  useEffect(() => { loadPayoutData(); }, [loadPayoutData]);

  // Load reviews when selectedVenue changes
  useEffect(() => {
    if (selectedVenue) {
      venueAPI.getReviews(selectedVenue.id).then(res => setVenueReviews(res.data)).catch(() => setVenueReviews([]));
    }
  }, [selectedVenue]);

  const handleCreateVenue = async () => {
    try {
      const payload = { ...venueForm };
      // Compute total turfs from turf_config
      if (payload.turf_config?.length) {
        payload.turfs = payload.turf_config.reduce((sum, tc) => sum + tc.turfs.length, 0);
      } else {
        payload.turfs = 1;
      }
      // Compute base_price from selected base turf
      const bt = baseTurf || { sport: payload.turf_config?.[0]?.sport, idx: 0 };
      const baseTc = payload.turf_config?.find(tc => tc.sport === bt.sport);
      payload.base_price = baseTc?.turfs?.[bt.idx]?.price || 2000;
      await venueAPI.create(payload);
      toast.success("Venue created!");
      setCreateVenueOpen(false);
      setBaseTurf(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const [editSportInput, setEditSportInput] = useState("");
  const [editAmenityInput, setEditAmenityInput] = useState("");

  // ─── Payout state ───
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [myPayouts, setMyPayouts] = useState([]);
  const [linkedAccount, setLinkedAccount] = useState(null);
  const [bankForm, setBankForm] = useState({ account_number: "", ifsc_code: "", beneficiary_name: "", bank_name: "", business_type: "individual", phone: "", email: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [payoutDetailDialog, setPayoutDetailDialog] = useState(null);

  // Edit form helpers — reuse same factory
  const editH = makeVenueHelpers(setEditVenueForm, setEditSportInput, setEditAmenityInput);
  const addEditSport = editH.addSport, removeEditSport = editH.removeSport;
  const addEditAmenity = editH.addAmenity, removeEditAmenity = editH.removeAmenity;
  const addEditTurf = editH.addTurf, removeEditTurf = editH.removeTurf;
  const renameEditTurf = editH.renameTurf, updateEditTurfPrice = editH.updateTurfPrice;

  const openEditVenue = () => {
    if (!selectedVenue) return;
    setEditVenueForm({
      name: selectedVenue.name || "",
      description: selectedVenue.description || "",
      address: selectedVenue.address || "",
      area: selectedVenue.area || "",
      city: selectedVenue.city || "",
      sports: selectedVenue.sports || [],
      amenities: selectedVenue.amenities || [],
      opening_hour: selectedVenue.opening_hour || 6,
      closing_hour: selectedVenue.closing_hour || 23,
      turf_config: selectedVenue.turf_config || [],
      slot_duration_minutes: selectedVenue.slot_duration_minutes || 60,
      images: selectedVenue.images || [],
    });
    setEditSportInput("");
    setEditAmenityInput("");
    // Init editBaseTurf: find turf whose price matches existing base_price
    let foundBT = null;
    for (const tc of (selectedVenue.turf_config || [])) {
      const idx = (tc.turfs || []).findIndex(t => t.price === selectedVenue.base_price);
      if (idx >= 0) { foundBT = { sport: tc.sport, idx }; break; }
    }
    if (!foundBT && selectedVenue.turf_config?.[0]) {
      foundBT = { sport: selectedVenue.turf_config[0].sport, idx: 0 };
    }
    setEditBaseTurf(foundBT);
    setEditVenueOpen(true);
  };

  const handleSaveVenue = async () => {
    if (!selectedVenue) return;
    setSavingVenue(true);
    try {
      const payload = { ...editVenueForm };
      if (payload.turf_config?.length) {
        payload.turfs = payload.turf_config.reduce((sum, tc) => sum + tc.turfs.length, 0);
      }
      // Compute base_price from selected base turf
      const bt = editBaseTurf || { sport: payload.turf_config?.[0]?.sport, idx: 0 };
      const baseTc = payload.turf_config?.find(tc => tc.sport === bt.sport);
      payload.base_price = baseTc?.turfs?.[bt.idx]?.price || 2000;
      const res = await venueAPI.update(selectedVenue.id, payload);
      setSelectedVenue(res.data);
      setVenues(prev => prev.map(v => v.id === res.data.id ? res.data : v));
      toast.success("Venue updated! Changes are live on the public page.");
      setEditVenueOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSavingVenue(false);
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ ...emptyRule });
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name || "",
      rule_type: rule.rule_type || (rule.action?.type === "multiplier" ? "surge" : "discount"),
      value_type: rule.value_type || "percent",
      value: rule.value ?? (rule.action?.value ? Math.round(rule.action.value * 100) : 20),
      schedule_type: rule.schedule_type || "recurring",
      conditions: { days: rule.conditions?.days || [], time_range: rule.conditions?.time_range || { start: "18:00", end: "22:00" } },
      date_from: rule.date_from || "",
      date_to: rule.date_to || "",
      time_from: rule.time_from || rule.conditions?.time_range?.start || "18:00",
      time_to: rule.time_to || rule.conditions?.time_range?.end || "22:00",
      is_active: rule.is_active !== false,
    });
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedVenue) return;
    try {
      if (editingRule) {
        await venueAPI.updatePricingRule(editingRule.id, ruleForm);
        toast.success("Rule updated!");
      } else {
        await venueAPI.createPricingRule(selectedVenue.id, ruleForm);
        toast.success("Rule created!");
      }
      setRuleDialogOpen(false);
      setEditingRule(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      await venueAPI.togglePricingRule(ruleId);
      setPricingRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !r.is_active } : r));
      toast.success("Rule toggled");
    } catch (err) { toast.error("Failed to toggle rule"); }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await venueAPI.deletePricingRule(ruleId);
      setPricingRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success("Rule deleted");
    } catch (err) { toast.error("Failed to delete rule"); }
  };

  const handleSelectVenue = async (v) => {
    setSelectedVenue(v);
    const [aRes, pRes] = await Promise.all([
      analyticsAPI.venue(v.id).catch(() => ({ data: null })),
      venueAPI.getPricingRules(v.id).catch(() => ({ data: [] })),
    ]);
    setAnalytics(aRes.data);
    setPricingRules(pRes.data || []);
  };

  const toggleDay = (dayIndex) => {
    setRuleForm(prev => {
      const days = prev.conditions.days || [];
      return {
        ...prev,
        conditions: {
          ...prev.conditions,
          days: days.includes(dayIndex) ? days.filter(d => d !== dayIndex) : [...days, dayIndex],
        },
      };
    });
  };

  const basePrice = selectedVenue?.base_price || 2000;
  const previewPrice = (rule) => {
    const val = parseFloat(rule.value) || 0;
    const vtype = rule.value_type || "percent";
    if (rule.rule_type === "discount") {
      return vtype === "percent" ? Math.max(Math.round(basePrice * (1 - val / 100)), 0) : Math.max(basePrice - val, 0);
    }
    if (rule.rule_type === "surge") {
      return vtype === "percent" ? Math.round(basePrice * (1 + val / 100)) : basePrice + val;
    }
    // legacy
    if (rule.action?.type === "multiplier") return Math.round(basePrice * (rule.action.value || 1));
    if (rule.action?.type === "discount") return Math.round(basePrice * (1 - (rule.action.value || 0)));
    return basePrice;
  };

  const totalRevenue = analytics?.total_revenue || 0;
  const totalBookings = analytics?.total_bookings || 0;

  const today = new Date().toISOString().split("T")[0];

  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    if (selectedVenue) {
      filtered = filtered.filter(b => b.venue_id === selectedVenue.id);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    if (timeFilter === "upcoming") {
      filtered = filtered.filter(b => b.date >= today);
    } else if (timeFilter === "past") {
      filtered = filtered.filter(b => b.date < today);
    }
    filtered.sort((a, b) => {
      const ad = a.date || "", bd = b.date || "", ast = a.start_time || "", bst = b.start_time || "";
      return sortOrder === "desc" ? bd.localeCompare(ad) || bst.localeCompare(ast) : ad.localeCompare(bd) || ast.localeCompare(bst);
    });
    return filtered;
  }, [bookings, selectedVenue, statusFilter, timeFilter, sortOrder, today]);

  const bookingStats = useMemo(() => {
    const venueBookings = selectedVenue ? bookings.filter(b => b.venue_id === selectedVenue.id) : bookings;
    return {
      total: venueBookings.length,
      confirmed: venueBookings.filter(b => b.status === "confirmed").length,
      pending: venueBookings.filter(b => ["pending", "payment_pending"].includes(b.status)).length,
      cancelled: venueBookings.filter(b => b.status === "cancelled").length,
      upcoming: venueBookings.filter(b => b.date >= today).length,
    };
  }, [bookings, selectedVenue, today]);

  const openBookingDetail = (booking) => {
    setSelectedBooking(booking);
    setBookingDetailOpen(true);
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await bookingAPI.cancel(bookingId);
      toast.success("Booking cancelled");
      setBookingDetailOpen(false);
      setSelectedBooking(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel");
    }
  };

  const statusConfig = {
    confirmed: { color: "bg-brand-500/15 text-brand-400 border-brand-500/20", label: "Confirmed" },
    pending: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", label: "Pending" },
    payment_pending: { color: "bg-sky-500/15 text-sky-400 border-sky-500/20", label: "Awaiting Payment" },
    cancelled: { color: "bg-destructive/15 text-destructive border-destructive/20", label: "Cancelled" },
    expired: { color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20", label: "Expired" },
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6" data-testid="owner-dashboard">
      {/* Welcome Hero, Stats, Venue Selector — only on Dashboard home */}
      {!isManageView && (<>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden"
      >
        <div className="grid md:grid-cols-3 gap-0">
          {/* Text Content */}
          <div className="md:col-span-2 p-8 md:p-10 flex flex-col justify-center">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Venue Owner</span>
            <h1 className="font-display text-display-md md:text-display-lg font-black tracking-athletic mt-2 truncate">
              Welcome, <span className="bg-gradient-athletic bg-clip-text text-transparent">{user?.name}</span>
            </h1>
            <p className="text-muted-foreground font-semibold mt-3 text-base">
              Manage your venues, track revenue, and grow your sports business.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Button
                onClick={() => setCreateVenueOpen(true)}
                className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide h-12 px-6 shrink-0 rounded-xl"
                data-testid="create-venue-btn"
              >
                <Plus className="h-5 w-5 mr-2" /> Add Venue
              </Button>
            </div>
          </div>
          {/* Professional Image */}
          <div className="hidden md:block relative h-full min-h-[220px]">
            <img
              src={OWNER_HERO}
              alt="Professional team meeting"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 to-transparent" />
          </div>
        </div>
      </motion.div>

      <Dialog open={createVenueOpen} onOpenChange={(o) => { setCreateVenueOpen(o); if (!o) setBaseTurf(null); }}>
          <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">Create Venue</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div><Label className="text-xs text-muted-foreground">Name *</Label>
                <Input value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))}
                  className="mt-1 bg-background border-border" data-testid="venue-name-input" /></div>
              <div><Label className="text-xs text-muted-foreground">Description</Label>
                <textarea value={venueForm.description} onChange={e => setVenueForm(p => ({ ...p, description: e.target.value }))}
                  rows={6} placeholder={"Football:\n- Wearing football studs recommended\n- Metal studs not allowed\n\nCricket:\n- Sports equipment provided\n- Barefoot play prohibited"}
                  className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/50" data-testid="venue-desc-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Address</Label>
                  <Input value={venueForm.address} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="venue-address-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Area</Label>
                  <Input value={venueForm.area} onChange={e => setVenueForm(p => ({ ...p, area: e.target.value }))}
                    placeholder="Koramangala" className="mt-1 bg-background border-border" /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">City *</Label>
                <Input value={venueForm.city} onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))}
                  className="mt-1 bg-background border-border" data-testid="venue-city-input" /></div>

              {/* Sports — dynamic input */}
              <div>
                <Label className="text-xs text-muted-foreground">Sports *</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={sportInput} onChange={e => setSportInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSport(sportInput))}
                    placeholder="Type a sport and press Enter" className="bg-background border-border flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={() => addSport(sportInput)} disabled={!sportInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {/* Added sports chips + remaining suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {venueForm.sports.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground border border-primary">
                      {s}
                      <button type="button" onClick={() => removeSport(s)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {SPORT_SUGGESTIONS.filter(s => !venueForm.sports.includes(s.toLowerCase())).map(s => (
                    <button key={s} type="button" onClick={() => addSport(s)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border hover:border-primary/50 transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities — dynamic input */}
              <div>
                <Label className="text-xs text-muted-foreground">Amenities</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={amenityInput} onChange={e => setAmenityInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAmenity(amenityInput))}
                    placeholder="Type an amenity and press Enter" className="bg-background border-border flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={() => addAmenity(amenityInput)} disabled={!amenityInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {/* Added amenities chips + remaining suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {venueForm.amenities.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground border border-primary">
                      {a}
                      <button type="button" onClick={() => removeAmenity(a)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {AMENITY_SUGGESTIONS.filter(a => !venueForm.amenities.includes(a)).map(a => (
                    <button key={a} type="button" onClick={() => addAmenity(a)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border hover:border-primary/50 transition-colors">
                      + {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-sport Turf Configuration */}
              {venueForm.turf_config.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Turf Configuration</Label>
                  <div className="space-y-3 mt-1.5">
                    {venueForm.turf_config.map(tc => (
                      <div key={tc.sport} className="border border-border rounded-lg p-3 bg-secondary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">{tc.sport}</span>
                          <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => addTurfToSport(tc.sport)}>
                            <Plus className="h-3 w-3 mr-1" /> Add Turf
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {tc.turfs.map((t, idx) => {
                            const isBase = baseTurf ? (baseTurf.sport === tc.sport && baseTurf.idx === idx)
                              : (venueForm.turf_config[0]?.sport === tc.sport && idx === 0);
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer shrink-0" title="Set as base price">
                                  <input type="radio" name="base_turf_create" checked={isBase}
                                    onChange={() => setBaseTurf({ sport: tc.sport, idx })}
                                    className="accent-primary w-3 h-3" />
                                  <span className={`text-[9px] font-bold uppercase w-8 ${isBase ? "text-primary" : "text-transparent"}`}>BASE</span>
                                </label>
                                <Input value={t.name} onChange={e => renameTurf(tc.sport, idx, e.target.value)}
                                  placeholder={`Turf ${idx + 1} name`} className="bg-background border-border text-xs h-8 flex-1" />
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">₹</span>
                                  <Input type="number" value={t.price ?? 2000} onChange={e => updateTurfPrice(tc.sport, idx, e.target.value)}
                                    placeholder="Price" className="bg-background border-border text-xs h-8 w-20" />
                                </div>
                                {tc.turfs.length > 1 && (
                                  <button type="button" onClick={() => removeTurfFromSport(tc.sport, idx)}
                                    className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opening / Closing Hours — AM/PM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Opening Hour</Label>
                  <div className="flex gap-1.5 mt-1">
                    <select value={to12h(venueForm.opening_hour).hour}
                      onChange={e => setVenueForm(p => ({ ...p, opening_hour: to24h(Number(e.target.value), to12h(p.opening_hour).ampm) }))}
                      className="flex-1 h-9 rounded-md border border-border bg-background px-2 text-sm">
                      {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <select value={to12h(venueForm.opening_hour).ampm}
                      onChange={e => setVenueForm(p => ({ ...p, opening_hour: to24h(to12h(p.opening_hour).hour, e.target.value) }))}
                      className="w-16 h-9 rounded-md border border-border bg-background px-2 text-sm">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Closing Hour</Label>
                  <div className="flex gap-1.5 mt-1">
                    <select value={to12h(venueForm.closing_hour).hour}
                      onChange={e => setVenueForm(p => ({ ...p, closing_hour: to24h(Number(e.target.value), to12h(p.closing_hour).ampm) }))}
                      className="flex-1 h-9 rounded-md border border-border bg-background px-2 text-sm">
                      {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <select value={to12h(venueForm.closing_hour).ampm}
                      onChange={e => setVenueForm(p => ({ ...p, closing_hour: to24h(to12h(p.closing_hour).hour, e.target.value) }))}
                      className="w-16 h-9 rounded-md border border-border bg-background px-2 text-sm">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 30-minute booking checkbox */}
              <div className="flex items-center gap-3 py-1">
                <input type="checkbox" id="allow30min"
                  checked={venueForm.slot_duration_minutes === 30}
                  onChange={e => setVenueForm(p => ({ ...p, slot_duration_minutes: e.target.checked ? 30 : 60 }))}
                  className="h-4 w-4 rounded border-border accent-primary" />
                <Label htmlFor="allow30min" className="text-xs text-muted-foreground cursor-pointer">Allow 30-minute bookings (default: 1 hour)</Label>
              </div>

              <VenueImageUpload
                images={venueForm.images}
                onChange={imgs => setVenueForm(p => ({ ...p, images: imgs }))}
              />
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreateVenue} data-testid="submit-venue-btn">Create Venue</Button>
            </div>
          </DialogContent>
        </Dialog>

      {/* Stats - Athletic Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <AthleticStatCard
          icon={Building2}
          label="Total Venues"
          value={venues.length}
          iconColor="primary"
          delay={0.1}
        />
        <AthleticStatCard
          icon={Calendar}
          label="Total Bookings"
          value={totalBookings}
          iconColor="violet"
          delay={0.2}
        />
        <AthleticStatCard
          icon={IndianRupee}
          label="Total Revenue"
          value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
          iconColor="amber"
          delay={0.3}
        />
        <AthleticStatCard
          icon={TrendingUp}
          label="Avg Booking"
          value={`₹${analytics?.avg_booking_value || 0}`}
          iconColor="sky"
          delay={0.4}
        />
      </div>

      {/* Analytics — Revenue + Chart on Dashboard */}
      {analytics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="glass-card rounded-lg p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">Total Revenue</div>
              <div className="text-xl sm:text-2xl font-display font-black text-primary mt-1">{"\u20B9"}{totalRevenue.toLocaleString()}</div>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">Confirmed</div>
              <div className="text-xl sm:text-2xl font-display font-black text-foreground mt-1">{analytics.confirmed_bookings}</div>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">Cancelled</div>
              <div className="text-xl sm:text-2xl font-display font-black text-destructive mt-1">{analytics.cancelled_bookings}</div>
            </div>
          </div>
          {analytics.daily_revenue?.length > 0 && (
            <div className="glass-card rounded-lg p-4 sm:p-6">
              <h3 className="font-display font-bold mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.daily_revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ background: "hsl(222.2, 47.4%, 11.2%)", border: "1px solid hsl(217.2, 32.6%, 17.5%)", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(210, 40%, 98%)" }} />
                  <Bar dataKey="revenue" fill="hsl(160, 84%, 39.4%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
      </>)}

      {/* Venue selector + actions on manage view */}
      {isManageView && venues.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex gap-2 items-center overflow-x-auto pb-1">
            {venues.map(v => (
              <button key={v.id} onClick={() => handleSelectVenue(v)}
                className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all border-2 flex items-center gap-2 ${selectedVenue?.id === v.id ? "bg-primary/20 border-primary text-primary" : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
                {v.name}
                {selectedVenue?.id === v.id && (
                  <span onClick={e => { e.stopPropagation(); openEditVenue(); }}
                    className="p-1 rounded-md hover:bg-primary/20 transition-colors" title="Edit venue">
                    <Pencil className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {selectedVenue?.slug && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => window.open(`/venue/${selectedVenue.slug}`, "_blank")}>
                <ExternalLink className="w-3.5 h-3.5" /> View Public Page
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => setShowVenueQR(true)}>
                <QrCode className="w-3.5 h-3.5" /> QR Code
              </Button>
            </div>
          )}
        </div>
      )}

      {isManageView && (
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="owner-tabs">
        <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="bookings" className="font-bold text-xs" data-testid="tab-bookings">Bookings</TabsTrigger>
          <TabsTrigger value="slots" className="font-bold text-xs" data-testid="tab-slots">
            <CalendarDays className="h-3 w-3 mr-1" />Slots
          </TabsTrigger>
          <TabsTrigger value="reviews" className="font-bold text-xs" data-testid="tab-reviews">
            <Star className="h-3 w-3 mr-1" />Reviews
          </TabsTrigger>
          <TabsTrigger value="pricing" className="font-bold text-xs" data-testid="tab-pricing">Pricing</TabsTrigger>
          <TabsTrigger value="checkin" className="font-bold text-xs" data-testid="tab-checkin">
            <QrCode className="h-3 w-3 mr-1" />Check-in
          </TabsTrigger>
          <TabsTrigger value="plan" className="font-bold text-xs" data-testid="tab-plan">Plan</TabsTrigger>
          <TabsTrigger value="payouts" className="font-bold text-xs" data-testid="tab-payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* Bookings - Enhanced with filters, detail view, and timeline */}
        <TabsContent value="bookings">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            {[
              { label: "Total", value: bookingStats.total, color: "text-foreground" },
              { label: "Confirmed", value: bookingStats.confirmed, color: "text-brand-400" },
              { label: "Pending", value: bookingStats.pending, color: "text-amber-400" },
              { label: "Cancelled", value: bookingStats.cancelled, color: "text-destructive" },
              { label: "Upcoming", value: bookingStats.upcoming, color: "text-sky-400" },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-lg p-3 text-center" data-testid={`booking-stat-${s.label.toLowerCase()}`}>
                <div className={`text-lg font-display font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* View Toggle: List / Timeline */}
          <div className="flex gap-1.5 mb-4">
            {[{ key: "list", label: "List" }, { key: "timeline", label: "Timeline" }].map(v => (
              <button key={v.key} onClick={() => setBookingView(v.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${bookingView === v.key ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* ── List View ── */}
          {bookingView === "list" && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="booking-filters">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono uppercase">Filters</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["all", "upcoming", "past"].map(f => (
                    <button key={f} onClick={() => setTimeFilter(f)} data-testid={`time-filter-${f}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${timeFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                      {f === "all" ? "All Time" : f === "upcoming" ? "Upcoming" : "Past"}
                    </button>
                  ))}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-xs bg-secondary/50 border-border" data-testid="status-filter-select">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="payment_pending">Awaiting Pay</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary/50 text-xs text-muted-foreground hover:text-foreground transition-all"
                  data-testid="sort-toggle">
                  <ArrowUpDown className="h-3 w-3" /> {sortOrder === "desc" ? "Newest" : "Oldest"}
                </button>
              </div>

              {/* Booking List */}
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-3" />
                  <p className="text-sm">{statusFilter !== "all" || timeFilter !== "all" ? "No bookings match your filters" : "No bookings yet"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">{filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}</p>
                  <AnimatePresence mode="popLayout">
                    {filteredBookings.map((b, idx) => {
                      const sc = statusConfig[b.status] || statusConfig.pending;
                      const isPast = b.date < today;
                      return (
                        <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => openBookingDetail(b)}
                          className={`glass-card rounded-lg p-4 cursor-pointer transition-all hover:border-primary/30 group ${isPast ? "opacity-70" : ""}`}
                          data-testid={`booking-row-${b.id}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground truncate">{b.host_name}</span>
                                {b.payment_mode === "split" && (
                                  <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">
                                    <Users className="h-2.5 w-2.5 mr-0.5" />Split
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{b.venue_name} - Turf #{b.turf_number}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-[10px] border ${sc.color}`}>{sc.label}</Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{b.date}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.start_time}-{b.end_time}</span>
                              <span className="flex items-center gap-1 capitalize"><CircleDot className="h-3 w-3" />{b.sport}</span>
                            </div>
                            <span className="font-bold text-primary text-sm">{"\u20B9"}{b.total_amount}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {/* ── Timeline View (merged from History tab) ── */}
          {bookingView === "timeline" && (
            <div className="space-y-6" data-testid="booking-history-tab">
              {bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-3" />
                  <p className="text-sm">No booking history</p>
                </div>
              ) : (() => {
                const sorted = [...bookings].sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
                const grouped = {};
                sorted.forEach(b => {
                  const key = b.date;
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(b);
                });
                return (
                  <div className="space-y-6">
                    {Object.entries(grouped).map(([date, dateBookings]) => {
                      const isPast = date < today;
                      const isToday = date === today;
                      const totalAmount = dateBookings.reduce((sum, b) => sum + (b.status === "confirmed" ? b.total_amount : 0), 0);
                      return (
                        <div key={date} data-testid={`history-date-${date}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isToday ? "bg-primary animate-pulse" : isPast ? "bg-muted-foreground/40" : "bg-sky-400"}`} />
                              <span className="text-sm font-bold text-foreground">
                                {isToday ? "Today" : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{dateBookings.length} booking{dateBookings.length > 1 ? "s" : ""}</Badge>
                            </div>
                            {totalAmount > 0 && (
                              <span className="text-xs font-bold text-primary">{"\u20B9"}{totalAmount.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="space-y-2 pl-4 border-l-2 border-border/50 ml-1">
                            {dateBookings.map(b => {
                              const sc = statusConfig[b.status] || statusConfig.pending;
                              return (
                                <motion.div key={b.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                                  onClick={() => openBookingDetail(b)}
                                  className={`glass-card rounded-lg p-3 cursor-pointer transition-all hover:border-primary/30 group ${isPast ? "opacity-70" : ""}`}
                                  data-testid={`history-booking-${b.id}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold">{b.start_time}-{b.end_time}</span>
                                        <span className="text-xs text-muted-foreground">Turf #{b.turf_number}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{b.sport}</span>
                                        {b.payment_mode === "split" && <Badge variant="outline" className="text-[9px] h-4 border-violet-500/30 text-violet-400">Split</Badge>}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">{b.host_name} - {b.venue_name}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-sm font-bold text-primary">{"\u20B9"}{b.total_amount}</span>
                                      <Badge className={`text-[9px] border ${sc.color}`}>{sc.label}</Badge>
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Booking Detail Dialog */}
        <Dialog open={bookingDetailOpen} onOpenChange={setBookingDetailOpen}>
          <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Booking Details</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Booking ID: {selectedBooking?.id?.slice(0, 8)}...</DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-4" data-testid="booking-detail-view">
                {/* Status Banner */}
                <div className={`p-3 rounded-lg border ${(statusConfig[selectedBooking.status] || statusConfig.pending).color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedBooking.status === "confirmed" ? <CheckCircle className="h-4 w-4" /> :
                       selectedBooking.status === "cancelled" ? <X className="h-4 w-4" /> :
                       <AlertCircle className="h-4 w-4" />}
                      <span className="text-sm font-bold">{(statusConfig[selectedBooking.status] || statusConfig.pending).label}</span>
                    </div>
                    {selectedBooking.payment_gateway && (
                      <Badge variant="outline" className="text-[10px]">{selectedBooking.payment_gateway === "razorpay" ? "Razorpay" : "Test Mode"}</Badge>
                    )}
                  </div>
                </div>

                {/* Booking Info Grid */}
                <div className="glass-card rounded-lg p-4 space-y-3" data-testid="booking-detail-info">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Venue</span>
                      <p className="text-sm font-bold mt-0.5">{selectedBooking.venue_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Host</span>
                      <p className="text-sm font-bold mt-0.5">{selectedBooking.host_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Date</span>
                      <p className="text-sm font-bold mt-0.5">{selectedBooking.date}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Time</span>
                      <p className="text-sm font-bold mt-0.5">{selectedBooking.start_time} - {selectedBooking.end_time}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Turf</span>
                      <p className="text-sm font-bold mt-0.5">{selectedBooking.turf_name || `#${selectedBooking.turf_number}`}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sport</span>
                      <p className="text-sm font-bold mt-0.5 capitalize">{selectedBooking.sport}</p>
                    </div>
                    {selectedBooking.num_players && (
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Lobbians</span>
                        <p className="text-sm font-bold mt-0.5">{selectedBooking.num_players}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Details */}
                <div className="glass-card rounded-lg p-4 space-y-3" data-testid="booking-detail-payment">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider">Payment</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total Amount</span>
                      <p className="text-lg font-display font-black text-primary mt-0.5">{"\u20B9"}{selectedBooking.total_amount}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Commission</span>
                      <p className="text-sm font-bold mt-0.5">{"\u20B9"}{selectedBooking.commission_amount || 0}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Payment Mode</span>
                      <p className="text-sm font-bold mt-0.5 capitalize">{selectedBooking.payment_mode}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Gateway</span>
                      <p className="text-sm font-bold mt-0.5 capitalize">{selectedBooking.payment_gateway || "N/A"}</p>
                    </div>
                  </div>
                  {selectedBooking.payment_details && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Paid At</span>
                      <p className="text-xs text-foreground mt-0.5">{selectedBooking.payment_details.paid_at ? new Date(selectedBooking.payment_details.paid_at).toLocaleString() : "N/A"}</p>
                      {selectedBooking.payment_details.razorpay_payment_id && (
                        <>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2 block">Payment ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.razorpay_payment_id}</p>
                        </>
                      )}
                      {(selectedBooking.payment_details.test_payment_id || selectedBooking.payment_details.mock_payment_id) && (
                        <>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2 block">Test ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.test_payment_id || selectedBooking.payment_details.mock_payment_id}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Split Payment Info */}
                {selectedBooking.split_config && (
                  <div className="glass-card rounded-lg p-4 space-y-3" data-testid="booking-detail-split">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-bold uppercase tracking-wider">Split Payment</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Per Share</span>
                        <p className="text-sm font-bold mt-0.5">{"\u20B9"}{selectedBooking.split_config.per_share}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total Shares</span>
                        <p className="text-sm font-bold mt-0.5">{selectedBooking.split_config.total_shares}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Paid</span>
                        <p className="text-sm font-bold mt-0.5">
                          <span className={selectedBooking.split_config.shares_paid >= selectedBooking.split_config.total_shares ? "text-brand-400" : "text-amber-400"}>
                            {selectedBooking.split_config.shares_paid}
                          </span>
                          /{selectedBooking.split_config.total_shares}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-secondary/50 rounded-full h-1.5">
                      <div className="bg-violet-500 rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, (selectedBooking.split_config.shares_paid / selectedBooking.split_config.total_shares) * 100)}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Split Link: <span className="font-mono text-foreground">{window.location.origin}/split/{selectedBooking.split_config.split_token}</span>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="glass-card rounded-lg p-4 space-y-2" data-testid="booking-detail-timestamps">
                  <div className="flex items-center gap-2 mb-1">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider">Timeline</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">{selectedBooking.created_at ? new Date(selectedBooking.created_at).toLocaleString() : "N/A"}</span>
                  </div>
                  {selectedBooking.expires_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Expires</span>
                      <span className={`${new Date(selectedBooking.expires_at) < new Date() ? "text-destructive" : "text-foreground"}`}>
                        {new Date(selectedBooking.expires_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {["confirmed", "pending", "payment_pending"].includes(selectedBooking.status) && (
                  <Button variant="destructive" className="w-full text-xs font-bold"
                    onClick={() => handleCancelBooking(selectedBooking.id)} data-testid="cancel-booking-btn">
                    Cancel Booking
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>


        {/* Slots Tab - Visual slot availability grid */}
        <TabsContent value="slots">
          {selectedVenue && <SlotAvailabilityPanel venueId={selectedVenue.id} />}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <div className="space-y-4" data-testid="owner-reviews-tab">
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg">
                Customer Reviews {selectedVenue && <span className="text-muted-foreground font-normal text-sm">- {selectedVenue.name}</span>}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">See what Lobbians say about your venue</p>
            </div>

            {venueReviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm">No reviews yet for {selectedVenue?.name || "this venue"}</p>
              </div>
            ) : (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {(() => {
                    const avg = venueReviews.length > 0 ? venueReviews.reduce((s, r) => s + (r.rating || 0), 0) / venueReviews.length : 0;
                    const r5 = venueReviews.filter(r => r.rating === 5).length;
                    return (
                      <>
                        <div className="glass-card rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 text-primary fill-primary" />
                            <span className="font-display font-black text-xl text-primary">{avg.toFixed(1)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">Avg Rating</div>
                        </div>
                        <div className="glass-card rounded-lg p-3 text-center">
                          <div className="font-display font-black text-xl text-foreground">{venueReviews.length}</div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">Total</div>
                        </div>
                        <div className="glass-card rounded-lg p-3 text-center">
                          <div className="font-display font-black text-xl text-brand-400">{r5}</div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">5-Star</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Review Cards */}
                <div className="space-y-2">
                  {venueReviews.map(r => (
                    <div key={r.id} className="glass-card rounded-lg p-4" data-testid={`owner-review-${r.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {r.user_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-sm">{r.user_name}</span>
                            <div className="flex gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-primary fill-primary" : "text-muted-foreground/40"}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      {r.comment && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Pricing Rules - Enhanced P2 */}
        <TabsContent value="pricing">
          {/* View Toggle: Rules / AI */}
          <div className="flex gap-1.5 mb-4">
            {[{ key: "rules", label: "Rules" }, { key: "analytics", label: "Analytics" }].map(v => (
              <button key={v.key} onClick={() => setPricingView(v.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${pricingView === v.key ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {pricingView === "rules" && (
          <>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base sm:text-lg truncate">
                Pricing Rules {selectedVenue && <span className="text-muted-foreground font-normal text-sm">- {selectedVenue.name}</span>}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Base price: <span className="text-primary font-bold">{"\u20B9"}{basePrice}/hr</span></p>
            </div>
            <Button size="sm" onClick={openCreateRule} className="bg-primary text-primary-foreground font-bold text-xs h-8 shrink-0" data-testid="create-rule-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
            </Button>
          </div>

          {pricingRules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-3" />
              <p className="text-sm">No pricing rules yet</p>
              <p className="text-xs mt-1">Add rules to set peak-hour surcharges or off-peak discounts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pricingRules.map(r => {
                const effectivePrice = previewPrice(r);
                const diff = effectivePrice - basePrice;
                const isDiscount = r.rule_type === "discount" || (!r.rule_type && r.action?.type === "discount");
                const schedType = r.schedule_type || "recurring";
                const valLabel = r.rule_type
                  ? (r.value_type === "percent" ? `${r.value}%` : `₹${r.value}`)
                  : (r.action?.type === "multiplier" ? `${r.action.value}x` : `-${Math.round((r.action?.value||0)*100)}%`);
                const scheduleLabel = schedType === "one_time"
                  ? `${r.date_from || "?"} → ${r.date_to || "?"}, ${r.time_from||""}–${r.time_to||""}`
                  : `${r.conditions?.days?.length > 0 ? r.conditions.days.map(d => DAY_LABELS[d]).join(", ") : "Every day"}${r.conditions?.time_range ? `, ${r.conditions.time_range.start}–${r.conditions.time_range.end}` : ""}`;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={`glass-card rounded-lg p-4 border-l-4 ${r.is_active ? (isDiscount ? "border-l-brand-500" : "border-l-amber-500") : "border-l-muted-foreground/30 opacity-60"}`}
                    data-testid={`rule-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{r.name}</span>
                          <Badge className={`text-[10px] border ${isDiscount ? "bg-brand-500/15 text-brand-400 border-brand-500/20" : "bg-amber-500/15 text-amber-400 border-amber-500/20"}`}>
                            {isDiscount ? "🏷 Offer" : "⚡ Peak"} {valLabel} {isDiscount ? "off" : "extra"}
                          </Badge>
                          {schedType === "one_time" && <Badge className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/20">One-time</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />{scheduleLabel}
                        </p>
                        {r.is_active && (
                          <p className="text-xs mt-1.5">
                            {r.value_type === "amount" ? (
                              <span className={`font-bold ${isDiscount ? "text-brand-400" : "text-amber-400"}`}>
                                ₹{r.value} {isDiscount ? "off" : "added to"} each turf's price
                              </span>
                            ) : (
                              <>
                                <span className="text-muted-foreground">e.g. ₹{basePrice} → </span>
                                <span className={`font-bold ${isDiscount ? "text-brand-400" : "text-amber-400"}`}>₹{effectivePrice}</span>
                                <span className={`ml-1 text-[10px] ${isDiscount ? "text-brand-400" : "text-amber-400"}`}>({diff > 0 ? "+" : ""}₹{diff})</span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={r.is_active !== false} onCheckedChange={() => handleToggleRule(r.id)} data-testid={`toggle-rule-${r.id}`} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditRule(r)} data-testid={`edit-rule-${r.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRule(r.id)} data-testid={`delete-rule-${r.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rule Create/Edit Dialog — redesigned */}
          <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingRule ? "Edit" : "Create"} Pricing Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">

                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Rule Name</Label>
                  <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Diwali Offer / Friday Peak" className="mt-1 bg-background border-border" data-testid="rule-name-input" />
                </div>

                {/* Rule Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ key: "discount", label: "🏷 Offer / Discount", desc: "Reduce price" }, { key: "surge", label: "⚡ Peak / Surge", desc: "Increase price" }].map(t => (
                      <button key={t.key} onClick={() => setRuleForm(p => ({ ...p, rule_type: t.key }))}
                        className={`p-3 rounded-lg border text-left transition-all ${ruleForm.rule_type === t.key ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/50"}`}>
                        <p className="text-xs font-bold">{t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    {ruleForm.rule_type === "discount" ? "Discount" : "Surge"} Amount
                  </Label>
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={ruleForm.value}
                      onChange={e => setRuleForm(p => ({ ...p, value: Number(e.target.value) }))}
                      className="bg-background border-border flex-1" data-testid="rule-value-input" />
                    <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                      {[{ key: "percent", label: "%" }, { key: "amount", label: "₹" }].map(vt => (
                        <button key={vt.key} onClick={() => setRuleForm(p => ({ ...p, value_type: vt.key }))}
                          className={`px-3 py-2 text-sm font-bold transition-all ${ruleForm.value_type === vt.key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>
                          {vt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schedule Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Schedule</Label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[{ key: "recurring", label: "🔁 Recurring", desc: "Repeats every week" }, { key: "one_time", label: "📅 One-time", desc: "Specific dates only" }].map(s => (
                      <button key={s.key} onClick={() => setRuleForm(p => ({ ...p, schedule_type: s.key }))}
                        className={`p-3 rounded-lg border text-left transition-all ${ruleForm.schedule_type === s.key ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/50"}`}>
                        <p className="text-xs font-bold">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Recurring: days + time */}
                  {ruleForm.schedule_type === "recurring" && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Days <span className="text-[10px]">(leave empty = every day)</span></p>
                        <div className="flex gap-1.5 flex-wrap">
                          {DAY_LABELS.map((label, i) => (
                            <button key={i} onClick={() => toggleDay(i)} data-testid={`day-btn-${i}`}
                              className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${(ruleForm.conditions.days||[]).includes(i) ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Time Range</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">From</p>
                            <input type="time" value={ruleForm.conditions.time_range?.start || "18:00"}
                              onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, start: e.target.value } } }))}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">To</p>
                            <input type="time" value={ruleForm.conditions.time_range?.end || "22:00"}
                              onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, end: e.target.value } } }))}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* One-time: date range + time */}
                  {ruleForm.schedule_type === "one_time" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Start Date</p>
                          <input type="date" value={ruleForm.date_from || ""}
                            onChange={e => setRuleForm(p => ({ ...p, date_from: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">End Date</p>
                          <input type="date" value={ruleForm.date_to || ""}
                            onChange={e => setRuleForm(p => ({ ...p, date_to: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">From Time</p>
                          <input type="time" value={ruleForm.time_from || "18:00"}
                            onChange={e => setRuleForm(p => ({ ...p, time_from: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">To Time</p>
                          <input type="time" value={ruleForm.time_to || "22:00"}
                            onChange={e => setRuleForm(p => ({ ...p, time_to: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Preview */}
                <div className="glass-card rounded-lg p-3" data-testid="rule-preview">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Price Preview</p>
                  {ruleForm.value_type === "amount" ? (
                    <p className={`text-base font-bold ${ruleForm.rule_type === "discount" ? "text-brand-400" : "text-amber-400"}`}>
                      ₹{parseFloat(ruleForm.value) || 0} {ruleForm.rule_type === "discount" ? "off" : "added to"} each turf's price
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">e.g.</span>
                      <span className="text-sm text-muted-foreground line-through">₹{basePrice}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={`text-lg font-display font-bold ${ruleForm.rule_type === "discount" ? "text-brand-400" : "text-amber-400"}`}>₹{previewPrice(ruleForm)}</span>
                      {(() => {
                        const d = previewPrice(ruleForm) - basePrice;
                        return d !== 0 && (
                          <Badge className={`text-[10px] ${d < 0 ? "bg-brand-500/15 text-brand-400" : "bg-amber-500/15 text-amber-400"}`}>
                            {d > 0 ? "+" : ""}₹{d}
                          </Badge>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveRule} data-testid="submit-rule-btn">
                  {editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </>
          )}

          {/* ── Analytics View ── */}
          {pricingView === "analytics" && selectedVenue && (
            <VenueAnalyticsPanel venueId={selectedVenue.id} />
          )}
        </TabsContent>


        <TabsContent value="plan" data-testid="plan-tab-content">
          {planData ? (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-4 sm:p-5" data-testid="current-plan-card">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold truncate">Current Plan: <span className="text-primary">{planData.current_plan?.name}</span></h3>
                    <p className="text-xs text-muted-foreground">{planData.venues_used} / {planData.venues_limit} venues used</p>
                  </div>
                </div>
                <div className="w-full bg-secondary/50 rounded-full h-2 mb-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (planData.venues_used / planData.venues_limit) * 100)}%` }} />
                </div>
              </div>

              <h3 className="text-sm font-bold">Available Plans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(planData.all_plans || []).map(plan => {
                  const isCurrent = plan.id === planData.current_plan?.id;
                  return (
                    <div key={plan.id} className={`glass-card rounded-lg p-4 sm:p-5 border-2 transition-all ${isCurrent ? "border-primary" : "border-transparent hover:border-primary/30"}`}
                      data-testid={`plan-card-${plan.id}`}>
                      <div className="text-sm font-bold mb-1">{plan.name}</div>
                      <div className="text-2xl font-display font-black text-primary mb-3">
                        {!plan.price ? "Free" : `\u20B9${Number(plan.price).toLocaleString()}`}
                        {plan.price > 0 && <span className="text-xs text-muted-foreground font-normal">/mo</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">Up to {plan.max_venues} venue{plan.max_venues > 1 ? "s" : ""}</div>
                      <ul className="space-y-1 mb-4">
                        {(plan.features || []).map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 text-primary shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Badge className="w-full justify-center bg-primary/20 text-primary text-xs py-1">Current Plan</Badge>
                      ) : (
                        <Button size="sm" className="w-full text-xs font-bold" disabled={upgrading}
                          onClick={() => handleUpgrade(plan.id)} data-testid={`upgrade-${plan.id}`}>
                          {upgrading ? "..." : plan.price > (planData.current_plan?.price || 0) ? "Upgrade" : "Switch"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          )}
        </TabsContent>

        <TabsContent value="checkin" data-testid="checkin-tab-content">
          <VenueCheckinPanel
            bookings={bookings.filter(b => b.venue_id === selectedVenue?.id)}
            venueName={selectedVenue?.name}
            onCheckinSuccess={loadData}
          />
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" data-testid="payouts-tab-content">
          <div className="space-y-6">
            {/* Bank Account Section */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">Bank Account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Link your bank account to receive venue payouts</p>
                </div>
                {linkedAccount && (
                  <Badge className={`text-xs font-bold rounded-full px-3 ${linkedAccount.status === "active" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-500"}`}>
                    {linkedAccount.status || "pending"}
                  </Badge>
                )}
              </div>
              {linkedAccount ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Account</p>
                    <p className="font-semibold">{linkedAccount.bank_account?.account_number || "****"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IFSC</p>
                    <p className="font-semibold">{linkedAccount.bank_account?.ifsc_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-semibold">{linkedAccount.bank_account?.beneficiary_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="font-semibold">{linkedAccount.bank_account?.bank_name || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Account Number</Label>
                      <Input value={bankForm.account_number} onChange={e => setBankForm(p => ({ ...p, account_number: e.target.value }))} placeholder="Enter account number" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">IFSC Code</Label>
                      <Input value={bankForm.ifsc_code} onChange={e => setBankForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Beneficiary Name</Label>
                      <Input value={bankForm.beneficiary_name} onChange={e => setBankForm(p => ({ ...p, beneficiary_name: e.target.value }))} placeholder="Name as on bank account" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Bank Name</Label>
                      <Input value={bankForm.bank_name} onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. State Bank of India" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input value={bankForm.phone} onChange={e => setBankForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit phone" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input value={bankForm.email} onChange={e => setBankForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" className="mt-1" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={bankSaving || !bankForm.account_number || !bankForm.ifsc_code || !bankForm.beneficiary_name}
                    onClick={async () => {
                      setBankSaving(true);
                      try {
                        await payoutAPI.createLinkedAccount(bankForm);
                        toast.success("Bank account linked successfully");
                        loadPayoutData();
                      } catch (err) { toast.error(err?.response?.data?.detail || "Failed to link account"); }
                      finally { setBankSaving(false); }
                    }}
                    className="gap-2"
                  >
                    {bankSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                    Link Bank Account
                  </Button>
                </div>
              )}
            </div>

            {/* Payout Summary Cards */}
            {payoutSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <AthleticStatCard icon={IndianRupee} label="Total Earned" value={`₹${(payoutSummary.total_earned || 0).toLocaleString()}`} iconColor="primary" delay={0.1} />
                <AthleticStatCard icon={CheckCircle} label="Total Settled" value={`₹${(payoutSummary.total_settled || 0).toLocaleString()}`} iconColor="emerald" delay={0.2} />
                <AthleticStatCard icon={Clock} label="Pending" value={`₹${(payoutSummary.pending_settlement || 0).toLocaleString()}`} iconColor="amber" delay={0.3} />
                <AthleticStatCard icon={Banknote} label="Last Payout" value={payoutSummary.last_payout_amount ? `₹${payoutSummary.last_payout_amount.toLocaleString()}` : "—"} iconColor="sky" delay={0.4} />
              </div>
            )}

            {/* Payout History */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payout History</p>
              {myPayouts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No payouts yet. Payouts are processed by the platform admin.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myPayouts.map(p => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-xl border border-border p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => setPayoutDetailDialog(p)}
                    >
                      <div>
                        <p className="text-sm font-bold text-foreground">₹{(p.net_amount || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.period_start} → {p.period_end}
                          {p.transfer_utr && <span className="ml-2 font-mono">UTR: {p.transfer_utr}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs font-bold rounded-full px-3 ${
                          p.status === "completed" ? "bg-green-500/10 text-green-600" :
                          p.status === "processing" ? "bg-blue-500/10 text-blue-600" :
                          p.status === "failed" ? "bg-red-500/10 text-red-600" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {p.status}
                        </Badge>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Payout Detail Dialog */}
            {payoutDetailDialog && (
              <Dialog open={!!payoutDetailDialog} onOpenChange={() => setPayoutDetailDialog(null)}>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle>Payout Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Period</p><p className="font-semibold">{payoutDetailDialog.period_start} → {payoutDetailDialog.period_end}</p></div>
                      <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{payoutDetailDialog.status}</p></div>
                    </div>
                    <div className="bg-secondary/30 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">₹{(payoutDetailDialog.gross_amount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Commission ({payoutDetailDialog.commission_pct || 10}%)</span><span className="font-medium text-red-500">-₹{(payoutDetailDialog.commission_amount || 0).toLocaleString()}</span></div>
                      <div className="border-t border-border/40 pt-2 flex justify-between"><span className="font-bold">Net Payout</span><span className="font-black text-green-600">₹{(payoutDetailDialog.net_amount || 0).toLocaleString()}</span></div>
                    </div>
                    {payoutDetailDialog.razorpay_transfer_id && (
                      <p className="text-xs text-muted-foreground">Transfer: <span className="font-mono">{payoutDetailDialog.razorpay_transfer_id}</span></p>
                    )}
                    {payoutDetailDialog.transfer_utr && (
                      <p className="text-xs text-muted-foreground">UTR: <span className="font-mono">{payoutDetailDialog.transfer_utr}</span></p>
                    )}
                    {payoutDetailDialog.line_items?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Items ({payoutDetailDialog.line_items.length})</p>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {payoutDetailDialog.line_items.map((item, i) => (
                            <div key={i} className="flex justify-between py-1.5 px-3 bg-secondary/20 rounded-lg text-xs">
                              <span>{item.description || item.type} <span className="text-muted-foreground">{item.date}</span></span>
                              <span className="font-semibold">₹{(item.net || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Edit Venue Dialog */}
      <Dialog open={editVenueOpen} onOpenChange={setEditVenueOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Venue Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Changes will be pushed <span className="text-primary font-semibold">live</span> to all viewers of the public page instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs text-muted-foreground">Venue Name</Label>
              <Input value={editVenueForm.name || ""} onChange={e => setEditVenueForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <textarea
                value={editVenueForm.description || ""}
                onChange={e => setEditVenueForm(p => ({ ...p, description: e.target.value }))}
                rows={6}
                placeholder={"Football:\n- Wearing football studs recommended\n- Metal studs not allowed\n\nCricket:\n- Sports equipment provided\n- Barefoot play prohibited"}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input value={editVenueForm.address || ""} onChange={e => setEditVenueForm(p => ({ ...p, address: e.target.value }))}
                  className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Area</Label>
                <Input value={editVenueForm.area || ""} onChange={e => setEditVenueForm(p => ({ ...p, area: e.target.value }))}
                  placeholder="Koramangala" className="mt-1 bg-background border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input value={editVenueForm.city || ""} onChange={e => setEditVenueForm(p => ({ ...p, city: e.target.value }))}
                className="mt-1 bg-background border-border" />
            </div>

            {/* Sports — dynamic input */}
            <div>
              <Label className="text-xs text-muted-foreground">Sports</Label>
              <div className="flex gap-2 mt-1">
                <Input value={editSportInput} onChange={e => setEditSportInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEditSport(editSportInput))}
                  placeholder="Type a sport and press Enter" className="bg-background border-border flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => addEditSport(editSportInput)} disabled={!editSportInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(editVenueForm.sports || []).map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground border border-primary">
                    {s}
                    <button type="button" onClick={() => removeEditSport(s)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {SPORT_SUGGESTIONS.filter(s => !(editVenueForm.sports || []).includes(s.toLowerCase())).map(s => (
                  <button key={s} type="button" onClick={() => addEditSport(s)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border hover:border-primary/50 transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Amenities — dynamic input */}
            <div>
              <Label className="text-xs text-muted-foreground">Amenities</Label>
              <div className="flex gap-2 mt-1">
                <Input value={editAmenityInput} onChange={e => setEditAmenityInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEditAmenity(editAmenityInput))}
                  placeholder="Type an amenity and press Enter" className="bg-background border-border flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => addEditAmenity(editAmenityInput)} disabled={!editAmenityInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(editVenueForm.amenities || []).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground border border-primary">
                    {a}
                    <button type="button" onClick={() => removeEditAmenity(a)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {AMENITY_SUGGESTIONS.filter(a => !(editVenueForm.amenities || []).includes(a)).map(a => (
                  <button key={a} type="button" onClick={() => addEditAmenity(a)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border hover:border-primary/50 transition-colors">
                    + {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-sport Turf Configuration */}
            {(editVenueForm.turf_config || []).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Turf Configuration</Label>
                <div className="space-y-3 mt-1.5">
                  {(editVenueForm.turf_config || []).map(tc => (
                    <div key={tc.sport} className="border border-border rounded-lg p-3 bg-secondary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">{tc.sport}</span>
                        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => addEditTurf(tc.sport)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Turf
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {tc.turfs.map((t, idx) => {
                          const isBase = editBaseTurf ? (editBaseTurf.sport === tc.sport && editBaseTurf.idx === idx)
                            : ((editVenueForm.turf_config || [])[0]?.sport === tc.sport && idx === 0);
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <label className="flex items-center gap-1 cursor-pointer shrink-0" title="Set as base price">
                                <input type="radio" name="base_turf_edit" checked={isBase}
                                  onChange={() => setEditBaseTurf({ sport: tc.sport, idx })}
                                  className="accent-primary w-3 h-3" />
                                <span className={`text-[9px] font-bold uppercase w-8 ${isBase ? "text-primary" : "text-transparent"}`}>BASE</span>
                              </label>
                              <Input value={t.name} onChange={e => renameEditTurf(tc.sport, idx, e.target.value)}
                                placeholder={`Turf ${idx + 1} name`} className="bg-background border-border text-xs h-8 flex-1" />
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">₹</span>
                                <Input type="number" value={t.price ?? 2000} onChange={e => updateEditTurfPrice(tc.sport, idx, e.target.value)}
                                  placeholder="Price" className="bg-background border-border text-xs h-8 w-20" />
                              </div>
                              {tc.turfs.length > 1 && (
                                <button type="button" onClick={() => removeEditTurf(tc.sport, idx)}
                                  className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opening / Closing Hours — AM/PM */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Opening Hour</Label>
                <div className="flex gap-1.5 mt-1">
                  <select value={to12h(editVenueForm.opening_hour ?? 6).hour}
                    onChange={e => setEditVenueForm(p => ({ ...p, opening_hour: to24h(Number(e.target.value), to12h(p.opening_hour ?? 6).ampm) }))}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-2 text-sm">
                    {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={to12h(editVenueForm.opening_hour ?? 6).ampm}
                    onChange={e => setEditVenueForm(p => ({ ...p, opening_hour: to24h(to12h(p.opening_hour ?? 6).hour, e.target.value) }))}
                    className="w-16 h-9 rounded-md border border-border bg-background px-2 text-sm">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Closing Hour</Label>
                <div className="flex gap-1.5 mt-1">
                  <select value={to12h(editVenueForm.closing_hour ?? 23).hour}
                    onChange={e => setEditVenueForm(p => ({ ...p, closing_hour: to24h(Number(e.target.value), to12h(p.closing_hour ?? 23).ampm) }))}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-2 text-sm">
                    {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={to12h(editVenueForm.closing_hour ?? 23).ampm}
                    onChange={e => setEditVenueForm(p => ({ ...p, closing_hour: to24h(to12h(p.closing_hour ?? 23).hour, e.target.value) }))}
                    className="w-16 h-9 rounded-md border border-border bg-background px-2 text-sm">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 30-minute booking checkbox */}
            <div className="flex items-center gap-3 py-1">
              <input type="checkbox" id="edit-allow30min"
                checked={(editVenueForm.slot_duration_minutes || 60) === 30}
                onChange={e => setEditVenueForm(p => ({ ...p, slot_duration_minutes: e.target.checked ? 30 : 60 }))}
                className="h-4 w-4 rounded border-border accent-primary" />
              <Label htmlFor="edit-allow30min" className="text-xs text-muted-foreground cursor-pointer">Allow 30-minute bookings (default: 1 hour)</Label>
            </div>

            <VenueImageUpload
              images={editVenueForm.images || []}
              onChange={imgs => setEditVenueForm(p => ({ ...p, images: imgs }))}
            />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditVenueOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={handleSaveVenue} disabled={savingVenue}>
                {savingVenue ? "Saving..." : "Save & Go Live"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Venue QR Code Dialog */}
      <Dialog open={showVenueQR} onOpenChange={setShowVenueQR}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Venue QR Code</DialogTitle>
          </DialogHeader>
          {selectedVenue?.slug && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <QRCodeSVG
                  value={`${window.location.origin}/venue/${selectedVenue.slug}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className="font-semibold">{selectedVenue.name}</p>
                <p className="text-sm text-muted-foreground font-mono">/venue/{selectedVenue.slug}</p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Share this QR code with your customers so they can quickly access your venue's public page.
              </p>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    const url = `${window.location.origin}/venue/${selectedVenue.slug}`;
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copied!");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button className="flex-1" onClick={() => setShowVenueQR(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Venue Analytics Panel ───────────────────────────────────────────────────
function VenueAnalyticsPanel({ venueId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTurf, setSelectedTurf] = useState("all");
  const [period, setPeriod] = useState(90);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSelectedTurf("all");
      try {
        const res = await analyticsAPI.venueInsights(venueId, period);
        setInsights(res.data);
      } catch {
        setInsights(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [venueId, period]);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const insightIcon = (type) => {
    if (type === "peak")    return <TrendingUp className="h-4 w-4 text-brand-400 shrink-0" />;
    if (type === "low")     return <TrendingDown className="h-4 w-4 text-blue-400 shrink-0" />;
    if (type === "loyalty") return <Users className="h-4 w-4 text-amber-400 shrink-0" />;
    if (type === "warning") return <Zap className="h-4 w-4 text-destructive shrink-0" />;
    return <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const insightBg = (type) => {
    if (type === "peak")    return "bg-brand-500/10 border-brand-500/20";
    if (type === "low")     return "bg-blue-500/10 border-blue-500/20";
    if (type === "loyalty") return "bg-amber-500/10 border-amber-500/20";
    if (type === "warning") return "bg-destructive/10 border-destructive/20";
    return "bg-secondary/50 border-border";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Could not load analytics. Try again later.</p>
      </div>
    );
  }

  const activeHeatmap = selectedTurf === "all"
    ? insights.heatmap
    : (insights.heatmap_by_turf?.[selectedTurf] || []);

  // Aggregate totals per day and per hour
  const dayTotals = Array(7).fill(0);
  const hourTotalsMap = {};
  activeHeatmap.forEach(h => {
    dayTotals[h.dow] = (dayTotals[h.dow] || 0) + h.count;
    hourTotalsMap[h.hour] = (hourTotalsMap[h.hour] || 0) + h.count;
  });
  const maxDay = Math.max(...dayTotals, 1);
  const activeHourEntries = Object.entries(hourTotalsMap)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // top 6 busiest hours
  const maxHour = activeHourEntries.length > 0 ? Math.max(...activeHourEntries.map(e => e.count), 1) : 1;

  const periodLabel = period === 0 ? "all time" : `last ${period} days`;
  const totalBookings = insights.confirmed_count ?? 0;

  return (
    <div className="space-y-4" data-testid="analytics-panel">

      {/* Header: summary + period pills */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-bold text-base">{totalBookings}</span>
          {" "}bookings in the {periodLabel}
        </p>
        <div className="flex gap-1">
          {[{ label: "30d", days: 30 }, { label: "90d", days: 90 }, { label: "180d", days: 180 }, { label: "All", days: 0 }].map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${period === p.days ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Slots Filled",
            value: `${insights.avg_occupancy}%`,
            sub: "avg turf occupancy",
            icon: <BarChart2 className="h-4 w-4 text-brand-400" />,
          },
          {
            label: "Cancelled",
            value: `${insights.cancellation_rate}%`,
            sub: "of all bookings",
            icon: <TrendingDown className="h-4 w-4 text-blue-400" />,
          },
          {
            label: "Return Visitors",
            value: `${insights.repeat_customer_rate}%`,
            sub: "booked more than once",
            icon: <Users className="h-4 w-4 text-amber-400" />,
          },
          {
            label: "Booked Ahead",
            value: `${insights.avg_lead_time_days}d`,
            sub: "avg days before slot",
            icon: <Calendar className="h-4 w-4 text-purple-400" />,
          },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {s.icon}
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
            <p className="font-display font-bold text-2xl text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Busiest Days */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">📅 Busiest Days</h3>
            {insights.turf_list?.length > 1 && (
              <select
                value={selectedTurf}
                onChange={e => setSelectedTurf(e.target.value)}
                className="text-[10px] bg-secondary/50 border border-border rounded px-2 py-0.5 text-foreground"
              >
                <option value="all">All Turfs</option>
                {insights.turf_list.map(t => (
                  <option key={t.turf_number} value={String(t.turf_number)}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          {dayTotals.every(v => v === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No bookings yet.</p>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, dow) => {
                const count = dayTotals[dow];
                const pct = Math.round((count / maxDay) * 100);
                return (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-7 shrink-0">{day}</span>
                    <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500/70 flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                      >
                        {count > 0 && <span className="text-[10px] font-bold text-white">{count}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Busiest Hours */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-sm">⏰ Busiest Hours</h3>
          {activeHourEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No bookings yet.</p>
          ) : (
            <div className="space-y-2">
              {activeHourEntries.map(({ hour, count }) => {
                const pct = Math.round((count / maxHour) * 100);
                const ampm = hour < 12 ? "AM" : "PM";
                const h12 = hour % 12 === 0 ? 12 : hour % 12;
                const label = `${h12} ${ampm}`;
                return (
                  <div key={hour} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{label}</span>
                    <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/70 flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.insights?.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Insights
          </h3>
          {insights.insights.map((ins, i) => (
            <div key={i} className={`rounded-lg p-3 border flex items-start gap-3 ${insightBg(ins.type)}`}>
              {insightIcon(ins.type)}
              <p className="text-xs leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Slot Availability Panel ────────────────────────────────────────────────
function SlotAvailabilityPanel({ venueId }) {
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split("T")[0]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadSlots = useCallback(async () => {
    if (!venueId) return;
    setLoadingSlots(true);
    try {
      const res = await venueAPI.getSlots(venueId, slotDate);
      setSlots(res.data?.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [venueId, slotDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const turfs = useMemo(() => {
    const map = new Map();
    slots.forEach(s => {
      if (!map.has(s.turf_number)) {
        map.set(s.turf_number, { turf_number: s.turf_number, turf_name: s.turf_name || `Turf #${s.turf_number}`, sport: s.sport });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.turf_number - b.turf_number);
  }, [slots]);

  const timeSlots = useMemo(() => {
    const seen = new Set();
    return slots
      .filter(s => { if (seen.has(s.start_time)) return false; seen.add(s.start_time); return true; })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(s => ({ start_time: s.start_time, end_time: s.end_time }));
  }, [slots]);

  const slotMap = useMemo(() => {
    const map = {};
    slots.forEach(s => { map[`${s.start_time}-${s.turf_number}`] = s; });
    return map;
  }, [slots]);

  const stats = useMemo(() => {
    const total = slots.length;
    const available = slots.filter(s => s.status === "available").length;
    const booked = slots.filter(s => s.status === "booked").length;
    const held = slots.filter(s => s.status === "on_hold" || s.status === "locked_by_you").length;
    return { total, available, booked, held };
  }, [slots]);

  const shiftDate = (days) => {
    const d = new Date(slotDate);
    d.setDate(d.getDate() + days);
    setSlotDate(d.toISOString().split("T")[0]);
  };

  const fmt12h = (t) => {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  const statusStyles = {
    available: "bg-emerald-500/15 text-emerald-500",
    booked: "bg-red-500/15 text-red-500",
    on_hold: "bg-amber-500/15 text-amber-500",
    locked_by_you: "bg-amber-500/15 text-amber-500",
  };
  const statusLabels = { available: "Open", booked: "Booked", on_hold: "Held", locked_by_you: "Held" };

  return (
    <div className="space-y-5">
      {/* Header + Date Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg">Slot Availability</h3>
          <p className="text-xs text-muted-foreground mt-0.5">View turf availability for any date</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)}
            className="w-40 h-9 bg-background border-border text-xs" />
          <button onClick={() => shiftDate(1)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="glass-card rounded-lg px-4 py-2 text-center min-w-[70px]">
          <p className="font-display font-black text-lg">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
        </div>
        <div className="glass-card rounded-lg px-4 py-2 text-center min-w-[70px]">
          <p className="font-display font-black text-lg text-emerald-500">{stats.available}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Available</p>
        </div>
        <div className="glass-card rounded-lg px-4 py-2 text-center min-w-[70px]">
          <p className="font-display font-black text-lg text-red-500">{stats.booked}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Booked</p>
        </div>
        {stats.held > 0 && (
          <div className="glass-card rounded-lg px-4 py-2 text-center min-w-[70px]">
            <p className="font-display font-black text-lg text-amber-500">{stats.held}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Held</p>
          </div>
        )}
      </div>

      {/* Grid */}
      {loadingSlots ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading slots...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-bold text-muted-foreground">No slots for this date</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try selecting a different date</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `80px repeat(${turfs.length}, minmax(100px, 1fr))` }}>
            {/* Header row */}
            <div className="sticky left-0 z-10 bg-secondary/80 backdrop-blur-sm px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-r border-border">
              Time
            </div>
            {turfs.map(t => (
              <div key={t.turf_number} className="bg-secondary/80 backdrop-blur-sm px-3 py-2.5 text-center border-b border-r border-border last:border-r-0">
                <p className="text-xs font-bold truncate">{t.turf_name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{t.sport}</p>
              </div>
            ))}

            {/* Data rows */}
            {timeSlots.map(time => (
              <>
                <div key={time.start_time} className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-mono text-muted-foreground border-b border-r border-border/50 flex items-center">
                  {fmt12h(time.start_time)}
                </div>
                {turfs.map(turf => {
                  const slot = slotMap[`${time.start_time}-${turf.turf_number}`];
                  const status = slot?.status || "available";
                  const style = statusStyles[status] || statusStyles.available;
                  return (
                    <div key={`${time.start_time}-${turf.turf_number}`}
                      className={`px-2 py-2 text-center border-b border-r border-border/50 last:border-r-0 ${style}`}
                      title={`${turf.turf_name} | ${fmt12h(time.start_time)} - ${fmt12h(time.end_time)} | ${statusLabels[status] || status} | ₹${slot?.price || 0}`}>
                      <div className="text-[11px] font-bold">{statusLabels[status] || status}</div>
                      {slot?.price != null && <div className="text-[10px] opacity-60">₹{slot.price}</div>}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Venue QR Check-in Panel ─────────────────────────────────────────────────
function VenueCheckinPanel({ bookings = [], venueName, onCheckinSuccess }) {
  const [scanMode, setScanMode] = useState("camera");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter(b => b.date === today && b.status === "confirmed");
  const checkedIn = todayBookings.filter(b => b.checked_in);
  const notCheckedIn = todayBookings.filter(b => !b.checked_in);

  const handleVerify = async (code) => {
    const qrData = (code || "").trim();
    if (!qrData) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await bookingAPI.verifyCheckin({ qr_data: qrData });
      setResult(res.data);
      stopCamera();
      // On successful check-in → refresh bookings + switch to attendance
      if (!res.data.error && !res.data.already_checked_in) {
        onCheckinSuccess?.();
        setTimeout(() => setScanMode("attendance"), 2000);
      }
    } catch (err) {
      setResult({ error: true, message: err.response?.data?.detail || "Verification failed" });
    }
    setVerifying(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    setResult(null);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("venue-qr-reader");
        scannerInstanceRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => { handleVerify(decodedText); },
          () => {}
        );
      } catch (err) {
        setCameraError(
          err?.toString?.().includes("NotAllowed")
            ? "Camera permission denied. Please allow camera access."
            : err?.toString?.().includes("NotFound")
              ? "No camera found on this device."
              : "Could not start camera. Try manual entry."
        );
        setCameraActive(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    try {
      if (scannerInstanceRef.current) {
        await scannerInstanceRef.current.stop();
        scannerInstanceRef.current.clear();
        scannerInstanceRef.current = null;
      }
    } catch { /* ignore */ }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        <button onClick={() => { setScanMode("camera"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Camera className="h-3.5 w-3.5" />Camera Scan
        </button>
        <button onClick={() => { setScanMode("upload"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Upload className="h-3.5 w-3.5" />Upload QR
        </button>
        <button onClick={() => { setScanMode("attendance"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "attendance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <ClipboardList className="h-3.5 w-3.5" />Attendance
          {todayBookings.length > 0 && (
            <span className="ml-0.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {checkedIn.length}/{todayBookings.length}
            </span>
          )}
        </button>
      </div>

      {/* Camera */}
      {scanMode === "camera" && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base">Scan Lobbian's QR Code</h3>
              <p className="text-xs text-muted-foreground">
                Point your camera at the Lobbian's phone to verify check-in at {venueName || "this venue"}.
              </p>
            </div>
          </div>

          {!cameraActive ? (
            <div className="text-center">
              <div className="w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 flex flex-col items-center justify-center mb-4 border-2 border-dashed border-border">
                <Camera className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Camera preview will appear here</p>
                {cameraError && <p className="text-xs text-destructive mt-2 px-4">{cameraError}</p>}
              </div>
              <Button className="bg-gradient-athletic text-white font-bold shadow-glow-primary hover:shadow-glow-hover" onClick={startCamera}>
                <Camera className="h-4 w-4 mr-2" /> Start Camera Scanner
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div id="venue-qr-reader" ref={scannerRef} className="w-full max-w-sm mx-auto rounded-xl overflow-hidden mb-4" />
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-xs text-muted-foreground font-bold">Scanning... point at QR code</span>
              </div>
              <Button variant="outline" size="sm" onClick={stopCamera} className="text-xs">
                <XCircle className="h-3.5 w-3.5 mr-1" /> Stop Camera
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload QR Image */}
      {scanMode === "upload" && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base">Upload QR Image</h3>
              <p className="text-xs text-muted-foreground">Upload a screenshot or photo of the Lobbian's QR code.</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm font-bold text-muted-foreground">Click to select QR image</span>
              <span className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG, or screenshot</span>
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setVerifying(true);
                setResult(null);
                try {
                  const { Html5Qrcode } = await import("html5-qrcode");
                  const scanner = new Html5Qrcode("upload-qr-decode");
                  const decoded = await scanner.scanFile(file, true);
                  scanner.clear();
                  await handleVerify(decoded);
                } catch {
                  setResult({ error: true, message: "Could not read QR code from image. Try a clearer photo." });
                  setVerifying(false);
                }
                e.target.value = "";
              }} />
            </label>
            <div id="upload-qr-decode" className="hidden" />
          </div>
        </div>
      )}

      {/* Attendance */}
      {scanMode === "attendance" && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm">Today's Attendance — {venueName}</h3>
                <p className="text-[10px] text-muted-foreground">{today}</p>
              </div>
            </div>
            {todayBookings.length > 0 && (
              <div className="text-right">
                <div className="font-display font-black text-xl text-primary">{checkedIn.length}/{todayBookings.length}</div>
                <div className="text-[10px] text-muted-foreground font-bold">Checked In</div>
              </div>
            )}
          </div>

          {todayBookings.length > 0 && (
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-athletic rounded-full transition-all duration-500"
                style={{ width: `${(checkedIn.length / todayBookings.length) * 100}%` }} />
            </div>
          )}

          {todayBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">No confirmed bookings for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notCheckedIn.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <UserX className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{b.host_name || b.booked_by_name || "Lobbian"}</span>
                      {b.sport && <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{b.sport}</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {b.start_time} - {b.end_time} · Turf #{b.turf_number || 1}
                    </div>
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">Pending</Badge>
                </div>
              ))}
              {checkedIn.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                    <UserCheck className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{b.host_name || b.booked_by_name || "Lobbian"}</span>
                      {b.sport && <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{b.sport}</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {b.start_time} - {b.end_time} · Turf #{b.turf_number || 1}
                      {b.checkin_time && (
                        <span className="ml-2 text-brand-400">
                          at {new Date(b.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-brand-500/15 text-brand-400 text-[10px] shrink-0">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Present
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {scanMode !== "attendance" && result && (
        <div className={`rounded-xl border-2 p-6 text-center ${
          result.error ? "border-destructive/50 bg-destructive/5"
            : result.already_checked_in ? "border-amber-500/50 bg-amber-500/5"
            : "border-brand-500/50 bg-brand-500/5"
        }`}>
          {result.error ? (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
              <p className="font-display font-bold text-lg text-destructive">Verification Failed</p>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            </>
          ) : result.already_checked_in ? (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
              <p className="font-display font-bold text-lg text-amber-400">Already Checked In</p>
              <p className="text-sm text-muted-foreground mt-1">{result.player_name} has already checked in.</p>
            </>
          ) : (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-brand-400" />
              <p className="font-display font-bold text-lg text-brand-400">Check-in Successful!</p>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-bold text-foreground">{result.player_name}</span> is checked in
              </p>
              {result.booking && (
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{result.booking.date}</span>
                  <span>{result.booking.start_time} - {result.booking.end_time}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
