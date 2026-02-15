import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI, bookingAPI, analyticsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Building2, IndianRupee, TrendingUp, Calendar, Plus, Trash2, BarChart3, Clock, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card rounded-lg p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-2xl font-display font-black text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function VenueOwnerDashboard() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pricingRules, setPricingRules] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createVenueOpen, setCreateVenueOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [venueForm, setVenueForm] = useState({
    name: "", description: "", sports: ["football"], address: "", city: "Bengaluru",
    base_price: 2000, slot_duration_minutes: 60, opening_hour: 6, closing_hour: 23, turfs: 1,
    amenities: [], images: [],
  });
  const [ruleForm, setRuleForm] = useState({
    name: "", priority: 10, conditions: { days: [], time_range: { start: "18:00", end: "22:00" } },
    action: { type: "multiplier", value: 1.2 },
  });

  const loadData = async () => {
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
  };

  useEffect(() => { loadData(); }, []);

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

  const handleCreateRule = async () => {
    if (!selectedVenue) return;
    try {
      await venueAPI.createPricingRule(selectedVenue.id, ruleForm);
      toast.success("Pricing rule created!");
      setCreateRuleOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
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

  const totalRevenue = analytics?.total_revenue || 0;
  const totalBookings = analytics?.total_bookings || 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="owner-dashboard">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Venue Owner</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Welcome, <span className="text-primary">{user?.name}</span>
          </h1>
        </div>
        <Dialog open={createVenueOpen} onOpenChange={setCreateVenueOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold text-xs h-9" data-testid="create-venue-btn">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="Venues" value={venues.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Calendar} label="Bookings" value={totalBookings} color="bg-violet-500/10 text-violet-400" />
        <StatCard icon={IndianRupee} label="Revenue" value={`\u20B9${(totalRevenue / 1000).toFixed(1)}K`} color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={TrendingUp} label="Avg Value" value={`\u20B9${analytics?.avg_booking_value || 0}`} color="bg-sky-500/10 text-sky-400" />
      </div>

      {/* Venue Selector */}
      {venues.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {venues.map(v => (
            <Button key={v.id} variant={selectedVenue?.id === v.id ? "default" : "outline"} size="sm"
              onClick={() => handleSelectVenue(v)} data-testid={`venue-tab-${v.id}`}
              className={`shrink-0 ${selectedVenue?.id === v.id ? "bg-primary text-primary-foreground" : ""}`}>
              {v.name}
            </Button>
          ))}
        </div>
      )}

      <Tabs defaultValue="bookings" data-testid="owner-tabs">
        <TabsList className="bg-secondary/50 mb-6">
          <TabsTrigger value="bookings" className="font-bold">Bookings</TabsTrigger>
          <TabsTrigger value="pricing" className="font-bold">Pricing Rules</TabsTrigger>
          <TabsTrigger value="analytics" className="font-bold">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Calendar className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No bookings yet</p></div>
          ) : (
            <div className="glass-card rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-mono text-xs">Date</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Time</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Venue</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Host</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Amount</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.slice(0, 20).map(b => (
                    <TableRow key={b.id} className="border-border">
                      <TableCell className="text-sm">{b.date}</TableCell>
                      <TableCell className="text-sm">{b.start_time}-{b.end_time}</TableCell>
                      <TableCell className="text-sm font-medium">{b.venue_name}</TableCell>
                      <TableCell className="text-sm">{b.host_name}</TableCell>
                      <TableCell className="text-sm font-bold text-primary">{"\u20B9"}{b.total_amount}</TableCell>
                      <TableCell><Badge variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "destructive"} className="text-[10px]">{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pricing">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Pricing Rules {selectedVenue && `- ${selectedVenue.name}`}</h3>
            <Dialog open={createRuleOpen} onOpenChange={setCreateRuleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8" data-testid="create-rule-btn">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader><DialogTitle className="font-display">Create Pricing Rule</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-xs text-muted-foreground">Rule Name</Label>
                    <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Weekend Surge" className="mt-1 bg-background border-border" data-testid="rule-name-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Priority (higher = more important)</Label>
                    <Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))}
                      className="mt-1 bg-background border-border" data-testid="rule-priority-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Action Type</Label>
                    <Select value={ruleForm.action.type} onValueChange={v => setRuleForm(p => ({ ...p, action: { ...p.action, type: v } }))}>
                      <SelectTrigger className="mt-1 bg-background border-border" data-testid="rule-action-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiplier">Multiplier (e.g., 1.2 = +20%)</SelectItem>
                        <SelectItem value="discount">Discount (e.g., 0.15 = -15%)</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div><Label className="text-xs text-muted-foreground">Value</Label>
                    <Input type="number" step="0.01" value={ruleForm.action.value}
                      onChange={e => setRuleForm(p => ({ ...p, action: { ...p.action, value: Number(e.target.value) } }))}
                      className="mt-1 bg-background border-border" data-testid="rule-value-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Time Range (start - end)</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Input value={ruleForm.conditions.time_range?.start || ""}
                        onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, start: e.target.value } } }))}
                        placeholder="18:00" className="bg-background border-border" data-testid="rule-time-start" />
                      <Input value={ruleForm.conditions.time_range?.end || ""}
                        onChange={e => setRuleForm(p => ({ ...p, conditions: { ...p.conditions, time_range: { ...p.conditions.time_range, end: e.target.value } } }))}
                        placeholder="22:00" className="bg-background border-border" data-testid="rule-time-end" />
                    </div></div>
                  <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreateRule} data-testid="submit-rule-btn">Create Rule</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {pricingRules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><BarChart3 className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No pricing rules</p></div>
          ) : (
            <div className="space-y-3">
              {pricingRules.map(r => (
                <div key={r.id} className="glass-card rounded-lg p-4 flex items-center justify-between" data-testid={`rule-card-${r.id}`}>
                  <div>
                    <div className="font-bold text-sm text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Priority: {r.priority} | {r.action?.type}: {r.action?.value}
                      {r.conditions?.time_range && ` | ${r.conditions.time_range.start}-${r.conditions.time_range.end}`}
                      {r.conditions?.days && ` | Days: ${r.conditions.days.join(",")}`}
                    </div>
                  </div>
                  <Badge className={r.is_active ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}>
                    {r.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          {analytics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass-card rounded-lg p-4">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Total Revenue</div>
                  <div className="text-2xl font-display font-black text-primary mt-1">{"\u20B9"}{totalRevenue.toLocaleString()}</div>
                </div>
                <div className="glass-card rounded-lg p-4">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Confirmed</div>
                  <div className="text-2xl font-display font-black text-foreground mt-1">{analytics.confirmed_bookings}</div>
                </div>
                <div className="glass-card rounded-lg p-4">
                  <div className="text-xs text-muted-foreground font-mono uppercase">Cancelled</div>
                  <div className="text-2xl font-display font-black text-destructive mt-1">{analytics.cancelled_bookings}</div>
                </div>
              </div>
              {analytics.daily_revenue?.length > 0 && (
                <div className="glass-card rounded-lg p-6">
                  <h3 className="font-display font-bold mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.daily_revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                      <XAxis dataKey="date" tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 11 }} />
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
      </Tabs>
    </div>
  );
}
