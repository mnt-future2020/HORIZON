import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Users, Building2, CalendarCheck, IndianRupee, Clock, Shield,
  CheckCircle, XCircle, Ban, RotateCcw, Settings, CreditCard,
  Percent, Crown, Eye, EyeOff, Save, KeyRound
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }) {
  return (
    <div className="glass-card rounded-lg p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-primary/10 ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-display font-black">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground/60">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminAPI.dashboard().then(r => setData(r.data)).catch(() => toast.error("Failed to load dashboard"));
  }, []);
  if (!data) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-6" data-testid="admin-overview-tab">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.total_users} />
        <StatCard icon={Building2} label="Active Venues" value={data.active_venues} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={data.total_bookings} />
        <StatCard icon={IndianRupee} label="Total Revenue" value={`\u20B9${data.total_revenue.toLocaleString()}`} />
        <StatCard icon={Percent} label="Commission" value={`${data.commission_pct}%`} sub="Platform fee" />
        <StatCard icon={Crown} label="Platform Earnings" value={`\u20B9${data.platform_earnings.toLocaleString()}`} />
        <StatCard icon={Clock} label="Pending Approvals" value={data.pending_owners} color={data.pending_owners > 0 ? "text-amber-400" : "text-primary"} />
      </div>
      <div>
        <h3 className="text-sm font-bold mb-3">Recent Registrations</h3>
        <div className="space-y-2">
          {data.recent_users.map(u => (
            <div key={u.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{u.name?.[0]}</div>
                <div>
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{u.role.replace("_", " ")}</Badge>
                <Badge className={`text-[10px] ${u.account_status === "active" ? "bg-emerald-500/20 text-emerald-400" : u.account_status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-destructive/20 text-destructive"}`}>
                  {u.account_status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filter === "pending") params.status = "pending";
    else if (filter !== "all") params.role = filter;
    adminAPI.users(params).then(r => setUsers(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (userId, action) => {
    try {
      if (action === "approve") await adminAPI.approveUser(userId);
      else if (action === "reject") await adminAPI.rejectUser(userId);
      else if (action === "suspend") await adminAPI.suspendUser(userId);
      else if (action === "activate") await adminAPI.activateUser(userId);
      toast.success(`User ${action}d`);
      load();
    } catch { toast.error(`Failed to ${action} user`); }
  };

  return (
    <div className="space-y-4" data-testid="admin-users-tab">
      <div className="flex flex-wrap gap-2">
        {["all", "pending", "player", "venue_owner", "coach"].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All" : f === "pending" ? "Pending Approval" : f.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground text-sm">No users found</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="glass-card rounded-lg p-4" data-testid={`user-row-${u.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">{u.name?.[0]}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email} {u.phone && `| ${u.phone}`}</div>
                    {u.business_name && <div className="text-[10px] text-muted-foreground/70">Business: {u.business_name} {u.gst_number && `| GST: ${u.gst_number}`}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">{u.role.replace("_", " ")}</Badge>
                  {u.role === "venue_owner" && u.subscription_plan && (
                    <Badge className="text-[10px] bg-purple-500/20 text-purple-400">{u.subscription_plan}</Badge>
                  )}
                  <Badge className={`text-[10px] ${u.account_status === "active" ? "bg-emerald-500/20 text-emerald-400" : u.account_status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-destructive/20 text-destructive"}`}>
                    {u.account_status}
                  </Badge>
                  {u.account_status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => handleAction(u.id, "approve")} data-testid={`approve-${u.id}`}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => handleAction(u.id, "reject")} data-testid={`reject-${u.id}`}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {u.account_status === "active" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => handleAction(u.id, "suspend")} data-testid={`suspend-${u.id}`}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                    </Button>
                  )}
                  {(u.account_status === "suspended" || u.account_status === "rejected") && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-primary hover:bg-primary/10"
                      onClick={() => handleAction(u.id, "activate")} data-testid={`activate-${u.id}`}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Activate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VenuesTab() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.venues().then(r => setVenues(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleVenue = async (venueId, currentStatus) => {
    try {
      if (currentStatus === "active") await adminAPI.suspendVenue(venueId);
      else await adminAPI.activateVenue(venueId);
      toast.success(`Venue ${currentStatus === "active" ? "suspended" : "activated"}`);
      load();
    } catch { toast.error("Failed to update venue"); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-2" data-testid="admin-venues-tab">
      {venues.map(v => (
        <div key={v.id} className="glass-card rounded-lg p-4 flex items-center justify-between flex-wrap gap-3" data-testid={`venue-row-${v.id}`}>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{v.name}</div>
            <div className="text-xs text-muted-foreground">{v.address}, {v.city}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">{v.sports?.join(", ")}</Badge>
              <span className="text-[10px] text-muted-foreground">{v.turfs} turfs | {v.total_bookings} bookings</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge className={`text-[10px] ${v.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-destructive/20 text-destructive"}`}>{v.status}</Badge>
            <Switch checked={v.status === "active"} onCheckedChange={() => toggleVenue(v.id, v.status)} data-testid={`toggle-venue-${v.id}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    adminAPI.getSettings().then(r => setSettings(r.data)).catch(() => toast.error("Failed to load settings"));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await adminAPI.updateSettings({
        payment_gateway: settings.payment_gateway,
        booking_commission_pct: settings.booking_commission_pct,
        subscription_plans: settings.subscription_plans,
      });
      setSettings(res.data);
      toast.success("Settings saved!");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setChangingPw(true);
    try {
      await adminAPI.changePassword({ new_password: newPassword });
      toast.success("Password updated!");
      setNewPassword("");
    } catch { toast.error("Failed to change password"); }
    finally { setChangingPw(false); }
  };

  const updateGateway = (key, val) => setSettings(s => ({
    ...s, payment_gateway: { ...s.payment_gateway, [key]: val }
  }));

  const updatePlan = (idx, key, val) => setSettings(s => {
    const plans = [...s.subscription_plans];
    plans[idx] = { ...plans[idx], [key]: val };
    return { ...s, subscription_plans: plans };
  });

  if (!settings) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8 max-w-2xl" data-testid="admin-settings-tab">
      {/* Payment Gateway */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">Payment Gateway</h3>
        </div>
        <div className="glass-card rounded-lg p-4 space-y-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Provider</Label>
            <Input value={settings.payment_gateway.provider} readOnly className="mt-1.5 bg-background border-border h-10 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Key ID</Label>
            <Input value={settings.payment_gateway.key_id} onChange={e => updateGateway("key_id", e.target.value)}
              className="mt-1.5 bg-background border-border h-10 text-sm" placeholder="rzp_live_xxxx or rzp_test_xxxx"
              data-testid="gateway-key-id" />
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Key Secret</Label>
            <div className="relative mt-1.5">
              <Input type={showSecret ? "text" : "password"} value={settings.payment_gateway.key_secret}
                onChange={e => updateGateway("key_secret", e.target.value)}
                className="bg-background border-border h-10 text-sm pr-10" placeholder="Enter key secret"
                data-testid="gateway-key-secret" />
              <button onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={settings.payment_gateway.is_live} onCheckedChange={v => updateGateway("is_live", v)} data-testid="gateway-live-toggle" />
            <Label className="text-sm">{settings.payment_gateway.is_live ? "Live Mode" : "Test Mode"}</Label>
          </div>
        </div>
      </section>

      {/* Booking Commission */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Percent className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">Booking Commission</h3>
        </div>
        <div className="glass-card rounded-lg p-4">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Commission Percentage</Label>
          <div className="flex items-center gap-3 mt-1.5">
            <Input type="number" min={0} max={50} value={settings.booking_commission_pct}
              onChange={e => setSettings(s => ({ ...s, booking_commission_pct: Number(e.target.value) }))}
              className="bg-background border-border h-10 text-sm w-24" data-testid="commission-input" />
            <span className="text-sm text-muted-foreground">% of each booking goes to the platform</span>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">SaaS Subscription Plans</h3>
        </div>
        <div className="space-y-3">
          {settings.subscription_plans.map((plan, idx) => (
            <div key={plan.id} className="glass-card rounded-lg p-4 space-y-3" data-testid={`plan-${plan.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{plan.name}</span>
                <Badge variant="secondary" className="text-[10px]">{plan.id}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Monthly Price</Label>
                  <Input type="number" value={plan.price} onChange={e => updatePlan(idx, "price", Number(e.target.value))}
                    className="mt-1 bg-background border-border h-9 text-sm" data-testid={`plan-price-${plan.id}`} />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Max Venues</Label>
                  <Input type="number" value={plan.max_venues} onChange={e => updatePlan(idx, "max_venues", Number(e.target.value))}
                    className="mt-1 bg-background border-border h-9 text-sm" data-testid={`plan-venues-${plan.id}`} />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Features (comma separated)</Label>
                <Input value={plan.features.join(", ")} onChange={e => updatePlan(idx, "features", e.target.value.split(",").map(f => f.trim()).filter(Boolean))}
                  className="mt-1 bg-background border-border h-9 text-sm" data-testid={`plan-features-${plan.id}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <Button onClick={saveSettings} disabled={saving} className="bg-primary text-primary-foreground font-bold w-full h-11" data-testid="save-settings-btn">
        {saving ? "Saving..." : <><Save className="h-4 w-4 mr-2" /> Save All Settings</>}
      </Button>

      {/* Change Password */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">Change Admin Password</h3>
        </div>
        <div className="glass-card rounded-lg p-4">
          <div className="flex gap-3">
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)" className="bg-background border-border h-10 text-sm" data-testid="new-password-input" />
            <Button onClick={handleChangePassword} disabled={changingPw} variant="outline" className="shrink-0 h-10" data-testid="change-password-btn">
              {changingPw ? "..." : "Update"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="super-admin-dashboard">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight">Admin Console</h1>
            <p className="text-xs text-muted-foreground">Horizon Platform Management</p>
          </div>
        </div>

        <Tabs defaultValue="overview" data-testid="admin-tabs">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="overview" className="text-xs font-bold" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="users" className="text-xs font-bold" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="venues" className="text-xs font-bold" data-testid="tab-venues">Venues</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs font-bold" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="venues"><VenuesTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
