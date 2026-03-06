import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { venueAPI, bookingAPI, analyticsAPI, subscriptionAPI, uploadAPI, teamAPI } from "@/lib/api";
import { mediaUrl, fmt12h } from "@/lib/utils";
import { getSportIcon } from "@/lib/venue-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Calendar,
  Plus,
  Trash2,
  BarChart2,
  BarChart3,
  Clock,
  ShieldAlert,
  Crown,
  CheckCircle,
  Pencil,
  Users,
  CreditCard,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  CalendarDays,
  AlertCircle,
  ArrowUpDown,
  Star,
  MessageSquare,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Globe,
  ImagePlus,
  Upload,
  Brain,
  Zap,
  Camera,
  UserCheck,
  UserX,
  ClipboardList,
  Loader2,
  XCircle,
  Lightbulb,
  Tag,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { VenueOwnerDashboardSkeleton } from "@/components/SkeletonLoader";
import VenueForm from "@/components/venue/VenueForm";

// Professional / venue owner imagery
const OWNER_HERO =
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80";

function TabsIndicator() {
  return (
    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full opacity-0 transition-opacity [[data-state=active]_&]:opacity-100" />
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  index = 0,
  colorClass = "text-brand-600",
  bgClass = "bg-brand-600/10",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl sm:rounded-[28px] p-4 sm:p-6 border border-border/40 shadow-sm flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="admin-label text-xs sm:text-sm">{label}</div>
        <div
          className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${bgClass} flex items-center justify-center border border-border/40`}
        >
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colorClass}`} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-foreground tracking-tight">
        {value}
      </div>
    </motion.div>
  );
}
const VENUE_BANNER =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


export default function VenueOwnerDashboard({ defaultView }) {
  const { user } = useAuth();

  // Pending/rejected/suspended account gate
  if (user?.account_status === "pending") {
    return (
      <div
        className="max-w-lg mx-auto px-4 py-24 text-center"
        data-testid="pending-approval-screen"
      >
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-6 sm:p-8 space-y-4">
          <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-amber-400 mx-auto" />
          <h1 className="font-display text-lg sm:text-xl admin-page-title">
            Account Pending Approval
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your venue owner registration is being reviewed by the Horizon team.
            You'll receive a notification once approved.
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            Check back soon — most approvals happen within 24 hours.
          </div>
        </div>
      </div>
    );
  }
  if (
    user?.account_status === "rejected" ||
    user?.account_status === "suspended"
  ) {
    return (
      <div
        className="max-w-lg mx-auto px-4 py-24 text-center"
        data-testid="account-blocked-screen"
      >
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-6 sm:p-8 space-y-4">
          <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-destructive mx-auto" />
          <h1 className="font-display text-xl admin-page-title">
            Account{" "}
            {user.account_status === "rejected" ? "Not Approved" : "Suspended"}
          </h1>
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
  const [urlParams, setUrlParams] = useSearchParams();
  const urlTab = urlParams.get("tab");
  const VALID_TABS = [
    "bookings",
    "slots",
    "reviews",
    "pricing",
    "checkin",
    "plan",
  ];
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : "bookings";
  const setActiveTab = (tab) => {
    setUrlParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", tab);
        return p;
      },
      { replace: true },
    );
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
  const [statusFilter, setStatusFilter] = useState(
    urlParams.get("status") || "all",
  );
  const [timeFilter, setTimeFilter] = useState(urlParams.get("time") || "all");
  const [sortOrder, setSortOrder] = useState(urlParams.get("sort") || "desc");
  const [bookingView, setBookingView] = useState(urlParams.get("bview") || "list");
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingTotalPages, setBookingTotalPages] = useState(1);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const [bookingStats, setBookingStats] = useState({ total: 0, confirmed: 0, pending: 0, cancelled: 0, upcoming: 0 });
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const BOOKING_LIMIT = 10;
  const bookingFilterRef = useRef(false);
  const [pricingView, setPricingView] = useState("rules");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [venueReviews, setVenueReviews] = useState([]);
  const [showVenueQR, setShowVenueQR] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [editVenueForm, setEditVenueForm] = useState({});
  const [savingVenue, setSavingVenue] = useState(false);
  const [baseTurf, setBaseTurf] = useState(null); // { sport, idx } — create form selected base
  const [editBaseTurf, setEditBaseTurf] = useState(null); // edit form selected base
  const [venueForm] = useState({
    name: "",
    description: "",
    sports: [],
    address: "",
    area: "",
    city: "Bengaluru",
    slot_duration_minutes: 60,
    opening_hour: 6,
    closing_hour: 23,
    amenities: [],
    images: [],
    turf_config: [],
    google_maps_url: "",
  });

  const emptyRule = {
    name: "",
    rule_type: "discount",
    value_type: "percent",
    value: 20,
    schedule_type: "recurring",
    conditions: { days: [], time_range: { start: "18:00", end: "22:00" } },
    date_from: "",
    date_to: "",
    time_from: "18:00",
    time_to: "22:00",
    is_active: true,
  };
  const [ruleForm, setRuleForm] = useState({ ...emptyRule });

  useEffect(() => {
    subscriptionAPI
      .myPlan()
      .then((r) => setPlanData(r.data))
      .catch(() => {});
  }, []);

  const handleUpgrade = async (planId) => {
    setUpgrading(true);
    try {
      await subscriptionAPI.upgrade({ plan_id: planId });
      const r = await subscriptionAPI.myPlan();
      setPlanData(r.data);
      toast.success("Plan upgraded!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

  const loadBookings = useCallback(async (p = 1, venue = selectedVenue) => {
    setBookingsLoading(true);
    try {
      const params = { page: p, limit: BOOKING_LIMIT, sort_order: sortOrder };
      if (venue) params.venue_id = venue.id;
      if (statusFilter !== "all") params.status = statusFilter;
      if (timeFilter !== "all") params.time_filter = timeFilter;
      const res = await bookingAPI.list(params);
      const data = res.data || {};
      setBookings(data.bookings || []);
      setBookingTotalPages(data.pages || 1);
      setBookingTotal(data.total || 0);
      setBookingPage(data.page || p);
      setBookingStats(data.stats || { total: 0, confirmed: 0, pending: 0, cancelled: 0, upcoming: 0 });
    } catch { /* ignore */ }
    finally { setBookingsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, timeFilter, sortOrder, selectedVenue]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const vRes = await venueAPI.getOwnerVenues().catch(() => ({ data: [] }));
      const venueList = Array.isArray(vRes.data) ? vRes.data : [];
      setVenues(venueList);
      if (venueList.length > 0) {
        const v = selectedVenue || venueList[0];
        setSelectedVenue(v);
        const [aRes, pRes] = await Promise.all([
          analyticsAPI.venue(v.id).catch(() => ({ data: null })),
          venueAPI.getPricingRules(v.id).catch(() => ({ data: [] })),
        ]);
        setAnalytics(aRes.data);
        setPricingRules(Array.isArray(pRes.data) ? pRes.data : []);
        loadBookings(1, v);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload bookings when filters change (skip initial mount — loadData handles that)
  useEffect(() => {
    if (!bookingFilterRef.current) { bookingFilterRef.current = true; return; }
    setBookingPage(1);
    loadBookings(1);
  }, [statusFilter, timeFilter, sortOrder, selectedVenue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync booking filters → URL (preserve tab + other params)
  useEffect(() => {
    setUrlParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (statusFilter !== "all") p.set("status", statusFilter);
        else p.delete("status");
        if (timeFilter !== "all") p.set("time", timeFilter);
        else p.delete("time");
        if (sortOrder !== "desc") p.set("sort", sortOrder);
        else p.delete("sort");
        if (bookingView !== "list") p.set("bview", bookingView);
        else p.delete("bview");
        return p;
      },
      { replace: true },
    );
  }, [statusFilter, timeFilter, sortOrder, bookingView, setUrlParams]);

  const loadVenueTeams = useCallback(async () => {
    if (!selectedVenue) return;
    setTeamsLoading(true);
    try {
      const sport = selectedVenue?.sports?.[0] || "";
      const res = await teamAPI.list({ sport });
      setVenueTeams(res.data?.teams || []);
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setTeamsLoading(false);
    }
  }, [selectedVenue]);

  // Load reviews when selectedVenue changes
  useEffect(() => {
    if (selectedVenue) {
      venueAPI
        .getReviews(selectedVenue.id)
        .then((res) => setVenueReviews(res.data))
        .catch(() => setVenueReviews([]));
    }
  }, [selectedVenue]);

  const handleCreateVenue = async (payload) => {
    try {
      await venueAPI.create(payload);
      toast.success("Venue created!");
      setCreateVenueOpen(false);
      setBaseTurf(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const [venueTeams, setVenueTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

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
      google_maps_url: selectedVenue.google_maps_url || "",
    });
    // Init editBaseTurf: find turf whose price matches existing base_price
    let foundBT = null;
    for (const tc of selectedVenue.turf_config || []) {
      const idx = (tc.turfs || []).findIndex(
        (t) => t.price === selectedVenue.base_price,
      );
      if (idx >= 0) {
        foundBT = { sport: tc.sport, idx };
        break;
      }
    }
    if (!foundBT && selectedVenue.turf_config?.[0]) {
      foundBT = { sport: selectedVenue.turf_config[0].sport, idx: 0 };
    }
    setEditBaseTurf(foundBT);
    setEditVenueOpen(true);
  };

  const handleSaveVenue = async (payload) => {
    if (!selectedVenue) return;
    setSavingVenue(true);
    try {
      const res = await venueAPI.update(selectedVenue.id, payload);
      setSelectedVenue(res.data);
      setVenues((prev) =>
        prev.map((v) => (v.id === res.data.id ? res.data : v)),
      );
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
      rule_type:
        rule.rule_type ||
        (rule.action?.type === "multiplier" ? "surge" : "discount"),
      value_type: rule.value_type || "percent",
      value:
        rule.value ??
        (rule.action?.value ? Math.round(rule.action.value * 100) : 20),
      schedule_type: rule.schedule_type || "recurring",
      conditions: {
        days: rule.conditions?.days || [],
        time_range: rule.conditions?.time_range || {
          start: "18:00",
          end: "22:00",
        },
      },
      date_from: rule.date_from || "",
      date_to: rule.date_to || "",
      time_from:
        rule.time_from || rule.conditions?.time_range?.start || "18:00",
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
      setPricingRules((prev) =>
        prev.map((r) =>
          r.id === ruleId ? { ...r, is_active: !r.is_active } : r,
        ),
      );
      toast.success("Rule toggled");
    } catch (err) {
      toast.error("Failed to toggle rule");
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await venueAPI.deletePricingRule(ruleId);
      setPricingRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success("Rule deleted");
    } catch (err) {
      toast.error("Failed to delete rule");
    }
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
    setRuleForm((prev) => {
      const days = prev.conditions.days || [];
      return {
        ...prev,
        conditions: {
          ...prev.conditions,
          days: days.includes(dayIndex)
            ? days.filter((d) => d !== dayIndex)
            : [...days, dayIndex],
        },
      };
    });
  };

  const basePrice = selectedVenue?.base_price || 2000;
  const previewPrice = (rule) => {
    const val = parseFloat(rule.value) || 0;
    if (rule.rule_type === "discount") {
      return Math.max(Math.round(basePrice * (1 - val / 100)), 0);
    }
    if (rule.rule_type === "surge") {
      return Math.round(basePrice * (1 + val / 100));
    }
    // legacy
    if (rule.action?.type === "multiplier")
      return Math.round(basePrice * (rule.action.value || 1));
    if (rule.action?.type === "discount")
      return Math.round(basePrice * (1 - (rule.action.value || 0)));
    return basePrice;
  };

  const totalRevenue = analytics?.total_revenue || 0;
  const totalBookings = analytics?.total_bookings || 0;

  const today = new Date().toISOString().split("T")[0];

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
      loadBookings(bookingPage);
      setSlotRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel");
    }
  };

  const statusConfig = {
    confirmed: {
      color: "bg-brand-500/15 text-brand-600 border-brand-500/30",
      label: "Confirmed",
    },
    pending: {
      color: "bg-amber-500/15 text-amber-600 border-amber-500/30",
      label: "Pending",
    },
    payment_pending: {
      color: "bg-sky-500/15 text-sky-600 border-sky-500/30",
      label: "Awaiting Payment",
    },
    cancelled: {
      color: "bg-destructive/15 text-destructive border-destructive/20",
      label: "Cancelled",
    },
    expired: {
      color:
        "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
      label: "Expired",
    },
  };

  if (loading) return <VenueOwnerDashboardSkeleton />;

  return (
    <div
      className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-8 pb-20 md:pb-6"
      data-testid="owner-dashboard"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 1.25rem)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 5rem)",
      }}
    >
      {/* Welcome Hero, Stats, Venue Selector — only on Dashboard home */}
      {!isManageView && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-10 -mx-3 sm:mx-0 rounded-none sm:rounded-2xl sm:rounded-[28px] border-0 sm:border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden"
          >
            <div className="grid md:grid-cols-3 gap-0">
              {/* Text Content */}
              <div className="md:col-span-2 p-4 sm:p-8 md:p-10 flex flex-col justify-center">
                <span className="admin-section-label text-muted-foreground text-[10px] sm:text-xs">
                  Venue Owner
                </span>
                <h1 className="font-display text-lg sm:text-3xl md:text-4xl admin-page-title mt-1 sm:mt-2 truncate">
                  Welcome, <span className="text-brand-600">{user?.name}</span>
                </h1>
                <p className="text-muted-foreground font-semibold mt-1.5 sm:mt-3 text-xs sm:text-base">
                  Manage your venues, track revenue, and grow your sports
                  business.
                </p>
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

          {/* Stats - Athletic Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-10">
            <StatCard
              icon={Building2}
              label="Total Venues"
              value={venues.length}
              colorClass="text-brand-600"
              bgClass="bg-brand-600/10"
              delay={0.1}
            />
            <StatCard
              icon={Calendar}
              label="Total Bookings"
              value={totalBookings}
              colorClass="text-violet-500"
              bgClass="bg-violet-500/10"
              delay={0.2}
            />
            <StatCard
              icon={IndianRupee}
              label="Total Revenue"
              value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
              colorClass="text-amber-500"
              bgClass="bg-amber-500/10"
              delay={0.3}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Booking"
              value={`₹${analytics?.avg_booking_value || 0}`}
              colorClass="text-sky-500"
              bgClass="bg-sky-500/10"
              delay={0.4}
            />
          </div>

          {/* Analytics — Revenue + Chart on Dashboard */}
          {analytics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-10"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">
                    Total Revenue
                  </div>
                  <div className="text-xl sm:text-2xl font-display font-black text-brand-600 mt-1">
                    {"\u20B9"}
                    {totalRevenue.toLocaleString()}
                  </div>
                </div>
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">
                    Confirmed
                  </div>
                  <div className="text-xl sm:text-2xl font-display font-black text-foreground mt-1">
                    {analytics.confirmed_bookings}
                  </div>
                </div>
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase">
                    Cancelled
                  </div>
                  <div className="text-xl sm:text-2xl font-display font-black text-destructive mt-1">
                    {analytics.cancelled_bookings}
                  </div>
                </div>
              </div>
              {analytics.daily_revenue?.length > 0 && (
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-6">
                  <h3 className="font-display admin-heading mb-4">
                    Revenue Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.daily_revenue}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(217.2, 32.6%, 17.5%)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 10 }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(222.2, 47.4%, 11.2%)",
                          border: "1px solid hsl(217.2, 32.6%, 17.5%)",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "hsl(210, 40%, 98%)" }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="hsl(160, 84%, 39.4%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Create Venue Dialog — shared across dashboard & manage views */}
      <ResponsiveDialog
        open={createVenueOpen}
        onOpenChange={(o) => {
          setCreateVenueOpen(o);
          if (!o) setBaseTurf(null);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Create New Venue</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-xs text-muted-foreground">
              Fill in the details below to list your venue on Lobbi.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <VenueForm
            mode="create"
            initialValues={venueForm}
            onSubmit={handleCreateVenue}
            isSubmitting={false}
            baseTurf={baseTurf}
            onBaseTurfChange={setBaseTurf}
            onCancel={() => setCreateVenueOpen(false)}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Venue selector + actions on manage view */}
      {isManageView && (
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md px-4 sm:px-6 py-3.5 sm:py-4">
            {/* Left: Venue selector dropdown + quick actions */}
            <div className="flex items-center gap-3">
              {venues.length > 0 && (
                <Select value={selectedVenue?.id || ""} onValueChange={val => { const v = venues.find(x => x.id === val); if (v) handleSelectVenue(v); }}>
                  <SelectTrigger className="h-11 sm:h-12 rounded-xl border-border/50 bg-background/60 px-4 min-w-[200px] sm:min-w-[260px] font-semibold text-sm sm:text-base">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[140px] overflow-y-auto">
                    {venues.map(v => (
                      <SelectItem key={v.id} value={v.id} className="text-sm sm:text-base font-medium py-2.5">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedVenue?.slug && (<>
                <div className="hidden sm:block h-7 w-px bg-border/50" />
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button onClick={() => openEditVenue()}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-border/40 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-brand-600 hover:border-brand-600/40 hover:bg-brand-600/5 transition-all active:scale-95"
                    title="Edit Venue">
                    <Pencil className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                  <button onClick={() => window.open(`/venue/${selectedVenue.slug}`, "_blank")}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-border/40 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-brand-600 hover:border-brand-600/40 hover:bg-brand-600/5 transition-all active:scale-95"
                    title="View Public Page">
                    <ExternalLink className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                  <button onClick={() => setShowVenueQR(true)}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-border/40 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-brand-600 hover:border-brand-600/40 hover:bg-brand-600/5 transition-all active:scale-95"
                    title="QR Code">
                    <QrCode className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              </>)}
            </div>
            {/* Right: Add Venue */}
            <Button
              onClick={() => setCreateVenueOpen(true)}
              className="bg-brand-600 text-white shadow-md shadow-brand-600/20 active:scale-[0.98] font-semibold h-11 sm:h-12 px-5 sm:px-6 shrink-0 rounded-xl text-sm sm:text-base"
              data-testid="create-venue-btn"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" /> Add Venue
            </Button>
          </div>
        </div>
      )}

      {isManageView && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          data-testid="owner-tabs"
        >
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 bg-background/95 backdrop-blur-md">
            <TabsList className="bg-transparent h-auto p-0 rounded-none space-x-3 sm:space-x-6 md:space-x-8 flex items-center w-full justify-start overflow-x-auto hide-scrollbar border-b border-border/40 pb-1 sm:pb-2">
              <TabsTrigger
                value="bookings"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-bookings"
              >
                Bookings
                <TabsIndicator />
              </TabsTrigger>
              <TabsTrigger
                value="slots"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-slots"
              >
                <CalendarDays className="h-3 w-3 mr-1" />
                Slots
                <TabsIndicator />
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-reviews"
              >
                <Star className="h-3 w-3 mr-1" />
                Reviews
                <TabsIndicator />
              </TabsTrigger>
              <TabsTrigger
                value="pricing"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-pricing"
              >
                Pricing
                <TabsIndicator />
              </TabsTrigger>
              <TabsTrigger
                value="checkin"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-checkin"
              >
                <QrCode className="h-3 w-3 mr-1" />
                Check-in
                <TabsIndicator />
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                className="relative data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none admin-btn uppercase tracking-wider text-muted-foreground py-2.5 sm:py-3 text-[10px] sm:text-xs shrink-0 min-h-[44px]"
                data-testid="tab-plan"
              >
                Plan
                <TabsIndicator />
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="mb-4 sm:mb-6" />

          {/* Bookings - Enhanced with filters, detail view, and timeline */}
          <TabsContent value="bookings">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
              {[
                { label: "Total",     value: bookingStats.total,     colorClass: "text-brand-600",  bgClass: "bg-brand-600/10",  icon: BarChart3 },
                { label: "Confirmed", value: bookingStats.confirmed,  colorClass: "text-brand-600",  bgClass: "bg-brand-600/10",  icon: CheckCircle },
                { label: "Pending",   value: bookingStats.pending,    colorClass: "text-amber-500",  bgClass: "bg-amber-500/10",  icon: Clock },
                { label: "Cancelled", value: bookingStats.cancelled,  colorClass: "text-red-500",    bgClass: "bg-red-500/10",    icon: XCircle },
                { label: "Upcoming",  value: bookingStats.upcoming,   colorClass: "text-brand-600",  bgClass: "bg-brand-600/10",  icon: Calendar },
              ].map((s, i) => (
                <StatCard
                  key={s.label}
                  icon={s.icon}
                  label={s.label}
                  value={s.value}
                  index={i}
                  colorClass={s.colorClass}
                  bgClass={s.bgClass}
                  data-testid={`booking-stat-${s.label.toLowerCase()}`}
                />
              ))}
            </div>

            {/* View Toggle + Filters row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="inline-flex bg-secondary/40 p-1 rounded-xl">
                {[
                  { key: "list", label: "List" },
                  { key: "timeline", label: "Timeline" },
                ].map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setBookingView(v.key)}
                    className={`px-5 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] active:scale-[0.97] ${bookingView === v.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm w-auto min-w-[130px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm w-auto min-w-[120px]">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>

              <button
                onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                  sortOrder === "asc"
                    ? "bg-brand-600/10 border-brand-600/30 text-brand-600"
                    : "bg-card border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
                }`}
                title={sortOrder === "desc" ? "Newest first" : "Oldest first"}
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>

            {/* ── List View ── */}
            {bookingView === "list" && (
              <>
              {/* Booking List */}
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-3" />
                  <p className="text-sm">{statusFilter !== "all" || timeFilter !== "all" ? "No bookings match your filters" : "No bookings yet"}</p>
                </div>
              ) : (
                <div className="-mx-3 sm:mx-0">
                  <p className="text-xs text-muted-foreground mb-2 px-3 sm:px-0">{bookingTotal} booking{bookingTotal !== 1 ? "s" : ""}</p>
                  <div className="divide-y divide-border/40 sm:divide-y-0 sm:space-y-2">
                  <AnimatePresence mode="popLayout">
                    {bookings.map((b, idx) => {
                      const sc = statusConfig[b.status] || statusConfig.pending;
                      const isPast = b.date < today;
                      return (
                        <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => openBookingDetail(b)}
                          className={`bg-card rounded-none sm:rounded-2xl sm:rounded-[28px] border-0 sm:border sm:border-border/40 sm:shadow-sm p-3 sm:p-4 cursor-pointer transition-all hover:border-brand-600/30 active:scale-[0.97] group ${isPast ? "opacity-70" : ""}`}
                          data-testid={`booking-row-${b.id}`}>
                          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="admin-name text-sm sm:text-base truncate">{b.host_name}</span>
                                {b.payment_mode === "split" && (
                                  <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">
                                    <Users className="h-2.5 w-2.5 mr-0.5" />Split
                                  </Badge>
                                )}
                              </div>
                              <span className="admin-secondary text-xs sm:text-sm">{b.venue_name} - Turf #{b.turf_number}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${sc.color}`}>{sc.label}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{b.date}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt12h(b.start_time)}-{fmt12h(b.end_time)}</span>
                              <span className="flex items-center gap-1 capitalize hidden sm:flex">{(() => { const SI = getSportIcon(b.sport); return <SI className="h-3 w-3" />; })()}{b.sport}</span>
                            </div>
                            <span className="font-semibold text-brand-600 text-sm sm:text-base">{"\u20B9"}{(b.total_amount - (b.commission_amount || 0)).toLocaleString()}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  </div>
                  {/* Pagination */}
                  {bookingTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 px-3 sm:px-2 gap-3">
                      <span className="admin-section-label text-[11px] sm:text-xs">
                        {(bookingPage - 1) * BOOKING_LIMIT + 1}–{Math.min(bookingPage * BOOKING_LIMIT, bookingTotal)} of {bookingTotal}
                      </span>
                      <div className="flex items-center gap-1">
                        <button disabled={bookingPage <= 1} onClick={() => loadBookings(bookingPage - 1)}
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: bookingTotalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === bookingTotalPages || Math.abs(p - bookingPage) <= 1)
                          .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((p, i) =>
                            p === "..." ? (
                              <span key={`dots-${i}`} className="px-1 text-muted-foreground/50 text-xs">...</span>
                            ) : (
                              <button key={p} onClick={() => loadBookings(p)}
                                className={`h-9 min-w-[36px] px-2 rounded-xl admin-btn transition-all ${
                                  p === bookingPage
                                    ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                }`}>
                                {p}
                              </button>
                            )
                          )}
                        <button disabled={bookingPage >= bookingTotalPages} onClick={() => loadBookings(bookingPage + 1)}
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
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
                      const totalAmount = dateBookings.reduce((sum, b) => sum + (b.status === "confirmed" ? (b.total_amount - (b.commission_amount || 0)) : 0), 0);
                      return (
                        <div key={date} data-testid={`history-date-${date}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isToday ? "bg-brand-600 animate-pulse" : isPast ? "bg-muted-foreground/40" : "bg-sky-400"}`} />
                              <span className="admin-name text-sm sm:text-base">
                                {isToday ? "Today" : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{dateBookings.length} booking{dateBookings.length > 1 ? "s" : ""}</Badge>
                            </div>
                            {totalAmount > 0 && (
                              <span className="font-semibold text-brand-600 text-sm sm:text-base">{"\u20B9"}{totalAmount.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="space-y-2 pl-4 border-l-2 border-border/50 ml-1">
                            {dateBookings.map(b => {
                              const sc = statusConfig[b.status] || statusConfig.pending;
                              return (
                                <motion.div key={b.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                                  onClick={() => openBookingDetail(b)}
                                  className={`bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-2.5 sm:p-3 cursor-pointer transition-all hover:border-brand-600/30 group ${isPast ? "opacity-70" : ""}`}
                                  data-testid={`history-booking-${b.id}`}>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="admin-name text-xs sm:text-sm">{fmt12h(b.start_time)}-{fmt12h(b.end_time)}</span>
                                        <span className="admin-secondary text-xs">Turf #{b.turf_number}</span>
                                        <span className="admin-secondary text-xs capitalize flex items-center gap-1">{(() => { const SI = getSportIcon(b.sport); return <SI className="h-3 w-3" />; })()}{b.sport}</span>
                                        {b.payment_mode === "split" && <Badge variant="outline" className="text-[10px] h-4 border-violet-500/30 text-violet-400">Split</Badge>}
                                      </div>
                                      <div className="admin-secondary text-xs sm:text-sm mt-0.5">{b.host_name} - {b.venue_name}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-semibold text-brand-600 text-sm sm:text-base">{"\u20B9"}{(b.total_amount - (b.commission_amount || 0)).toLocaleString()}</span>
                                      <span className={`inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${sc.color}`}>{sc.label}</span>
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-brand-600 transition-colors" />
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
        <ResponsiveDialog open={bookingDetailOpen} onOpenChange={setBookingDetailOpen}>
          <ResponsiveDialogContent className="sm:max-w-lg">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Booking Details</ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-xs text-muted-foreground">Booking ID: {selectedBooking?.id?.slice(0, 8)}...</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
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
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-3" data-testid="booking-detail-info">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Venue</span>
                      <p className="text-sm admin-name mt-0.5">{selectedBooking.venue_name}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Host</span>
                      <p className="text-sm admin-name mt-0.5">{selectedBooking.host_name}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Date</span>
                      <p className="text-sm admin-name mt-0.5">{selectedBooking.date}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Time</span>
                      <p className="text-sm admin-name mt-0.5">{fmt12h(selectedBooking.start_time)} - {fmt12h(selectedBooking.end_time)}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Turf</span>
                      <p className="text-sm admin-name mt-0.5">{selectedBooking.turf_name || `#${selectedBooking.turf_number}`}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Sport</span>
                      <p className="text-sm admin-name mt-0.5 capitalize flex items-center gap-1.5">{(() => { const SI = getSportIcon(selectedBooking.sport); return <SI className="h-3.5 w-3.5" />; })()}{selectedBooking.sport}</p>
                    </div>
                    {selectedBooking.num_players && (
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Lobbians</span>
                        <p className="text-sm admin-name mt-0.5">{selectedBooking.num_players}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-3" data-testid="booking-detail-payment">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-brand-600" />
                    <span className="admin-section-label">Payment</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Your Earnings</span>
                      <p className="text-lg font-display font-black text-brand-600 mt-0.5">{"\u20B9"}{(selectedBooking.total_amount - (selectedBooking.commission_amount || 0)).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Booking Amount</span>
                      <p className="text-sm admin-name mt-0.5">{"\u20B9"}{selectedBooking.total_amount?.toLocaleString()} <span className="text-[10px] text-muted-foreground">(-₹{selectedBooking.commission_amount || 0} commission)</span></p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Payment Mode</span>
                      <p className="text-sm admin-name mt-0.5 capitalize">{selectedBooking.payment_mode}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Gateway</span>
                      <p className="text-sm admin-name mt-0.5 capitalize">{selectedBooking.payment_gateway || "N/A"}</p>
                    </div>
                  </div>
                  {selectedBooking.payment_details && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Paid At</span>
                      <p className="text-xs text-foreground mt-0.5">{selectedBooking.payment_details.paid_at ? new Date(selectedBooking.payment_details.paid_at).toLocaleString() : "N/A"}</p>
                      {selectedBooking.payment_details.razorpay_payment_id && (
                        <>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground mt-2 block">Payment ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.razorpay_payment_id}</p>
                        </>
                      )}
                      {(selectedBooking.payment_details.test_payment_id || selectedBooking.payment_details.mock_payment_id) && (
                        <>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground mt-2 block">Test ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.test_payment_id || selectedBooking.payment_details.mock_payment_id}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Split Payment Info */}
                {selectedBooking.split_config && (
                  <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-3" data-testid="booking-detail-split">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-violet-400" />
                      <span className="admin-section-label">Split Payment</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Per Share</span>
                        <p className="text-sm admin-name mt-0.5">{"\u20B9"}{selectedBooking.split_config.per_share}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Total Shares</span>
                        <p className="text-sm admin-name mt-0.5">{selectedBooking.split_config.total_shares}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Paid</span>
                        <p className="text-sm admin-name mt-0.5">
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
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-2" data-testid="booking-detail-timestamps">
                  <div className="flex items-center gap-2 mb-1">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="admin-section-label">Timeline</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">{selectedBooking.created_at ? new Date(selectedBooking.created_at).toLocaleString() : "N/A"}</span>
                  </div>
                  {selectedBooking.status === "confirmed" && selectedBooking.paid_at ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Confirmed At</span>
                      <span className="text-foreground">{new Date(selectedBooking.paid_at).toLocaleString()}</span>
                    </div>
                  ) : selectedBooking.expires_at && ["pending", "payment_pending"].includes(selectedBooking.status) ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Expires</span>
                      <span className={`${new Date(selectedBooking.expires_at) < new Date() ? "text-destructive" : "text-foreground"}`}>
                        {new Date(selectedBooking.expires_at).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Refund Breakdown (cancelled bookings) */}
                {selectedBooking.status === "cancelled" && selectedBooking.refund_pct > 0 && (
                  <div className="bg-red-500/5 rounded-2xl sm:rounded-[28px] border border-red-500/20 p-3 sm:p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCcw className="h-4 w-4 text-red-500" />
                      <span className="admin-section-label text-red-500">Refund Breakdown</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Refund Tier</span>
                        <p className="text-sm font-bold text-red-500 mt-0.5">{selectedBooking.refund_pct}%</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Refund Status</span>
                        <p className="text-sm admin-name mt-0.5 capitalize">{selectedBooking.refund_status || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Player Refund</span>
                        <p className="text-sm admin-name mt-0.5">{"\u20B9"}{(selectedBooking.refund_amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Your Deduction</span>
                        <p className="text-sm font-bold text-red-500 mt-0.5">-{"\u20B9"}{(selectedBooking.refund_amount - Math.round((selectedBooking.commission_amount || 0) * selectedBooking.refund_pct / 100)).toLocaleString()}</p>
                      </div>
                    </div>
                    {selectedBooking.cancelled_at && (
                      <div className="pt-2 border-t border-red-500/10 text-xs text-muted-foreground">
                        Cancelled at {new Date(selectedBooking.cancelled_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {["confirmed", "pending", "payment_pending"].includes(selectedBooking.status) && (
                  <Button variant="destructive" className="w-full text-xs admin-btn rounded-xl"
                    onClick={() => handleCancelBooking(selectedBooking.id)} data-testid="cancel-booking-btn">
                    Cancel Booking
                  </Button>
                )}
              </div>
            )}
          </ResponsiveDialogContent>
        </ResponsiveDialog>


        {/* Slots Tab - Visual slot availability grid */}
        <TabsContent value="slots">
          {selectedVenue && <SlotAvailabilityPanel venueId={selectedVenue.id} onOpenBooking={openBookingDetail} refreshKey={slotRefreshKey} />}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <div className="space-y-4" data-testid="owner-reviews-tab">
            <div>
              <h3 className="font-display admin-heading text-base sm:text-lg">
                Customer Reviews {selectedVenue && <span className="text-muted-foreground font-normal text-sm">- {selectedVenue.name}</span>}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">See what Lobbians say about your venue</p>
            </div>

              {venueReviews.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm">
                    No reviews yet for {selectedVenue?.name || "this venue"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(() => {
                      const avg =
                        venueReviews.length > 0
                          ? venueReviews.reduce(
                              (s, r) => s + (r.rating || 0),
                              0,
                            ) / venueReviews.length
                          : 0;
                      const r5 = venueReviews.filter(
                        (r) => r.rating === 5,
                      ).length;
                      return (
                        <>
                          <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-2.5 sm:p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-600 fill-brand-600" />
                              <span className="font-display font-black text-lg sm:text-xl text-brand-600">
                                {avg.toFixed(1)}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              Avg Rating
                            </div>
                          </div>
                          <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-2.5 sm:p-3 text-center">
                            <div className="font-display font-black text-lg sm:text-xl text-foreground">
                              {venueReviews.length}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              Total
                            </div>
                          </div>
                          <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-2.5 sm:p-3 text-center">
                            <div className="font-display font-black text-lg sm:text-xl text-brand-400">
                              {r5}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              5-Star
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Review Cards */}
                  <div className="-mx-3 sm:mx-0 divide-y divide-border/40 sm:divide-y-0 sm:space-y-2">
                    {venueReviews.map((r) => (
                      <div
                        key={r.id}
                        className="bg-card rounded-none sm:rounded-2xl sm:rounded-[28px] border-0 sm:border sm:border-border/40 sm:shadow-sm p-3 sm:p-4 active:scale-[0.97] transition-transform"
                        data-testid={`owner-review-${r.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center text-xs font-bold text-brand-600">
                              {r.user_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <span className="admin-name text-sm">
                                {r.user_name}
                              </span>
                              <div className="flex gap-0.5 mt-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`h-3 w-3 ${s <= r.rating ? "text-brand-600 fill-brand-600" : "text-muted-foreground/40"}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(r.created_at).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {r.comment}
                          </p>
                        )}
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
          <div className="inline-flex bg-secondary/40 p-1 rounded-xl mb-4">
            {[{ key: "rules", label: "Rules" }, { key: "analytics", label: "Analytics" }].map(v => (
              <button key={v.key} onClick={() => setPricingView(v.key)}
                className={`flex-1 px-5 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] active:scale-[0.97] ${pricingView === v.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {pricingView === "rules" && (
          <>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="min-w-0">
              <h3 className="font-display admin-heading text-base sm:text-lg truncate">
                Pricing Rules {selectedVenue && <span className="text-muted-foreground font-normal text-sm">- {selectedVenue.name}</span>}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Base price: <span className="text-brand-600 font-bold">{"\u20B9"}{basePrice}/hr</span></p>
            </div>
            <Button size="sm" onClick={openCreateRule} className="bg-brand-600 hover:bg-brand-500 text-white admin-btn text-xs h-8 shrink-0 rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" data-testid="create-rule-btn">
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
            <div className="-mx-3 sm:mx-0 divide-y divide-border/40 sm:divide-y-0 sm:space-y-3">
              {pricingRules.map(r => {
                const effectivePrice = previewPrice(r);
                const diff = effectivePrice - basePrice;
                const isDiscount = r.rule_type === "discount" || (!r.rule_type && r.action?.type === "discount");
                const schedType = r.schedule_type || "recurring";
                const valLabel = r.rule_type
                  ? `${r.value}%`
                  : (r.action?.type === "multiplier" ? `${r.action.value}x` : `-${Math.round((r.action?.value||0)*100)}%`);
                const scheduleLabel = schedType === "one_time"
                  ? `${r.date_from || "?"} → ${r.date_to || "?"}, ${fmt12h(r.time_from)||""}–${fmt12h(r.time_to)||""}`
                  : `${r.conditions?.days?.length > 0 ? r.conditions.days.map(d => DAY_LABELS[d]).join(", ") : "Every day"}${r.conditions?.time_range ? `, ${fmt12h(r.conditions.time_range.start)}–${fmt12h(r.conditions.time_range.end)}` : ""}`;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={`bg-card rounded-none sm:rounded-2xl sm:rounded-[28px] border-0 sm:border sm:border-border/40 sm:shadow-sm p-3 sm:p-4 border-l-4 active:scale-[0.97] transition-transform ${r.is_active ? (isDiscount ? "border-l-brand-500" : "border-l-amber-500") : "border-l-muted-foreground/30 opacity-60"}`}
                    data-testid={`rule-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="admin-name text-sm text-foreground">{r.name}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${isDiscount ? "bg-brand-500/15 text-brand-600 border-brand-500/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"}`}>
                            {isDiscount ? <><Tag className="h-3 w-3" /> Offer</> : <><Zap className="h-3 w-3" /> Peak</>} {valLabel} {isDiscount ? "off" : "extra"}
                          </span>
                          {schedType === "one_time" && <span className="inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide bg-purple-500/15 text-purple-600 border-purple-500/30">One-time</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />{scheduleLabel}
                        </p>
                        {r.is_active && (
                          <p className="text-xs mt-1.5">
                            <span className="text-muted-foreground">e.g. ₹{basePrice} → </span>
                            <span className={`font-bold ${isDiscount ? "text-brand-400" : "text-amber-400"}`}>₹{effectivePrice}</span>
                            <span className={`ml-1 text-[10px] ${isDiscount ? "text-brand-400" : "text-amber-400"}`}>({diff > 0 ? "+" : ""}₹{diff})</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={r.is_active !== false} onCheckedChange={() => handleToggleRule(r.id)} data-testid={`toggle-rule-${r.id}`} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditRule(r)} data-testid={`edit-rule-${r.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setDeleteTarget({ id: r.id, type: "pricing_rule", name: r.name || "pricing rule" })} data-testid={`delete-rule-${r.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rule Create/Edit Dialog — redesigned */}
          <ResponsiveDialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <ResponsiveDialogContent className="sm:max-w-md">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>{editingRule ? "Edit" : "Create"} Pricing Rule</ResponsiveDialogTitle>
              </ResponsiveDialogHeader>
              <div className="space-y-5">

                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Rule Name</Label>
                  <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Diwali Offer / Friday Peak" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" data-testid="rule-name-input" />
                </div>

                {/* Rule Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ key: "discount", label: "Offer / Discount", desc: "Reduce price", Icon: Tag }, { key: "surge", label: "Peak / Surge", desc: "Increase price", Icon: Zap }].map(t => (
                      <button key={t.key} onClick={() => setRuleForm(p => ({ ...p, rule_type: t.key }))}
                        className={`p-3 rounded-xl border text-left transition-all ${ruleForm.rule_type === t.key ? "border-brand-600 bg-brand-600/10" : "border-border bg-secondary/30 hover:border-brand-600/40"}`}>
                        <p className="text-xs admin-label flex items-center gap-1"><t.Icon className="h-3.5 w-3.5" />{t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    {ruleForm.rule_type === "discount" ? "Discount" : "Surge"} %
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input type="number" min="0" max="100" value={ruleForm.value}
                      onChange={e => setRuleForm(p => ({ ...p, value: Number(e.target.value) }))}
                      className="h-11 rounded-xl bg-secondary/20 border-border/40 flex-1" data-testid="rule-value-input" />
                    <span className="text-lg font-semibold text-muted-foreground shrink-0">%</span>
                  </div>
                </div>

                {/* Schedule Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Schedule</Label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[{ key: "recurring", label: "🔁 Recurring", desc: "Repeats every week" }, { key: "one_time", label: "📅 One-time", desc: "Specific dates only" }].map(s => (
                      <button key={s.key} onClick={() => setRuleForm(p => ({ ...p, schedule_type: s.key }))}
                        className={`p-3 rounded-xl border text-left transition-all ${ruleForm.schedule_type === s.key ? "border-brand-600 bg-brand-600/10" : "border-border bg-secondary/30 hover:border-brand-600/40"}`}>
                        <p className="text-xs admin-label">{s.label}</p>
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
                              className={`h-9 w-9 rounded-lg text-xs admin-btn transition-all ${(ruleForm.conditions.days||[]).includes(i) ? "bg-brand-600 text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
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
                            <select value={ruleForm.conditions.time_range?.start || "18:00"}
                              onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, start: e.target.value } } }))}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                              {Array.from({ length: 24 }, (_, i) => { const h24 = String(i).padStart(2, "0") + ":00"; const h12 = i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`; return <option key={h24} value={h24}>{h12}</option>; })}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">To</p>
                            <select value={ruleForm.conditions.time_range?.end || "22:00"}
                              onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, end: e.target.value } } }))}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                              {Array.from({ length: 24 }, (_, i) => { const h24 = String(i).padStart(2, "0") + ":00"; const h12 = i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`; return <option key={h24} value={h24}>{h12}</option>; })}
                            </select>
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
                          <select value={ruleForm.time_from || "18:00"}
                            onChange={e => setRuleForm(p => ({ ...p, time_from: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                            {Array.from({ length: 24 }, (_, i) => { const h24 = String(i).padStart(2, "0") + ":00"; const h12 = i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`; return <option key={h24} value={h24}>{h12}</option>; })}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">To Time</p>
                          <select value={ruleForm.time_to || "22:00"}
                            onChange={e => setRuleForm(p => ({ ...p, time_to: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                            {Array.from({ length: 24 }, (_, i) => { const h24 = String(i).padStart(2, "0") + ":00"; const h12 = i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`; return <option key={h24} value={h24}>{h12}</option>; })}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Preview */}
                <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3" data-testid="rule-preview">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Price Preview</p>
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
                </div>

                <Button className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleSaveRule} data-testid="submit-rule-btn">
                  {editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
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
              <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-5" data-testid="current-plan-card">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="h-5 w-5 text-brand-600 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-display text-sm sm:text-base admin-heading truncate">Current Plan: <span className="text-brand-600">{planData.current_plan?.name}</span></h3>
                    <p className="text-xs text-muted-foreground">{planData.venues_used} / {planData.venues_limit} venues used</p>
                  </div>
                </div>
                <div className="w-full bg-secondary/50 rounded-full h-2 mb-2">
                  <div className="bg-brand-600 rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (planData.venues_used / planData.venues_limit) * 100)}%` }} />
                </div>
              </div>

              <h3 className="font-display text-sm admin-heading">Available Plans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(planData.all_plans || []).map(plan => {
                  const isCurrent = plan.id === planData.current_plan?.id;
                  return (
                    <div key={plan.id} className={`bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-5 border-2 transition-all ${isCurrent ? "border-brand-600" : "border-transparent hover:border-brand-600/30"}`}
                      data-testid={`plan-card-${plan.id}`}>
                      <div className="text-sm admin-name mb-1">{plan.name}</div>
                      <div className="text-xl sm:text-2xl font-display font-black text-brand-600 mb-3">
                        {!plan.price ? "Free" : `\u20B9${Number(plan.price).toLocaleString()}`}
                        {plan.price > 0 && <span className="text-xs text-muted-foreground font-normal">/mo</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">Up to {plan.max_venues} venue{plan.max_venues > 1 ? "s" : ""}</div>
                      <ul className="space-y-1 mb-4">
                        {(plan.features || []).map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 text-brand-600 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Badge className="w-full justify-center bg-brand-600/20 text-brand-600 text-xs py-1">Current Plan</Badge>
                      ) : (
                        <Button size="sm" className="w-full text-xs admin-btn rounded-xl" disabled={upgrading}
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
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
          )}
        </TabsContent>

        <TabsContent value="checkin" data-testid="checkin-tab-content">
          <VenueCheckinPanel
            bookings={bookings.filter(b => b.venue_id === selectedVenue?.id)}
            venueName={selectedVenue?.name}
            onCheckinSuccess={loadData}
          />
        </TabsContent>

        {/* ML Pricing Tab */}

      </Tabs>
      )}

      {/* Edit Venue Dialog */}
      <ResponsiveDialog open={editVenueOpen} onOpenChange={setEditVenueOpen}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Edit Venue Details</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-xs text-muted-foreground pt-1">
              Changes will be pushed{" "}
              <span className="text-brand-600 font-semibold">live</span> to all
              viewers of the public page instantly.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <VenueForm
            mode="edit"
            initialValues={editVenueForm}
            onSubmit={handleSaveVenue}
            isSubmitting={savingVenue}
            baseTurf={editBaseTurf}
            onBaseTurfChange={setEditBaseTurf}
            onCancel={() => setEditVenueOpen(false)}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Venue QR Code Dialog */}
      <ResponsiveDialog open={showVenueQR} onOpenChange={setShowVenueQR}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Venue QR Code</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {selectedVenue?.slug && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-card rounded-xl shadow-inner">
                <QRCodeSVG
                  value={`${window.location.origin}/venue/${selectedVenue.slug}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className="font-semibold">{selectedVenue.name}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  /venue/{selectedVenue.slug}
                </p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Share this QR code with your customers so they can quickly
                access your venue's public page.
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
                <Button
                  className="flex-1"
                  onClick={() => setShowVenueQR(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete Pricing Rule Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (deleteTarget) handleDeleteRule(deleteTarget.id);
              setDeleteTarget(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    if (type === "peak")
      return <TrendingUp className="h-4 w-4 text-brand-400 shrink-0" />;
    if (type === "low")
      return <TrendingDown className="h-4 w-4 text-blue-400 shrink-0" />;
    if (type === "loyalty")
      return <Users className="h-4 w-4 text-amber-400 shrink-0" />;
    if (type === "warning")
      return <Zap className="h-4 w-4 text-destructive shrink-0" />;
    return <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const insightBg = (type) => {
    if (type === "peak") return "bg-brand-500/10 border-brand-500/20";
    if (type === "low") return "bg-blue-500/10 border-blue-500/20";
    if (type === "loyalty") return "bg-amber-500/10 border-amber-500/20";
    if (type === "warning") return "bg-destructive/10 border-destructive/20";
    return "bg-secondary/50 border-border";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
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

  const activeHeatmap =
    selectedTurf === "all"
      ? insights.heatmap
      : insights.heatmap_by_turf?.[selectedTurf] || [];

  // Aggregate totals per day and per hour
  const dayTotals = Array(7).fill(0);
  const hourTotalsMap = {};
  activeHeatmap.forEach((h) => {
    dayTotals[h.dow] = (dayTotals[h.dow] || 0) + h.count;
    hourTotalsMap[h.hour] = (hourTotalsMap[h.hour] || 0) + h.count;
  });
  const maxDay = Math.max(...dayTotals, 1);
  const activeHourEntries = Object.entries(hourTotalsMap)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // top 6 busiest hours
  const maxHour =
    activeHourEntries.length > 0
      ? Math.max(...activeHourEntries.map((e) => e.count), 1)
      : 1;

  const periodLabel = period === 0 ? "all time" : `last ${period} days`;
  const totalBookings = insights.confirmed_count ?? 0;

  return (
    <div className="space-y-4" data-testid="analytics-panel">
      {/* Header: summary + period pills */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-bold text-base">
            {totalBookings}
          </span>{" "}
          bookings in the {periodLabel}
        </p>
        <div className="inline-flex bg-secondary/40 p-1 rounded-xl">
          {[
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
            { label: "180d", days: 180 },
            { label: "All", days: 0 },
          ].map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] active:scale-[0.97] ${period === p.days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
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
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              {s.icon}
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {s.label}
              </p>
            </div>
            <p className="font-display font-black text-xl sm:text-2xl text-foreground leading-none">
              {s.value}
            </p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Busiest Days */}
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display admin-heading text-sm">📅 Busiest Days</h3>
            {insights.turf_list?.length > 1 && (
              <select
                value={selectedTurf}
                onChange={(e) => setSelectedTurf(e.target.value)}
                className="text-[10px] bg-secondary/50 border border-border rounded px-2 py-0.5 text-foreground"
              >
                <option value="all">All Turfs</option>
                {insights.turf_list.map((t) => (
                  <option key={t.turf_number} value={String(t.turf_number)}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {dayTotals.every((v) => v === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No bookings yet.
            </p>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, dow) => {
                const count = dayTotals[dow];
                const pct = Math.round((count / maxDay) * 100);
                return (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-7 shrink-0">
                      {day}
                    </span>
                    <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500/70 flex items-center justify-end pr-2 transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                        }}
                      >
                        {count > 0 && (
                          <span className="text-[10px] font-bold text-white">
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Busiest Hours */}
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-3 sm:p-4 space-y-3">
          <h3 className="font-display admin-heading text-sm">⏰ Busiest Hours</h3>
          {activeHourEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No bookings yet.
            </p>
          ) : (
            <div className="space-y-2">
              {activeHourEntries.map(({ hour, count }) => {
                const pct = Math.round((count / maxHour) * 100);
                const ampm = hour < 12 ? "AM" : "PM";
                const h12 = hour % 12 === 0 ? 12 : hour % 12;
                const label = `${h12} ${ampm}`;
                return (
                  <div key={hour} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">
                      {label}
                    </span>
                    <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/70 flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">
                          {count}
                        </span>
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
          <h3 className="font-display admin-heading text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Insights
          </h3>
          {insights.insights.map((ins, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 border flex items-start gap-3 ${insightBg(ins.type)}`}
            >
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
function SlotAvailabilityPanel({ venueId, onOpenBooking, refreshKey }) {
  const [slotDate, setSlotDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBookingSlot, setLoadingBookingSlot] = useState(null);

  const handleBookedSlotClick = async (slot) => {
    if (!onOpenBooking || slot.status !== "booked") return;
    const key = `${slot.start_time}-${slot.turf_number}`;
    setLoadingBookingSlot(key);
    try {
      const res = await bookingAPI.list({
        venue_id: venueId,
        date: slotDate,
        turf_number: slot.turf_number,
        status: "confirmed",
        limit: 20,
        page: 1,
      });
      // Find the booking whose time range covers this slot
      const clickedTime = slot.start_time;
      const booking = (res.data?.bookings || []).find(b =>
        b.start_time <= clickedTime && b.end_time > clickedTime
      );
      if (booking) {
        onOpenBooking(booking);
      } else {
        toast.info("Booking details not found for this slot");
      }
    } catch {
      toast.error("Failed to load booking details");
    } finally {
      setLoadingBookingSlot(null);
    }
  };

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
  }, [venueId, slotDate, refreshKey]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const turfs = useMemo(() => {
    const map = new Map();
    slots.forEach((s) => {
      if (!map.has(s.turf_number)) {
        map.set(s.turf_number, {
          turf_number: s.turf_number,
          turf_name: s.turf_name || `Turf #${s.turf_number}`,
          sport: s.sport,
        });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => a.turf_number - b.turf_number,
    );
  }, [slots]);

  const timeSlots = useMemo(() => {
    const seen = new Set();
    return slots
      .filter((s) => {
        if (seen.has(s.start_time)) return false;
        seen.add(s.start_time);
        return true;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => ({ start_time: s.start_time, end_time: s.end_time }));
  }, [slots]);

  const slotMap = useMemo(() => {
    const map = {};
    slots.forEach((s) => {
      map[`${s.start_time}-${s.turf_number}`] = s;
    });
    return map;
  }, [slots]);

  const stats = useMemo(() => {
    const total = slots.length;
    const available = slots.filter((s) => s.status === "available").length;
    const booked = slots.filter((s) => s.status === "booked").length;
    const held = slots.filter(
      (s) => s.status === "on_hold" || s.status === "locked_by_you",
    ).length;
    return { total, available, booked, held };
  }, [slots]);

  const shiftDate = (days) => {
    const d = new Date(slotDate);
    d.setDate(d.getDate() + days);
    setSlotDate(d.toISOString().split("T")[0]);
  };

  // fmt12h imported from @/lib/utils

  const statusStyles = {
    available: "bg-emerald-500/15 text-emerald-500",
    booked: "bg-red-500/15 text-red-500",
    on_hold: "bg-amber-500/15 text-amber-500",
    locked_by_you: "bg-amber-500/15 text-amber-500",
  };
  const statusLabels = {
    available: "Open",
    booked: "Booked",
    on_hold: "Held",
    locked_by_you: "Held",
  };

  const today = new Date().toISOString().split("T")[0];
  const isToday = slotDate === today;
  const displayDate = new Date(slotDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const availPct = stats.total ? Math.round((stats.available / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header + Date Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-display admin-heading text-base sm:text-lg">Slot Availability</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time turf availability for any date</p>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={() => setSlotDate(today)}
              className="h-9 px-3 text-xs font-semibold rounded-xl border border-brand-600/40 text-brand-600 bg-brand-600/5 hover:bg-brand-600/10 transition-colors"
            >
              Today
            </button>
          )}
          <div className="flex items-center bg-secondary/40 border border-border/50 rounded-xl overflow-hidden">
            <button
              onClick={() => shiftDate(-1)}
              className="h-10 w-9 flex items-center justify-center hover:bg-secondary transition-colors border-r border-border/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              className="w-36 h-10 rounded-none border-0 bg-transparent text-xs text-center font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              onClick={() => shiftDate(1)}
              className="h-10 w-9 flex items-center justify-center hover:bg-secondary transition-colors border-l border-border/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {slots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total",     value: stats.total,         icon: CalendarDays, colorClass: "text-brand-600",   bgClass: "bg-brand-600/10"   },
            { label: "Available", value: stats.available,     icon: CheckCircle,  colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
            { label: "Booked",    value: stats.booked,        icon: Clock,        colorClass: "text-red-500",     bgClass: "bg-red-500/10"     },
            { label: "Free",      value: `${availPct}%`,      icon: BarChart2,    colorClass: "text-brand-600",   bgClass: "bg-brand-600/10"   },
          ].map((s, i) => (
            <StatCard
              key={s.label}
              icon={s.icon}
              label={s.label}
              value={s.value}
              index={i}
              colorClass={s.colorClass}
              bgClass={s.bgClass}
            />
          ))}
        </div>
      )}

      {/* Grid */}
      {loadingSlots ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <span className="text-sm text-muted-foreground">Loading slots…</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border/50 rounded-2xl">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">No slots for this date</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Try selecting a different date</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm">
          {/* Date label bar */}
          <div className="bg-secondary/40 px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground/70">{displayDate}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Open</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Held</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div
              className="inline-grid min-w-full"
              style={{
                gridTemplateColumns: `88px repeat(${turfs.length}, minmax(120px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="sticky left-0 z-10 bg-secondary/70 backdrop-blur-sm px-3 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-r border-border/50">
                Time
              </div>
              {turfs.map((t) => (
                <div
                  key={t.turf_number}
                  className="bg-secondary/70 backdrop-blur-sm px-3 py-3 text-center border-b border-r border-border/50 last:border-r-0"
                >
                  <p className="text-sm font-bold text-foreground truncate">{t.turf_name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5 flex items-center gap-1">{(() => { const SI = getSportIcon(t.sport); return <SI className="h-3 w-3" />; })()}{t.sport}</p>
                </div>
              ))}

              {/* Data rows */}
              {timeSlots.map((time, rowIdx) => (
                <>
                  <div
                    key={time.start_time}
                    className={`sticky left-0 z-10 px-3 py-3 border-b border-r border-border/40 flex flex-col justify-center ${rowIdx % 2 === 0 ? "bg-card" : "bg-secondary/10"}`}
                  >
                    <span className="text-sm font-semibold text-foreground/80 font-mono leading-none">
                      {fmt12h(time.start_time).replace(/ (AM|PM)$/, "")}
                    </span>
                    <span className="text-xs text-muted-foreground/60 font-mono mt-0.5">
                      {fmt12h(time.start_time).match(/(AM|PM)$/)?.[0]}
                    </span>
                  </div>
                  {turfs.map((turf) => {
                    const slot = slotMap[`${time.start_time}-${turf.turf_number}`];
                    const status = slot?.status || "available";
                    const cellBg = {
                      available: rowIdx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                      booked: "bg-red-500/5",
                      on_hold: "bg-amber-500/5",
                      locked_by_you: "bg-amber-500/5",
                    }[status] || (rowIdx % 2 === 0 ? "bg-card" : "bg-secondary/10");
                    const badgeStyle = {
                      available: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      booked: "bg-red-500/15 text-red-600 dark:text-red-400",
                      on_hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      locked_by_you: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    }[status] || "bg-emerald-500/15 text-emerald-600";
                    const isBookedSlot = status === "booked";
                    const slotKey = `${time.start_time}-${turf.turf_number}`;
                    return (
                      <div
                        key={slotKey}
                        onClick={isBookedSlot ? () => handleBookedSlotClick({ ...slot, start_time: time.start_time, turf_number: turf.turf_number }) : undefined}
                        className={`relative group px-2 py-3 border-b border-r border-border/40 last:border-r-0 flex flex-col items-center justify-center gap-1 ${cellBg} ${isBookedSlot ? "cursor-pointer hover:bg-red-500/10 transition-colors" : ""}`}
                      >
                        {loadingBookingSlot === slotKey && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-20 rounded">
                            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                          </div>
                        )}
                        {/* Instant custom tooltip */}
                        <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-300 group-hover:delay-300 whitespace-nowrap ${rowIdx === 0 ? "top-full mt-2" : "bottom-full mb-2"}`}>
                          <div className="bg-gray-900 text-white text-xs font-medium rounded-lg px-3 py-2 shadow-xl flex flex-col gap-0.5">
                            <span className="font-semibold text-white">{turf.turf_name}</span>
                            <span className="text-white/60">{fmt12h(slot?.booking_start || time.start_time)} – {fmt12h(slot?.booking_end || time.end_time)}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${badgeStyle}`}>{statusLabels[status] || status}</span>
                              {slot?.price != null && <span className="text-white/70 font-mono">₹{slot.price}</span>}
                            </div>
                          </div>
                          <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${rowIdx === 0 ? "bottom-full border-b-gray-900" : "top-full border-t-gray-900"}`} />
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeStyle}`}>
                          {statusLabels[status] || status}
                        </span>
                        {slot?.price != null && (
                          <span className="text-xs text-muted-foreground/70 font-mono">
                            ₹{slot.price}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
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
  const [dragOver, setDragOver] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter(
    (b) => b.date === today && b.status === "confirmed",
  );
  const checkedIn = todayBookings.filter((b) => b.checked_in);
  const notCheckedIn = todayBookings.filter((b) => !b.checked_in);

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
      setResult({
        error: true,
        message: err.response?.data?.detail || "Verification failed",
      });
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
          (decodedText) => {
            handleVerify(decodedText);
          },
          () => {},
        );
      } catch (err) {
        setCameraError(
          err?.toString?.().includes("NotAllowed")
            ? "Camera permission denied. Please allow camera access."
            : err?.toString?.().includes("NotFound")
              ? "No camera found on this device."
              : "Could not start camera. Try manual entry.",
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
    } catch {
      /* ignore */
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="inline-flex bg-secondary/40 p-1 rounded-xl overflow-x-auto hide-scrollbar">
        <button
          onClick={() => {
            setScanMode("camera");
            stopCamera();
          }}
          className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all min-h-[44px] shrink-0 active:scale-[0.97] ${scanMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Camera</span> Scan
        </button>
        <button
          onClick={() => {
            setScanMode("upload");
            stopCamera();
          }}
          className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all min-h-[44px] shrink-0 active:scale-[0.97] ${scanMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload</span> QR
        </button>
        <button
          onClick={() => {
            setScanMode("attendance");
            stopCamera();
          }}
          className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all min-h-[44px] shrink-0 active:scale-[0.97] ${scanMode === "attendance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Attendance
          {todayBookings.length > 0 && (
            <span className="ml-0.5 h-4 min-w-[16px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
              {checkedIn.length}/{todayBookings.length}
            </span>
          )}
        </button>
      </div>

      {/* Camera */}
      {scanMode === "camera" && (
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
              <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
            </div>
            <div>
              <h3 className="font-display admin-heading text-sm sm:text-base">
                Scan Lobbian's QR Code
              </h3>
              <p className="text-xs text-muted-foreground">
                Point your camera at the Lobbian's phone to verify check-in at{" "}
                {venueName || "this venue"}.
              </p>
            </div>
          </div>

          {!cameraActive ? (
            <div className="text-center">
              <div className="w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 flex flex-col items-center justify-center mb-4 border border-dashed border-border">
                <Camera className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Camera preview will appear here
                </p>
                {cameraError && (
                  <p className="text-xs text-destructive mt-2 px-4">
                    {cameraError}
                  </p>
                )}
              </div>
              <Button
                className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                onClick={startCamera}
              >
                <Camera className="h-4 w-4 mr-2" /> Start Camera Scanner
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div
                id="venue-qr-reader"
                ref={scannerRef}
                className="w-full max-w-sm mx-auto rounded-xl overflow-hidden mb-4"
              />
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-xs text-muted-foreground admin-label">
                  Scanning... point at QR code
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="text-xs"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Stop Camera
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload QR Image */}
      {scanMode === "upload" && (
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
            </div>
            <div>
              <h3 className="font-display admin-heading text-sm sm:text-base">
                Upload QR Image
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload a screenshot or photo of the Lobbian's QR code.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <label
              className={`flex flex-col items-center justify-center w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 border-2 border-dashed cursor-pointer transition-all ${dragOver ? "border-brand-600 bg-brand-600/10 scale-[1.02]" : "border-border hover:border-brand-600/40 hover:bg-brand-600/5"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
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
              }}
            >
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm admin-label text-muted-foreground">{dragOver ? "Drop QR image here" : "Click or drag & drop QR image"}</span>
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
        <div className="bg-card rounded-2xl sm:rounded-[28px] border border-border/40 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-brand-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display admin-heading text-xs sm:text-sm truncate">
                  Today's Attendance — {venueName}
                </h3>
                <p className="text-[10px] text-muted-foreground">{today}</p>
              </div>
            </div>
            {todayBookings.length > 0 && (
              <div className="text-right">
                <div className="font-display font-black text-xl text-brand-600">
                  {checkedIn.length}/{todayBookings.length}
                </div>
                <div className="text-[10px] text-muted-foreground admin-label">
                  Checked In
                </div>
              </div>
            )}
          </div>

          {todayBookings.length > 0 && (
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-brand-600 rounded-full transition-all duration-500"
                style={{
                  width: `${(checkedIn.length / todayBookings.length) * 100}%`,
                }}
              />
            </div>
          )}

          {todayBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">No confirmed bookings for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notCheckedIn.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/50 active:scale-[0.97] transition-transform"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <UserX className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="admin-name text-sm truncate">
                        {b.host_name || b.booked_by_name || "Lobbian"}
                      </span>
                      {b.sport && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize shrink-0"
                        >
                          {b.sport}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmt12h(b.start_time)} - {fmt12h(b.end_time)} · Turf #{b.turf_number || 1}
                    </div>
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">
                    Pending
                  </Badge>
                </div>
              ))}
              {checkedIn.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20 active:scale-[0.97] transition-transform"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                    <UserCheck className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="admin-name text-sm truncate">
                        {b.host_name || b.booked_by_name || "Lobbian"}
                      </span>
                      {b.sport && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize shrink-0"
                        >
                          {b.sport}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmt12h(b.start_time)} - {fmt12h(b.end_time)} · Turf #{b.turf_number || 1}
                      {b.checkin_time && (
                        <span className="ml-2 text-brand-400">
                          at{" "}
                          {new Date(b.checkin_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
        <div
          className={`rounded-xl border-2 p-4 sm:p-6 text-center ${
            result.error
              ? "border-destructive/50 bg-destructive/5"
              : result.already_checked_in
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-brand-500/50 bg-brand-500/5"
          }`}
        >
          {result.error ? (
            <>
              <XCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-destructive" />
              <p className="font-display admin-heading text-base sm:text-lg text-destructive">
                Verification Failed
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.message}
              </p>
            </>
          ) : result.already_checked_in ? (
            <>
              <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-amber-400" />
              <p className="font-display admin-heading text-base sm:text-lg text-amber-400">
                Already Checked In
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.player_name} has already checked in.
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-brand-400" />
              <p className="font-display admin-heading text-base sm:text-lg text-brand-400">
                Check-in Successful!
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="admin-name text-foreground">
                  {result.player_name}
                </span>{" "}
                is checked in
              </p>
              {result.booking && (
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{result.booking.date}</span>
                  <span>{fmt12h(result.booking.start_time)} - {fmt12h(result.booking.end_time)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
