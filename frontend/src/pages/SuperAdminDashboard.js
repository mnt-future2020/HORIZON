import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Users, Building2, CalendarCheck, IndianRupee, Clock, Shield,
  CheckCircle, XCircle, Ban, RotateCcw, Settings, CreditCard,
  Percent, Crown, Eye, EyeOff, Save, KeyRound,
  Cloud, Wifi, AlertCircle, CheckCircle2, GraduationCap, Trophy,
  FileText, Loader2, Star, Video
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
        <StatCard icon={IndianRupee} label="Booking Revenue" value={`\u20B9${data.total_revenue.toLocaleString()}`} />
        <StatCard icon={Percent} label="Booking Commission" value={`${data.commission_pct}%`} sub={`\u20B9${(data.platform_earnings || 0).toLocaleString()}`} />
        <StatCard icon={GraduationCap} label="Coaching Revenue" value={`\u20B9${(data.coaching_revenue || 0).toLocaleString()}`} sub={`${data.coaching_commission_pct || 10}% = \u20B9${(data.coaching_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Trophy} label="Tournament Revenue" value={`\u20B9${(data.tournament_revenue || 0).toLocaleString()}`} sub={`${data.tournament_commission_pct || 10}% = \u20B9${(data.tournament_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Crown} label="Total Earnings" value={`\u20B9${(data.total_platform_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Clock} label="Pending Approvals" value={(data.pending_owners || 0) + (data.pending_coaches || 0)} color={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "text-amber-400" : "text-primary"} />
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
  // Document viewer state
  const [docViewUserId, setDocViewUserId] = useState(null);
  const [docViewData, setDocViewData] = useState(null);
  const [docViewLoading, setDocViewLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectMode, setRejectMode] = useState(false);

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
      else if (action === "reject") await adminAPI.rejectUser(userId, "");
      else if (action === "suspend") await adminAPI.suspendUser(userId);
      else if (action === "activate") await adminAPI.activateUser(userId);
      toast.success(`User ${action}d`);
      load();
    } catch { toast.error(`Failed to ${action} user`); }
  };

  const handleVerify = async (userId) => {
    try {
      await adminAPI.toggleVerified(userId);
      toast.success("Verification toggled");
      load();
    } catch { toast.error("Failed to toggle verification"); }
  };

  const openDocViewer = async (userId) => {
    setDocViewUserId(userId);
    setDocViewLoading(true);
    setRejectMode(false);
    setRejectReason("");
    try {
      const res = await adminAPI.getUserDocuments(userId);
      setDocViewData(res.data);
    } catch {
      toast.error("Failed to load documents");
      setDocViewUserId(null);
    } finally {
      setDocViewLoading(false);
    }
  };

  const handleVerifyDocs = async (userId) => {
    try {
      await adminAPI.approveUser(userId);
      toast.success("Venue owner verified and approved!");
      setDocViewUserId(null);
      load();
    } catch { toast.error("Failed to verify"); }
  };

  const handleRejectDocs = async (userId, reason) => {
    try {
      await adminAPI.rejectUser(userId, reason);
      toast.success("Venue owner rejected with reason");
      setDocViewUserId(null);
      load();
    } catch { toast.error("Failed to reject"); }
  };

  const DOC_LABELS = { business_license: "Business License", gst_certificate: "GST Certificate", id_proof: "ID Proof", address_proof: "Address Proof" };

  return (
    <div className="space-y-4" data-testid="admin-users-tab">
      <div className="flex flex-wrap gap-2">
        {["all", "pending", "player", "venue_owner", "coach"].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All" : f === "pending" ? "Pending Approval" : f === "player" ? "Lobbian" : f.replace("_", " ")}
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
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{u.role.replace("_", " ")}</Badge>
                  {u.role === "venue_owner" && u.subscription_plan && (
                    <Badge className="text-[10px] bg-purple-500/20 text-purple-400">{u.subscription_plan}</Badge>
                  )}
                  <Badge className={`text-[10px] ${u.account_status === "active" ? "bg-emerald-500/20 text-emerald-400" : u.account_status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-destructive/20 text-destructive"}`}>
                    {u.account_status}
                  </Badge>
                  {/* Venue owner: doc icon */}
                  {u.role === "venue_owner" && u.doc_verification_status && u.doc_verification_status !== "not_uploaded" && (
                    <Button size="sm" variant="ghost"
                      className={`h-7 px-2 ${
                        u.doc_verification_status === "pending_review" ? "text-amber-400 hover:bg-amber-500/10" :
                        u.doc_verification_status === "verified" ? "text-emerald-400 hover:bg-emerald-500/10" :
                        "text-destructive hover:bg-destructive/10"
                      }`}
                      onClick={() => openDocViewer(u.id)} data-testid={`docs-${u.id}`}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Docs
                    </Button>
                  )}
                  {/* Pending: Approve/Reject for non-venue_owners */}
                  {u.account_status === "pending" && u.role !== "venue_owner" && (
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
                  {/* Pending venue_owner: show doc status badge */}
                  {u.account_status === "pending" && u.role === "venue_owner" && (
                    <Badge className={`text-[10px] ${u.doc_verification_status === "pending_review" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                      {u.doc_verification_status === "pending_review" ? "Docs Submitted" : "Awaiting Docs"}
                    </Badge>
                  )}
                  {u.account_status === "active" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => handleAction(u.id, "suspend")} data-testid={`suspend-${u.id}`}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                    </Button>
                  )}
                  {u.role === "coach" && u.account_status === "active" && (
                    <Button size="sm" variant="ghost" className={`h-7 px-2 ${u.is_verified ? "text-blue-400 hover:bg-blue-500/10" : "text-muted-foreground hover:bg-primary/10"}`}
                      onClick={() => handleVerify(u.id)} data-testid={`verify-${u.id}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 mr-1 ${u.is_verified ? "" : "opacity-40"}`} />
                      {u.is_verified ? "Verified" : "Verify"}
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

      {/* Document Viewer Dialog */}
      <Dialog open={!!docViewUserId} onOpenChange={(open) => { if (!open) setDocViewUserId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verification Documents</DialogTitle>
            <DialogDescription>
              {docViewData?.name} {docViewData?.business_name && `— ${docViewData.business_name}`}
            </DialogDescription>
          </DialogHeader>

          {docViewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : docViewData ? (
            <div className="space-y-4">
              <Badge className={`text-[10px] ${
                docViewData.doc_verification_status === "pending_review" ? "bg-amber-500/20 text-amber-400" :
                docViewData.doc_verification_status === "verified" ? "bg-emerald-500/20 text-emerald-400" :
                docViewData.doc_verification_status === "rejected" ? "bg-destructive/20 text-destructive" :
                "bg-secondary text-muted-foreground"
              }`}>{docViewData.doc_verification_status?.replace("_", " ") || "unknown"}</Badge>

              {docViewData.doc_rejection_reason && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <span className="font-bold">Previous rejection:</span> {docViewData.doc_rejection_reason}
                </div>
              )}

              {/* Document grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(DOC_LABELS).map(([key, label]) => {
                  const doc = docViewData.verification_documents?.[key];
                  const isPdf = doc?.url?.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={key} className="border border-border rounded-lg p-3">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</Label>
                      {doc?.url ? (
                        isPdf ? (
                          <a href={mediaUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2 p-2 rounded-md bg-background/50 text-xs text-primary hover:underline">
                            <FileText className="h-4 w-4" /> View PDF
                          </a>
                        ) : (
                          <img src={mediaUrl(doc.url)} alt={label}
                            className="mt-2 rounded max-h-40 w-full object-contain cursor-pointer bg-background/50"
                            onClick={() => window.open(mediaUrl(doc.url), "_blank")} />
                        )
                      ) : (
                        <div className="mt-2 text-[10px] text-muted-foreground/60 py-4 text-center">Not uploaded</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Turf images */}
              {docViewData.verification_documents?.turf_images?.length > 0 && (
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Turf Images</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {docViewData.verification_documents.turf_images.map((img, i) => (
                      <img key={i} src={mediaUrl(img.url || img)} alt={`Turf ${i + 1}`}
                        className="w-20 h-20 rounded-md object-cover cursor-pointer"
                        onClick={() => window.open(mediaUrl(img.url || img), "_blank")} />
                    ))}
                  </div>
                </div>
              )}

              {/* Turf videos */}
              {docViewData.verification_documents?.turf_videos?.length > 0 && (
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Turf Videos</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {docViewData.verification_documents.turf_videos.map((vid, i) => (
                      <video key={i} src={mediaUrl(vid.url || vid)} controls className="w-40 h-28 rounded-md object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {docViewData.doc_verification_status === "pending_review" && (
                <div className="border-t border-border pt-4 space-y-3">
                  {!rejectMode ? (
                    <div className="flex gap-3">
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleVerifyDocs(docViewUserId)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Verify & Approve
                      </Button>
                      <Button variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setRejectMode(true)}>
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="text-xs">Rejection Reason (required)</Label>
                      <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Explain what needs to be corrected..." rows={3}
                        className="bg-background border-border" />
                      <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => setRejectMode(false)}>Cancel</Button>
                        <Button variant="destructive" disabled={!rejectReason.trim()}
                          onClick={() => handleRejectDocs(docViewUserId, rejectReason)}>
                          Confirm Rejection
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
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
  const [showS3Secret, setShowS3Secret] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [s3Status, setS3Status] = useState(null); // null | {ok, message}

  useEffect(() => {
    adminAPI.getSettings().then(r => setSettings(r.data)).catch(() => toast.error("Failed to load settings"));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await adminAPI.updateSettings({
        payment_gateway: settings.payment_gateway,
        booking_commission_pct: settings.booking_commission_pct,
        coaching_commission_pct: settings.coaching_commission_pct,
        tournament_commission_pct: settings.tournament_commission_pct,
        subscription_plans: settings.subscription_plans,
        s3_storage: settings.s3_storage,
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

  const handleTestS3 = async () => {
    setTestingS3(true);
    setS3Status(null);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("horizon_token");
      const res = await fetch(`${API_URL}/api/admin/s3/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings.s3_storage),
      });
      const data = await res.json();
      setS3Status(data);
      if (data.ok) toast.success("S3 connection successful!");
      else toast.error(`S3 test failed: ${data.message}`);
    } catch { toast.error("Connection test failed"); }
    finally { setTestingS3(false); }
  };

  const updateGateway = (key, val) => setSettings(s => ({
    ...s, payment_gateway: { ...s.payment_gateway, [key]: val }
  }));

  const updateS3 = (key, val) => setSettings(s => ({
    ...s, s3_storage: { ...s.s3_storage, [key]: val }
  }));

  const updatePlan = (idx, key, val) => setSettings(s => {
    const plans = [...s.subscription_plans];
    plans[idx] = { ...plans[idx], [key]: val };
    return { ...s, subscription_plans: plans };
  });

  if (!settings) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const s3 = settings.s3_storage || {};
  const s3Configured = !!(s3.access_key_id && s3.secret_access_key && s3.bucket_name && s3.region);

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
              className="mt-1.5 bg-background border-border h-10 text-sm" placeholder="Enter Razorpay Key ID"
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

      {/* ─── AWS S3 Storage ─── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Cloud className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">AWS S3 Storage</h3>
          {s3Configured ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Configured
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Not configured
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Venue images, profile photos, and match videos will be stored in your S3 bucket.
        </p>
        <div className="glass-card rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Access Key ID</Label>
              <Input value={s3.access_key_id || ""} onChange={e => updateS3("access_key_id", e.target.value)}
                className="mt-1.5 bg-background border-border h-10 text-sm font-mono"
                placeholder="Enter AWS Access Key ID" />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Secret Access Key</Label>
              <div className="relative mt-1.5">
                <Input
                  type={showS3Secret ? "text" : "password"}
                  value={s3.secret_access_key || ""}
                  onChange={e => updateS3("secret_access_key", e.target.value)}
                  className="bg-background border-border h-10 text-sm font-mono pr-10"
                  placeholder="Enter AWS Secret Access Key" />
                <button onClick={() => setShowS3Secret(!showS3Secret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showS3Secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Bucket Name</Label>
              <Input value={s3.bucket_name || ""} onChange={e => updateS3("bucket_name", e.target.value)}
                className="mt-1.5 bg-background border-border h-10 text-sm"
                placeholder="horizon-mnt-media" />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">AWS Region</Label>
              <select
                value={s3.region || "ap-south-1"}
                onChange={e => updateS3("region", e.target.value)}
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
                <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
              </select>
            </div>
          </div>

          {/* S3 Test Result */}
          {s3Status && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${s3Status.ok ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"}`}>
              {s3Status.ok
                ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{s3Status.message}</span>
            </div>
          )}

          <Button variant="outline" onClick={handleTestS3} disabled={testingS3 || !s3Configured} className="w-full h-9 text-sm gap-2">
            {testingS3 ? <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Testing...</>
              : <><Wifi className="h-4 w-4" /> Test S3 Connection</>}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            ⚠️ Make sure your S3 bucket has public read access enabled (or use a CDN). IAM user needs <code className="bg-secondary px-1 rounded">s3:PutObject</code> and <code className="bg-secondary px-1 rounded">s3:HeadBucket</code> permissions.
          </p>
        </div>
      </section>

      {/* Platform Commissions */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Percent className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">Platform Commissions</h3>
        </div>
        <div className="glass-card rounded-lg p-4 space-y-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Booking Commission</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input type="number" min={0} max={50} value={settings.booking_commission_pct}
                onChange={e => setSettings(s => ({ ...s, booking_commission_pct: Number(e.target.value) }))}
                className="bg-background border-border h-10 text-sm w-24" data-testid="commission-input" />
              <span className="text-sm text-muted-foreground">% of each venue booking</span>
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Coaching Commission</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input type="number" min={0} max={50} value={settings.coaching_commission_pct ?? 10}
                onChange={e => setSettings(s => ({ ...s, coaching_commission_pct: Number(e.target.value) }))}
                className="bg-background border-border h-10 text-sm w-24" />
              <span className="text-sm text-muted-foreground">% of each coaching session</span>
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Tournament Commission</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input type="number" min={0} max={50} value={settings.tournament_commission_pct ?? 10}
                onChange={e => setSettings(s => ({ ...s, tournament_commission_pct: Number(e.target.value) }))}
                className="bg-background border-border h-10 text-sm w-24" />
              <span className="text-sm text-muted-foreground">% of each tournament entry fee</span>
            </div>
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
