import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { venueAPI, bookingAPI, analyticsAPI, subscriptionAPI, uploadAPI, pricingMLAPI, coachingAPI } from "@/lib/api";
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
import { Building2, IndianRupee, TrendingUp, Calendar, Plus, Trash2, BarChart3, Clock, ShieldAlert, Crown, CheckCircle, Pencil, Users, CreditCard, X, ChevronLeft, ChevronRight, Filter, History, CalendarDays, CircleDot, AlertCircle, ArrowUpDown, Star, MessageSquare, QrCode, ExternalLink, Copy, Check, Globe, ImagePlus, Upload, Brain, Zap, Camera, UserCheck, UserX, ClipboardList, Loader2, XCircle } from "lucide-react";
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
  const [venueReviews, setVenueReviews] = useState([]);
  const [showVenueQR, setShowVenueQR] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [editVenueForm, setEditVenueForm] = useState({});
  const [savingVenue, setSavingVenue] = useState(false);
  const SPORT_SUGGESTIONS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball", "Table Tennis", "Hockey", "Pickleball", "Swimming"];
  const AMENITY_SUGGESTIONS = ["Parking", "Washroom", "Changing Room", "Drinking Water", "Floodlights", "Cafeteria", "First Aid", "WiFi", "Seating Area", "Scoreboard"];
  const [sportInput, setSportInput] = useState("");
  const [amenityInput, setAmenityInput] = useState("");
  const [venueForm, setVenueForm] = useState({
    name: "", description: "", sports: [], address: "", area: "", city: "Bengaluru",
    base_price: 2000, slot_duration_minutes: 60, opening_hour: 6, closing_hour: 23,
    amenities: [], images: [], turf_config: [],
  });

  // Helper: add sport + auto-create turf_config entry
  const addSport = (sport) => {
    const s = sport.trim().toLowerCase();
    if (!s || venueForm.sports.includes(s)) return;
    setVenueForm(p => ({
      ...p,
      sports: [...p.sports, s],
      turf_config: [...p.turf_config, { sport: s, turfs: [{ name: `${sport.trim()} Turf 1`, price: p.base_price }] }],
    }));
    setSportInput("");
  };
  const removeSport = (sport) => {
    setVenueForm(p => ({
      ...p,
      sports: p.sports.filter(s => s !== sport),
      turf_config: p.turf_config.filter(tc => tc.sport !== sport),
    }));
  };
  const addAmenity = (amenity) => {
    const a = amenity.trim();
    if (!a || venueForm.amenities.includes(a)) return;
    setVenueForm(p => ({ ...p, amenities: [...p.amenities, a] }));
    setAmenityInput("");
  };
  const removeAmenity = (amenity) => {
    setVenueForm(p => ({ ...p, amenities: p.amenities.filter(a => a !== amenity) }));
  };
  // Turf config helpers
  const addTurfToSport = (sport) => {
    setVenueForm(p => ({
      ...p,
      turf_config: p.turf_config.map(tc =>
        tc.sport === sport ? { ...tc, turfs: [...tc.turfs, { name: `${sport} Turf ${tc.turfs.length + 1}`, price: p.base_price }] } : tc
      ),
    }));
  };
  const removeTurfFromSport = (sport, idx) => {
    setVenueForm(p => ({
      ...p,
      turf_config: p.turf_config.map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.filter((_, i) => i !== idx) } : tc
      ),
    }));
  };
  const renameTurf = (sport, idx, name) => {
    setVenueForm(p => ({
      ...p,
      turf_config: p.turf_config.map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, name } : t) } : tc
      ),
    }));
  };
  const updateTurfPrice = (sport, idx, price) => {
    setVenueForm(p => ({
      ...p,
      turf_config: p.turf_config.map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, price: Number(price) } : t) } : tc
      ),
    }));
  };
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
    name: "", priority: 10,
    conditions: { days: [], time_range: { start: "18:00", end: "22:00" } },
    action: { type: "multiplier", value: 1.2 },
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
      await venueAPI.create(payload);
      toast.success("Venue created!");
      setCreateVenueOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const [editSportInput, setEditSportInput] = useState("");
  const [editAmenityInput, setEditAmenityInput] = useState("");

  // Edit form helpers for sports/amenities/turfs
  const addEditSport = (sport) => {
    const s = sport.trim().toLowerCase();
    if (!s || (editVenueForm.sports || []).includes(s)) return;
    setEditVenueForm(p => ({
      ...p,
      sports: [...(p.sports || []), s],
      turf_config: [...(p.turf_config || []), { sport: s, turfs: [{ name: `${sport.trim()} Turf 1`, price: p.base_price || 2000 }] }],
    }));
    setEditSportInput("");
  };
  const removeEditSport = (sport) => {
    setEditVenueForm(p => ({
      ...p,
      sports: (p.sports || []).filter(s => s !== sport),
      turf_config: (p.turf_config || []).filter(tc => tc.sport !== sport),
    }));
  };
  const addEditAmenity = (amenity) => {
    const a = amenity.trim();
    if (!a || (editVenueForm.amenities || []).includes(a)) return;
    setEditVenueForm(p => ({ ...p, amenities: [...(p.amenities || []), a] }));
    setEditAmenityInput("");
  };
  const removeEditAmenity = (amenity) => {
    setEditVenueForm(p => ({ ...p, amenities: (p.amenities || []).filter(a => a !== amenity) }));
  };
  const addEditTurf = (sport) => {
    setEditVenueForm(p => ({
      ...p,
      turf_config: (p.turf_config || []).map(tc =>
        tc.sport === sport ? { ...tc, turfs: [...tc.turfs, { name: `${sport} Turf ${tc.turfs.length + 1}`, price: p.base_price || 2000 }] } : tc
      ),
    }));
  };
  const removeEditTurf = (sport, idx) => {
    setEditVenueForm(p => ({
      ...p,
      turf_config: (p.turf_config || []).map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.filter((_, i) => i !== idx) } : tc
      ),
    }));
  };
  const renameEditTurf = (sport, idx, name) => {
    setEditVenueForm(p => ({
      ...p,
      turf_config: (p.turf_config || []).map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, name } : t) } : tc
      ),
    }));
  };
  const updateEditTurfPrice = (sport, idx, price) => {
    setEditVenueForm(p => ({
      ...p,
      turf_config: (p.turf_config || []).map(tc =>
        tc.sport === sport ? { ...tc, turfs: tc.turfs.map((t, i) => i === idx ? { ...t, price: Number(price) } : t) } : tc
      ),
    }));
  };

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
      base_price: selectedVenue.base_price || 2000,
      opening_hour: selectedVenue.opening_hour || 6,
      closing_hour: selectedVenue.closing_hour || 23,
      turf_config: selectedVenue.turf_config || [],
      slot_duration_minutes: selectedVenue.slot_duration_minutes || 60,
      images: selectedVenue.images || [],
    });
    setEditSportInput("");
    setEditAmenityInput("");
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
      name: rule.name,
      priority: rule.priority,
      conditions: {
        days: rule.conditions?.days || [],
        time_range: rule.conditions?.time_range || { start: "18:00", end: "22:00" },
      },
      action: rule.action || { type: "multiplier", value: 1.2 },
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

      <Dialog open={createVenueOpen} onOpenChange={setCreateVenueOpen}>
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
                          {tc.turfs.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={t.name} onChange={e => renameTurf(tc.sport, idx, e.target.value)}
                                placeholder={`Turf ${idx + 1} name`} className="bg-background border-border text-xs h-8 flex-1" />
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">₹</span>
                                <Input type="number" value={t.price ?? venueForm.base_price} onChange={e => updateTurfPrice(tc.sport, idx, e.target.value)}
                                  placeholder="Price" className="bg-background border-border text-xs h-8 w-20" />
                              </div>
                              {tc.turfs.length > 1 && (
                                <button type="button" onClick={() => removeTurfFromSport(tc.sport, idx)}
                                  className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          ))}
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

      {/* Venue Selector - Athletic Pills */}
      {venues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8 space-y-4"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Your Venues</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {venues.map((v, idx) => (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                onClick={() => handleSelectVenue(v)}
                data-testid={`venue-tab-${v.id}`}
                className={`shrink-0 px-6 py-3 rounded-xl font-bold uppercase tracking-wide text-sm transition-all duration-300 border-2 ${
                  selectedVenue?.id === v.id
                    ? "bg-primary/20 border-primary text-primary shadow-glow-primary scale-105"
                    : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary hover:scale-105"
                }`}
              >
                {v.name}
              </motion.button>
            ))}
          </div>
          {/* Public page actions for selected venue */}
          {selectedVenue?.slug && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span className="font-mono">/venue/{selectedVenue.slug}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => navigate(`/venue/${selectedVenue.slug}`)}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Public Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setShowVenueQR(true)}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Code
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={async () => {
                  const url = `${window.location.origin}/venue/${selectedVenue.slug}`;
                  await navigator.clipboard.writeText(url);
                  setCopiedSlug(true);
                  toast.success("Public link copied!");
                  setTimeout(() => setCopiedSlug(false), 2000);
                }}
              >
                {copiedSlug ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSlug ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground"
                onClick={openEditVenue}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Details
              </Button>
            </div>
          )}
        </motion.div>
      )}
      </>)}

      {/* Compact venue selector on manage view */}
      {isManageView && venues.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {venues.map(v => (
            <button key={v.id} onClick={() => handleSelectVenue(v)}
              className={`shrink-0 px-4 py-2 rounded-lg font-bold text-xs transition-all border ${selectedVenue?.id === v.id ? "bg-brand-500/10 border-brand-500/30 text-brand-500" : "bg-card/50 border-border/50 text-muted-foreground hover:border-brand-500/30"}`}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      {isManageView && (
      <Tabs defaultValue="bookings" data-testid="owner-tabs">
        <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="bookings" className="font-bold text-xs" data-testid="tab-bookings">Bookings</TabsTrigger>
          <TabsTrigger value="slots" className="font-bold text-xs" data-testid="tab-slots">
            <CalendarDays className="h-3 w-3 mr-1" />Slots
          </TabsTrigger>
          <TabsTrigger value="history" className="font-bold text-xs" data-testid="tab-history">
            <History className="h-3 w-3 mr-1" />History
          </TabsTrigger>
          <TabsTrigger value="reviews" className="font-bold text-xs" data-testid="tab-reviews">
            <Star className="h-3 w-3 mr-1" />Reviews
          </TabsTrigger>
          <TabsTrigger value="pricing" className="font-bold text-xs" data-testid="tab-pricing">Pricing</TabsTrigger>
          <TabsTrigger value="analytics" className="font-bold text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="ml-pricing" className="font-bold text-xs" data-testid="tab-ml-pricing">
            <Brain className="h-3 w-3 mr-1" />AI Pricing
          </TabsTrigger>
          <TabsTrigger value="checkin" className="font-bold text-xs" data-testid="tab-checkin">
            <QrCode className="h-3 w-3 mr-1" />Check-in
          </TabsTrigger>
          <TabsTrigger value="plan" className="font-bold text-xs" data-testid="tab-plan">Plan</TabsTrigger>
        </TabsList>

        {/* Bookings - Enhanced with filters, detail view */}
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

        {/* History Tab - Comprehensive booking timeline */}
        <TabsContent value="history">
          <div className="space-y-6" data-testid="booking-history-tab">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg">Booking History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Complete timeline of all bookings across your venues</p>
              </div>
            </div>

            {/* History by Date Groups */}
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
                const isUp = diff > 0;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={`glass-card rounded-lg p-4 border-l-4 ${r.is_active ? (isUp ? "border-l-amber-500" : "border-l-brand-500") : "border-l-muted-foreground/30 opacity-60"}`}
                    data-testid={`rule-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{r.name}</span>
                          <Badge className={`text-[10px] ${r.action?.type === "multiplier" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : "bg-brand-500/15 text-brand-400 border-brand-500/20"} border`}>
                            {r.action?.type === "multiplier" ? `${r.action.value}x` : `-${Math.round((r.action.value || 0) * 100)}%`}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">P{r.priority}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                          {r.conditions?.time_range && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.conditions.time_range.start}-{r.conditions.time_range.end}</span>
                          )}
                          {r.conditions?.days?.length > 0 && (
                            <span className="flex items-center gap-1">
                              {r.conditions.days.map(d => DAY_LABELS[d]).join(", ")}
                            </span>
                          )}
                          {(!r.conditions?.days || r.conditions.days.length === 0) && <span>All days</span>}
                        </div>
                        {r.is_active && (
                          <div className="mt-2 text-xs">
                            <span className="text-muted-foreground">Effect: </span>
                            <span className="text-muted-foreground">{"\u20B9"}{basePrice}</span>
                            <span className="text-muted-foreground mx-1">{"\u2192"}</span>
                            <span className={`font-bold ${isUp ? "text-amber-400" : "text-brand-400"}`}>{"\u20B9"}{effectivePrice}</span>
                            <span className={`ml-1 text-[10px] ${isUp ? "text-amber-400" : "text-brand-400"}`}>
                              ({isUp ? "+" : ""}{"\u20B9"}{diff})
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={r.is_active !== false} onCheckedChange={() => handleToggleRule(r.id)} data-testid={`toggle-rule-${r.id}`} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditRule(r)} data-testid={`edit-rule-${r.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRule(r.id)} data-testid={`delete-rule-${r.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rule Create/Edit Dialog */}
          <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingRule ? "Edit" : "Create"} Pricing Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Rule Name</Label>
                  <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Weekend Peak Hours" className="mt-1 bg-background border-border" data-testid="rule-name-input" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priority (higher = applied first)</Label>
                  <Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))}
                    className="mt-1 bg-background border-border" data-testid="rule-priority-input" />
                </div>

                {/* Days of week */}
                <div>
                  <Label className="text-xs text-muted-foreground">Days of Week</Label>
                  <p className="text-[10px] text-muted-foreground mb-2">Leave empty for all days</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, i) => (
                      <button key={i} onClick={() => toggleDay(i)} data-testid={`day-btn-${i}`}
                        className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${
                          (ruleForm.conditions.days || []).includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Time range */}
                <div>
                  <Label className="text-xs text-muted-foreground">Time Range</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input value={ruleForm.conditions.time_range?.start || ""}
                      onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, start: e.target.value } } }))}
                      placeholder="18:00" className="bg-background border-border" data-testid="rule-time-start" />
                    <Input value={ruleForm.conditions.time_range?.end || ""}
                      onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, end: e.target.value } } }))}
                      placeholder="22:00" className="bg-background border-border" data-testid="rule-time-end" />
                  </div>
                </div>

                {/* Action */}
                <div>
                  <Label className="text-xs text-muted-foreground">Action Type</Label>
                  <Select value={ruleForm.action.type} onValueChange={v => setRuleForm(p => ({ ...p, action: { ...p.action, type: v } }))}>
                    <SelectTrigger className="mt-1 bg-background border-border" data-testid="rule-action-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiplier">Multiplier (e.g., 1.2 = +20%)</SelectItem>
                      <SelectItem value="discount">Discount (e.g., 0.15 = -15%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input type="number" step="0.01" value={ruleForm.action.value}
                    onChange={e => setRuleForm(p => ({ ...p, action: { ...p.action, value: Number(e.target.value) } }))}
                    className="mt-1 bg-background border-border" data-testid="rule-value-input" />
                </div>

                {/* Live Preview */}
                <div className="glass-card rounded-lg p-3" data-testid="rule-preview">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Price Preview</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{"\u20B9"}{basePrice}</span>
                    <span className="text-muted-foreground">{"\u2192"}</span>
                    <span className="text-lg font-display font-bold text-primary">{"\u20B9"}{previewPrice(ruleForm)}</span>
                    {(() => {
                      const d = previewPrice(ruleForm) - basePrice;
                      return d !== 0 && (
                        <Badge className={`text-[10px] ${d > 0 ? "bg-amber-500/15 text-amber-400" : "bg-brand-500/15 text-brand-400"}`}>
                          {d > 0 ? "+" : ""}{"\u20B9"}{d}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveRule} data-testid="submit-rule-btn">
                  {editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics">
          {analytics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><BarChart3 className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No analytics data</p></div>
          )}
        </TabsContent>

        {/* ML Pricing Tab */}
        <TabsContent value="ml-pricing" data-testid="ml-pricing-tab-content">
          {selectedVenue && <MLPricingPanel venueId={selectedVenue.id} venueName={selectedVenue.name} />}
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
                        {tc.turfs.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input value={t.name} onChange={e => renameEditTurf(tc.sport, idx, e.target.value)}
                              placeholder={`Turf ${idx + 1} name`} className="bg-background border-border text-xs h-8 flex-1" />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">₹</span>
                              <Input type="number" value={t.price ?? editVenueForm.base_price ?? 2000} onChange={e => updateEditTurfPrice(tc.sport, idx, e.target.value)}
                                placeholder="Price" className="bg-background border-border text-xs h-8 w-20" />
                            </div>
                            {tc.turfs.length > 1 && (
                              <button type="button" onClick={() => removeEditTurf(tc.sport, idx)}
                                className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        ))}
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

// ─── ML Pricing Panel Component ─────────────────────────────────────────────
function MLPricingPanel({ venueId, venueName }) {
  const [pricingMode, setPricingMode] = useState("rule_based");
  const [forecast, setForecast] = useState(null);
  const [forecastDate, setForecastDate] = useState(new Date().toISOString().split("T")[0]);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    pricingMLAPI.getMode(venueId).then(r => setPricingMode(r.data.pricing_mode || "rule_based")).catch(() => {});
  }, [venueId]);

  const loadForecast = useCallback(async () => {
    setLoadingForecast(true);
    try {
      const res = await pricingMLAPI.demandForecast(venueId, forecastDate);
      setForecast(res.data);
    } catch {
      setForecast(null);
    } finally {
      setLoadingForecast(false);
    }
  }, [venueId, forecastDate]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  const handleToggleMode = async () => {
    const newMode = pricingMode === "rule_based" ? "ml" : "rule_based";
    setSwitching(true);
    try {
      await pricingMLAPI.setMode(venueId, newMode);
      setPricingMode(newMode);
      toast.success(`Pricing mode switched to ${newMode === "ml" ? "AI/ML" : "Rule-based"}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to switch mode");
    } finally {
      setSwitching(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await pricingMLAPI.trainModel(venueId);
      setTrainResult(res.data);
      if (res.data.status === "trained") {
        toast.success("ML model trained successfully!");
      } else {
        toast.info(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  const demandColor = (level) => {
    if (level === "high") return "text-brand-400 bg-brand-500/15";
    if (level === "medium") return "text-amber-400 bg-amber-500/15";
    return "text-muted-foreground bg-secondary/50";
  };

  return (
    <div className="space-y-5" data-testid="ml-pricing-panel">
      {/* Mode Toggle Card */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">AI Dynamic Pricing</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {pricingMode === "ml"
                ? "ML model is actively adjusting prices based on demand patterns"
                : "Using rule-based pricing. Switch to ML for AI-driven dynamic prices."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Rule-based</span>
            <button onClick={handleToggleMode} disabled={switching}
              className={`w-12 h-6 rounded-full transition-all relative ${pricingMode === "ml" ? "bg-primary" : "bg-secondary"}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${pricingMode === "ml" ? "left-6" : "left-0.5"}`} />
            </button>
            <span className="text-xs font-bold text-primary">AI/ML</span>
          </div>
        </div>
      </div>

      {/* Train Model Card */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-bold text-sm mb-1">Train ML Model</h3>
            <p className="text-xs text-muted-foreground">
              Train the pricing model using your venue's historical booking data.
              Requires at least 50 confirmed bookings.
            </p>
          </div>
          <Button onClick={handleTrain} disabled={training}
            className="bg-primary text-primary-foreground font-bold text-xs h-9"
            data-testid="train-model-btn">
            {training ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            {training ? "Training..." : "Train Model"}
          </Button>
        </div>
        {trainResult && (
          <div className={`mt-3 p-3 rounded-lg text-xs ${trainResult.status === "trained" ? "bg-brand-500/10 text-brand-400" : "bg-amber-500/10 text-amber-400"}`}>
            {trainResult.message}
          </div>
        )}
      </div>

      {/* Demand Forecast */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h3 className="font-bold text-sm mb-1">Demand Forecast</h3>
            <p className="text-xs text-muted-foreground">Predicted demand and ML-suggested prices for each slot</p>
          </div>
          <Input type="date" value={forecastDate}
            onChange={e => setForecastDate(e.target.value)}
            className="w-40 h-9 bg-background border-border text-xs" />
        </div>
        {loadingForecast ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : forecast?.forecasts?.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {forecast.forecasts.map((f, i) => (
              <div key={i} className="glass-card rounded-lg p-3 text-center">
                <div className="text-xs font-mono text-muted-foreground mb-1">{f.start_time}</div>
                <div className={`text-lg font-display font-black ${f.ml_price ? "text-primary" : "text-foreground"}`}>
                  ₹{f.ml_price || f.base_price || "—"}
                </div>
                {f.demand_level && (
                  <Badge className={`text-[9px] mt-1 ${demandColor(f.demand_level)}`}>
                    {f.demand_level}
                  </Badge>
                )}
                {f.confidence != null && (
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {Math.round(f.confidence * 100)}% conf
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs">No forecast data. Train the model with 50+ bookings first.</p>
          </div>
        )}
      </div>
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
      const res = await coachingAPI.verifyCheckin({ qr_data: qrData });
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
