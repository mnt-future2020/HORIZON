import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI, bookingAPI, analyticsAPI, subscriptionAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, IndianRupee, TrendingUp, Calendar, Plus, Trash2, BarChart3, Clock, ShieldAlert, Crown, CheckCircle, Pencil, Power, Users, CreditCard, X, ChevronRight, Filter, History, CalendarDays, CircleDot, AlertCircle, ArrowUpDown, Star, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card rounded-lg p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      <div className={`p-2 sm:p-2.5 rounded-lg ${color}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
      <div className="min-w-0">
        <div className="text-xl sm:text-2xl font-display font-black text-foreground truncate">{value}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-widest mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function VenueOwnerDashboard() {
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

  return <VenueOwnerDashboardContent />;
}

function VenueOwnerDashboardContent() {
  const { user } = useAuth();
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
  const [venueForm, setVenueForm] = useState({
    name: "", description: "", sports: ["football"], address: "", city: "Bengaluru",
    base_price: 2000, slot_duration_minutes: 60, opening_hour: 6, closing_hour: 23, turfs: 1,
    amenities: [], images: [],
  });
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
      setVenues(vRes.data || []);
      setBookings(bRes.data || []);
      if (vRes.data?.length > 0) {
        const v = selectedVenue || vRes.data[0];
        setSelectedVenue(v);
        const [aRes, pRes] = await Promise.all([
          analyticsAPI.venue(v.id).catch(() => ({ data: null })),
          venueAPI.getPricingRules(v.id).catch(() => ({ data: [] })),
        ]);
        setAnalytics(aRes.data);
        setPricingRules(pRes.data || []);
      }
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
      await venueAPI.create(venueForm);
      toast.success("Venue created!");
      setCreateVenueOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
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
    filtered.sort((a, b) => sortOrder === "desc" ? b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time) : a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
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
    confirmed: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", label: "Confirmed" },
    pending: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", label: "Pending" },
    payment_pending: { color: "bg-sky-500/15 text-sky-400 border-sky-500/20", label: "Awaiting Payment" },
    cancelled: { color: "bg-destructive/15 text-destructive border-destructive/20", label: "Cancelled" },
    expired: { color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20", label: "Expired" },
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="owner-dashboard">
      <div className="flex items-start justify-between gap-3 mb-8">
        <div className="min-w-0">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Venue Owner</span>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate">
            Welcome, <span className="text-primary">{user?.name}</span>
          </h1>
        </div>
        <Dialog open={createVenueOpen} onOpenChange={setCreateVenueOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold text-xs h-9 shrink-0" data-testid="create-venue-btn">
              <Plus className="h-4 w-4 mr-1" /> Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">Create Venue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))}
                  className="mt-1 bg-background border-border" data-testid="venue-name-input" /></div>
              <div><Label className="text-xs text-muted-foreground">Description</Label>
                <Input value={venueForm.description} onChange={e => setVenueForm(p => ({ ...p, description: e.target.value }))}
                  className="mt-1 bg-background border-border" data-testid="venue-desc-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Address</Label>
                  <Input value={venueForm.address} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="venue-address-input" /></div>
                <div><Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={venueForm.city} onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="venue-city-input" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs text-muted-foreground">Base Price</Label>
                  <Input type="number" value={venueForm.base_price} onChange={e => setVenueForm(p => ({ ...p, base_price: Number(e.target.value) }))}
                    className="mt-1 bg-background border-border" data-testid="venue-price-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Turfs</Label>
                  <Input type="number" value={venueForm.turfs} onChange={e => setVenueForm(p => ({ ...p, turfs: Number(e.target.value) }))}
                    className="mt-1 bg-background border-border" data-testid="venue-turfs-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Slot (min)</Label>
                  <Input type="number" value={venueForm.slot_duration_minutes} onChange={e => setVenueForm(p => ({ ...p, slot_duration_minutes: Number(e.target.value) }))}
                    className="mt-1 bg-background border-border" data-testid="venue-slot-input" /></div>
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreateVenue} data-testid="submit-venue-btn">Create Venue</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard icon={Building2} label="Venues" value={venues.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Calendar} label="Bookings" value={totalBookings} color="bg-violet-500/10 text-violet-400" />
        <StatCard icon={IndianRupee} label="Revenue" value={`\u20B9${(totalRevenue / 1000).toFixed(1)}K`} color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={TrendingUp} label="Avg Value" value={`\u20B9${analytics?.avg_booking_value || 0}`} color="bg-sky-500/10 text-sky-400" />
      </div>

      {/* Venue Selector */}
      {venues.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
          {venues.map(v => (
            <Button key={v.id} variant={selectedVenue?.id === v.id ? "default" : "outline"} size="sm"
              onClick={() => handleSelectVenue(v)} data-testid={`venue-tab-${v.id}`}
              className={`shrink-0 text-xs ${selectedVenue?.id === v.id ? "bg-primary text-primary-foreground" : ""}`}>
              {v.name}
            </Button>
          ))}
        </div>
      )}

      <Tabs defaultValue="bookings" data-testid="owner-tabs">
        <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="bookings" className="font-bold text-xs" data-testid="tab-bookings">Bookings</TabsTrigger>
          <TabsTrigger value="history" className="font-bold text-xs" data-testid="tab-history">
            <History className="h-3 w-3 mr-1" />History
          </TabsTrigger>
          <TabsTrigger value="reviews" className="font-bold text-xs" data-testid="tab-reviews">
            <Star className="h-3 w-3 mr-1" />Reviews
          </TabsTrigger>
          <TabsTrigger value="pricing" className="font-bold text-xs" data-testid="tab-pricing">Pricing</TabsTrigger>
          <TabsTrigger value="analytics" className="font-bold text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="plan" className="font-bold text-xs" data-testid="tab-plan">Plan</TabsTrigger>
        </TabsList>

        {/* Bookings - Enhanced with filters, detail view */}
        <TabsContent value="bookings">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            {[
              { label: "Total", value: bookingStats.total, color: "text-foreground" },
              { label: "Confirmed", value: bookingStats.confirmed, color: "text-emerald-400" },
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
                      <Badge variant="outline" className="text-[10px]">{selectedBooking.payment_gateway === "mock" ? "Mock Payment" : "Razorpay"}</Badge>
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
                      <p className="text-sm font-bold mt-0.5">#{selectedBooking.turf_number}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sport</span>
                      <p className="text-sm font-bold mt-0.5 capitalize">{selectedBooking.sport}</p>
                    </div>
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
                      <p className="text-xs text-foreground mt-0.5">{new Date(selectedBooking.payment_details.paid_at).toLocaleString()}</p>
                      {selectedBooking.payment_details.razorpay_payment_id && (
                        <>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2 block">Payment ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.razorpay_payment_id}</p>
                        </>
                      )}
                      {selectedBooking.payment_details.mock_payment_id && (
                        <>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2 block">Mock ID</span>
                          <p className="text-xs text-foreground mt-0.5 font-mono">{selectedBooking.payment_details.mock_payment_id}</p>
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
                          <span className={selectedBooking.split_config.shares_paid >= selectedBooking.split_config.total_shares ? "text-emerald-400" : "text-amber-400"}>
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
                  {selectedBooking.players?.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Players</span>
                      <span className="text-foreground">{selectedBooking.players.length} player{selectedBooking.players.length > 1 ? "s" : ""}</span>
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
              <p className="text-xs text-muted-foreground mt-0.5">See what players say about your venue</p>
            </div>

            {venueReviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">No reviews yet for {selectedVenue?.name || "this venue"}</p>
              </div>
            ) : (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {(() => {
                    const avg = venueReviews.reduce((s, r) => s + r.rating, 0) / venueReviews.length;
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
                          <div className="font-display font-black text-xl text-emerald-400">{r5}</div>
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
                                <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-primary fill-primary" : "text-muted-foreground/20"}`} />
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
                    className={`glass-card rounded-lg p-4 border-l-4 ${r.is_active ? (isUp ? "border-l-amber-500" : "border-l-emerald-500") : "border-l-muted-foreground/30 opacity-60"}`}
                    data-testid={`rule-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{r.name}</span>
                          <Badge className={`text-[10px] ${r.action?.type === "multiplier" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"} border`}>
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
                            <span className={`font-bold ${isUp ? "text-amber-400" : "text-emerald-400"}`}>{"\u20B9"}{effectivePrice}</span>
                            <span className={`ml-1 text-[10px] ${isUp ? "text-amber-400" : "text-emerald-400"}`}>
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
                        <Badge className={`text-[10px] ${d > 0 ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
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

        <TabsContent value="plan" data-testid="plan-tab-content">
          {planData ? (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-4 sm:p-5" data-testid="current-plan-card">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold truncate">Current Plan: <span className="text-primary">{planData.current_plan.name}</span></h3>
                    <p className="text-xs text-muted-foreground">{planData.venues_used} / {planData.venues_limit} venues used</p>
                  </div>
                </div>
                <div className="w-full bg-secondary/50 rounded-full h-2 mb-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (planData.venues_used / planData.venues_limit) * 100)}%` }} />
                </div>
              </div>

              <h3 className="text-sm font-bold">Available Plans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {planData.all_plans.map(plan => {
                  const isCurrent = plan.id === planData.current_plan.id;
                  return (
                    <div key={plan.id} className={`glass-card rounded-lg p-4 sm:p-5 border-2 transition-all ${isCurrent ? "border-primary" : "border-transparent hover:border-primary/30"}`}
                      data-testid={`plan-card-${plan.id}`}>
                      <div className="text-sm font-bold mb-1">{plan.name}</div>
                      <div className="text-2xl font-display font-black text-primary mb-3">
                        {plan.price === 0 ? "Free" : `\u20B9${plan.price.toLocaleString()}`}
                        {plan.price > 0 && <span className="text-xs text-muted-foreground font-normal">/mo</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">Up to {plan.max_venues} venue{plan.max_venues > 1 ? "s" : ""}</div>
                      <ul className="space-y-1 mb-4">
                        {plan.features.map((f, i) => (
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
                          {upgrading ? "..." : plan.price > planData.current_plan.price ? "Upgrade" : "Switch"}
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
      </Tabs>
    </div>
  );
}
