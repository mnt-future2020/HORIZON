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
import { Building2, IndianRupee, TrendingUp, Calendar, Plus, Trash2, BarChart3, Clock, ShieldAlert, Crown, CheckCircle, Pencil, Power, Users, CreditCard, X, ChevronRight, Filter, History, CalendarDays, CircleDot, AlertCircle, ArrowUpDown } from "lucide-react";
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
          <TabsTrigger value="bookings" className="font-bold text-xs">Bookings</TabsTrigger>
          <TabsTrigger value="pricing" className="font-bold text-xs" data-testid="tab-pricing">Pricing</TabsTrigger>
          <TabsTrigger value="analytics" className="font-bold text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="plan" className="font-bold text-xs" data-testid="tab-plan">Plan</TabsTrigger>
        </TabsList>

        {/* Bookings - Mobile card layout */}
        <TabsContent value="bookings">
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Calendar className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No bookings yet</p></div>
          ) : (
            <div className="space-y-3">
              {bookings.slice(0, 20).map(b => (
                <div key={b.id} className="glass-card rounded-lg p-4" data-testid={`booking-row-${b.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-foreground truncate block">{b.venue_name}</span>
                      <span className="text-xs text-muted-foreground">{b.host_name}</span>
                    </div>
                    <Badge variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "destructive"}
                      className="text-[10px] shrink-0">{b.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{b.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.start_time}-{b.end_time}</span>
                    </div>
                    <span className="font-bold text-primary">{"\u20B9"}{b.total_amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
