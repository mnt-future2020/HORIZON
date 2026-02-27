import { useState, useEffect, useCallback } from "react";
import { adminAPI, uploadAPI } from "@/lib/api";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Building2, CalendarCheck, IndianRupee, Clock, Shield,
  CheckCircle, XCircle, Ban, RotateCcw, Settings, CreditCard,
  Percent, Crown, Eye, EyeOff, Save, KeyRound,
  Cloud, Wifi, AlertCircle, CheckCircle2, GraduationCap, Trophy,
  FileText, Loader2, Star, Video, Plus, UserPlus, Phone,
  ImagePlus, X, MessageCircle, ShieldCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSkeleton } from "@/components/SkeletonLoader";

const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

function StatCard({ icon: Icon, label, value, sub, color = "text-brand-600", bgColor = "bg-brand-600/10" }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="glass-premium rounded-[32px] p-7 border border-white/10 shadow-xl overflow-hidden relative group"
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {/* Decorative gradient glow */}
      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20 ${bgColor}`} />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
        <div className={`p-3 rounded-2xl ${bgColor} flex items-center justify-center shadow-inner`}>
          <Icon className={`h-5 w-5 ${color} drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]`} />
        </div>
      </div>

      <div className="relative z-10">
        <div className="text-4xl font-black font-display text-foreground tracking-tight mb-1 animate-count-slide">
          {value}
        </div>
        {sub && (
          <div className="text-[11px] text-muted-foreground/80 font-semibold flex items-center gap-1.5 mt-2 bg-white/5 py-1 px-3 rounded-full w-fit">
            {sub}
          </div>
        )}
      </div>
      
      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-transparent via-${color.replace('text-', '')} to-transparent w-full opacity-30`} />
    </motion.div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminAPI.dashboard().then(r => setData(r.data)).catch(() => toast.error("Failed to load dashboard"));
  }, []);
  if (!data) return <AdminSkeleton />;
  return (
    <div className="space-y-8" data-testid="admin-overview-tab">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={data.total_users} />
        <StatCard icon={Building2} label="Active Venues" value={data.active_venues} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={data.total_bookings} />
        <StatCard icon={IndianRupee} label="Booking Revenue" value={`\u20B9${data.total_revenue.toLocaleString()}`} />
        <StatCard icon={Percent} label="Booking Commission" value={`${data.commission_pct}%`} sub={`\u20B9${(data.platform_earnings || 0).toLocaleString()}`} />
        <StatCard icon={GraduationCap} label="Coaching Revenue" value={`\u20B9${(data.coaching_revenue || 0).toLocaleString()}`} sub={`${data.coaching_commission_pct || 10}% = \u20B9${(data.coaching_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Trophy} label="Tournament Revenue" value={`\u20B9${(data.tournament_revenue || 0).toLocaleString()}`} sub={`${data.tournament_commission_pct || 10}% = \u20B9${(data.tournament_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Crown} label="Total Earnings" value={`\u20B9${(data.total_platform_earnings || 0).toLocaleString()}`} />
        <StatCard icon={Clock} label="Pending Approvals" 
          value={(data.pending_owners || 0) + (data.pending_coaches || 0)} 
          color={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "text-amber-500" : "text-brand-600"} 
          bgColor={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "bg-amber-500/10" : "bg-brand-600/10"}
        />
      </div>
      <div>
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 px-1">Recent Registrations</h3>
        <div className="bg-card rounded-[24px] border border-border/40 shadow-sm overflow-hidden">
          {data.recent_users.map((u, i) => {
            const initialsColor = u.role === "venue_owner" ? "bg-purple-500/10 text-purple-600" : u.role === "coach" ? "bg-blue-500/10 text-blue-600" : "bg-brand-600/10 text-brand-600";
            return (
              <div key={u.id} className={`p-5 hover:bg-muted/50 transition-colors flex items-center justify-between ${i !== data.recent_users.length - 1 ? "border-b border-border/30" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${initialsColor}`}>
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground tracking-tight">{u.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground px-2.5 py-1 rounded-md">
                    {u.role.replace("_", " ")}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border-none shadow-none ${
                    u.account_status === "active" ? "bg-green-500/10 text-green-600" : 
                    u.account_status === "pending" ? "bg-amber-500/10 text-amber-600" : 
                    "bg-red-500/10 text-red-600"
                  }`}>
                    {u.account_status}
                  </span>
                </div>
              </div>
            );
          })}
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
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending", "player", "venue_owner", "coach"].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-widest transition-all duration-300 uppercase ${filter === f ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All Users" : f === "pending" ? "Pending Approval" : f === "player" ? "Lobbian" : f.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[200px]">
          <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <div className="text-muted-foreground text-sm font-medium">No users found matching this filter</div>
        </div>
      ) : (
        <div className="bg-card rounded-[24px] border border-border/40 shadow-sm overflow-hidden">
          {users.map((u, i) => (
            <div key={u.id} className={`p-5 transition-colors duration-300 group hover:bg-muted/50 ${i !== users.length - 1 ? "border-b border-border/30" : ""}`} data-testid={`user-row-${u.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${u.role === "venue_owner" ? "bg-purple-500/10 text-purple-600" : u.role === "coach" ? "bg-blue-500/10 text-blue-600" : "bg-brand-600/10 text-brand-600"}`}>
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-foreground tracking-tight">{u.name}</div>
                    <div className="text-xs text-muted-foreground font-medium truncate mt-0.5">{u.email} {u.phone && <span className="opacity-60 px-1.5">•</span>} {u.phone}</div>
                    {u.business_name && <div className="text-[11px] text-muted-foreground font-medium mt-1.5 inline-flex items-center bg-secondary px-2 py-0.5 rounded-md border-none shadow-none">Business: {u.business_name} {u.gst_number && <span className="opacity-60 mx-1.5">|</span>} {u.gst_number && `GST: ${u.gst_number}`}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground px-2.5 py-1 rounded-md">{u.role.replace("_", " ")}</span>
                  {u.role === "venue_owner" && u.subscription_plan && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 border-none px-2.5 py-1 rounded-md">{u.subscription_plan}</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border-none shadow-none ${
                    u.account_status === "active" ? "bg-green-500/10 text-green-600" : 
                    u.account_status === "pending" ? "bg-amber-500/10 text-amber-600" : 
                    "bg-red-500/10 text-red-600"
                  }`}>
                    {u.account_status}
                  </span>
                  {/* Venue owner: doc icon */}
                  {u.role === "venue_owner" && u.doc_verification_status && u.doc_verification_status !== "not_uploaded" && (
                    <Button size="sm" variant="ghost"
                      className={`h-8 px-3 rounded-full font-semibold text-xs transition-colors border-none ${
                        u.doc_verification_status === "pending_review" ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" :
                        u.doc_verification_status === "verified" ? "text-brand-600 bg-brand-600/10 hover:bg-brand-600/20" :
                        "text-destructive bg-destructive/10 hover:bg-destructive/20"
                      }`}
                      onClick={() => openDocViewer(u.id)} data-testid={`docs-${u.id}`}>
                      <FileText className="h-4 w-4 mr-1.5" /> Docs
                    </Button>
                  )}
                  {/* Pending: Approve/Reject for non-venue_owners */}
                  {u.account_status === "pending" && u.role !== "venue_owner" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-3 rounded-full text-brand-600 bg-brand-600/10 hover:bg-brand-600/20"
                        onClick={() => handleAction(u.id, "approve")} data-testid={`approve-${u.id}`}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-3 rounded-full text-red-600 bg-red-500/10 hover:bg-red-500/20"
                        onClick={() => handleAction(u.id, "reject")} data-testid={`reject-${u.id}`}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {/* Pending venue_owner: show doc status badge */}
                  {u.account_status === "pending" && u.role === "venue_owner" && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border-none ${u.doc_verification_status === "pending_review" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"}`}>
                      {u.doc_verification_status === "pending_review" ? "Docs Submitted" : "Awaiting Docs"}
                    </span>
                  )}
                  {u.account_status === "active" && (
                    <Button size="sm" variant="ghost" className="h-7 px-3 rounded-full text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() => handleAction(u.id, "suspend")} data-testid={`suspend-${u.id}`}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                    </Button>
                  )}
                  {u.role === "coach" && u.account_status === "active" && (
                    <Button size="sm" variant="ghost" className={`h-7 px-3 rounded-full ${u.is_verified ? "text-brand-600 bg-brand-600/10 hover:bg-brand-600/20" : "text-muted-foreground bg-secondary hover:bg-muted"}`}
                      onClick={() => handleVerify(u.id)} data-testid={`verify-${u.id}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 mr-1 ${u.is_verified ? "" : "opacity-40"}`} />
                      {u.is_verified ? "Verified" : "Verify"}
                    </Button>
                  )}
                  {(u.account_status === "suspended" || u.account_status === "rejected") && (
                    <Button size="sm" variant="ghost" className="h-7 px-3 rounded-full text-brand-600 bg-brand-600/10 hover:bg-brand-600/20"
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
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="text-xl font-display font-light">Verification Documents</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">
              {docViewData?.name} {docViewData?.business_name && <span className="text-foreground"> — {docViewData.business_name}</span>}
            </DialogDescription>
          </DialogHeader>

          {docViewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin border-brand-600" /></div>
          ) : docViewData ? (
            <div className="space-y-4">
              <Badge className={`text-[10px] ${
                docViewData.doc_verification_status === "pending_review" ? "bg-amber-500/20 text-amber-400" :
                docViewData.doc_verification_status === "verified" ? "bg-brand-500/20 text-brand-400" :
                docViewData.doc_verification_status === "rejected" ? "bg-destructive/20 text-destructive" :
                "bg-secondary text-muted-foreground"
              }`}>{docViewData.doc_verification_status?.replace("_", " ") || "unknown"}</Badge>

              {docViewData.doc_rejection_reason && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <span className="font-bold">Previous rejection:</span> {docViewData.doc_rejection_reason}
                </div>
              )}

              {/* Document grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(DOC_LABELS).map(([key, label]) => {
                  const doc = docViewData.verification_documents?.[key];
                  const isPdf = doc?.url?.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={key} className="bg-secondary/20 border border-border/50 rounded-xl p-4 transition-colors hover:bg-secondary/40">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
                      {doc?.url ? (
                        isPdf ? (
                          <a href={mediaUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2 p-2 rounded-md bg-background/50 text-xs border-brand-600 hover:underline">
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
                      <Button className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
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

function VenueItem({ venue: v, index, onAssign, onToggle }) {
  const hasImages = v.images && v.images.length > 0;
  const mainImage = hasImages ? v.images[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
      className="glass-premium rounded-[32px] p-6 mb-4 border border-white/5 shadow-lg group relative overflow-hidden"
    >
      <div className="flex items-start gap-6 relative z-10">
        {/* Venue Thumbnail */}
        <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-inner bg-muted/20">
          {mainImage ? (
            <img src={mediaUrl(mainImage)} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-600/5">
              <Building2 className="h-8 w-8 text-brand-600/30" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-black tracking-tight text-foreground truncate">{v.name}</h4>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider h-5 rounded-full border-none ${
                v.badge === "bookable" ? "bg-emerald-500/10 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]" : "bg-amber-500/10 text-amber-500"
              }`}>
                {v.badge === "bookable" ? "Bookable" : "Enquiry"}
              </Badge>
              {v.owner_id ? (
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider h-5 rounded-full border-none bg-blue-500/10 text-blue-500">
                  Linked
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider h-5 rounded-full border-none bg-orange-500/10 text-orange-500">
                  Manual
                </Badge>
              )}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground font-medium mb-4 line-clamp-1 opacity-80">{v.address}{v.address && ", "}{v.city}</p>
          
          <div className="flex items-center gap-2 flex-wrap">
            {v.sports?.map(sport => (
              <span key={sport} className="text-[9px] font-black uppercase tracking-widest bg-white/5 text-muted-foreground py-1 px-3 rounded-full border border-white/5">
                {sport}
              </span>
            ))}
            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
              <Crown className="w-3 h-3" /> {v.turfs} Turfs
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
              <CalendarCheck className="w-3 h-3" /> {v.total_bookings} Bookings
            </span>
            {v.contact_phone && (
              <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {v.contact_phone}
              </span>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex flex-col items-end justify-between self-stretch gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black uppercase tracking-tighter ${v.status === "active" ? "text-emerald-500" : "text-rose-500"}`}>
              {v.status === "active" ? "Live" : "Inactive"}
            </span>
            <Switch checked={v.status === "active"} onCheckedChange={() => onToggle(v.id, v.status)} />
          </div>
          
          {!v.owner_id && (
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 px-4 text-[11px] font-black uppercase tracking-wider rounded-full border-white/10 bg-white/5 hover:bg-brand-600/10 hover:text-brand-600 hover:border-brand-600/30 transition-all"
              onClick={() => onAssign(v)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-2" /> Assign Owner
            </Button>
          )}
        </div>
      </div>

      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-brand-600/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

function VenuesTab() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const SPORTS_OPTIONS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball", "Table Tennis"];
  const AMENITIES_OPTIONS = ["Parking", "Washroom", "Changing Room", "Drinking Water", "Floodlights", "Cafeteria", "First Aid", "WiFi", "Seating Area", "Scoreboard"];
  const [venueForm, setVenueForm] = useState({ name: "", description: "", address: "", area: "", city: "", sports: [], amenities: [], base_price: 2000, turfs: 1, opening_hour: 6, closing_hour: 23, slot_duration_minutes: 60, contact_phone: "", images: [] });
  const toggleFormArray = (field, val) => setVenueForm(p => ({ ...p, [field]: p[field].includes(val) ? p[field].filter(v => v !== val) : [...p[field], val] }));
  const [uploading, setUploading] = useState(false);
  // Assign owner
  const [assignDialog, setAssignDialog] = useState(null); // venue object or null
  const [venueOwners, setVenueOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [useOwnerPhone, setUseOwnerPhone] = useState(false);
  const [confirmAssign, setConfirmAssign] = useState(false);

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

  const handleCreateVenue = async () => {
    if (!venueForm.name.trim() || !venueForm.city.trim()) { toast.error("Name and city are required"); return; }
    setCreating(true);
    try {
      await adminAPI.createVenue(venueForm);
      toast.success("Venue created (Enquiry mode)");
      setShowCreateDialog(false);
      setVenueForm({ name: "", description: "", address: "", city: "", sports: ["football"], base_price: 2000, turfs: 1, contact_phone: "", images: [] });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to create venue"); }
    finally { setCreating(false); }
  };

  const handleImageUpload = async (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    const uploaded = [...venueForm.images];
    for (const file of arr) {
      try {
        const res = await uploadAPI.image(file);
        uploaded.push(res.data.url);
      } catch { toast.error("Image upload failed"); break; }
    }
    setVenueForm(p => ({ ...p, images: uploaded }));
    setUploading(false);
  };

  const openAssignDialog = async (venue) => {
    setAssignDialog(venue);
    setSelectedOwner("");
    setUseOwnerPhone(false);
    setConfirmAssign(false);
    try {
      const res = await adminAPI.users({ role: "venue_owner", status: "active" });
      setVenueOwners(res.data || []);
    } catch { setVenueOwners([]); }
  };

  const handleAssignOwner = async () => {
    if (!selectedOwner || !assignDialog) return;
    if (!confirmAssign) { setConfirmAssign(true); return; }
    setAssigning(true);
    try {
      await adminAPI.assignVenueOwner(assignDialog.id, selectedOwner, useOwnerPhone);
      toast.success("Owner assigned! Venue is now bookable.");
      setAssignDialog(null);
      setConfirmAssign(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to assign owner"); }
    finally { setAssigning(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-3" data-testid="admin-venues-tab">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Venues</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">{venues.length} Facilities Managed</p>
        </div>
        <Button size="sm" className="gap-2 h-11 px-6 text-xs font-black tracking-widest uppercase rounded-full shadow-lg shadow-brand-600/20 transition-all hover:scale-105 active:scale-95 bg-brand-600 text-white" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" /> Add New Venue
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {venues.map((v, i) => (
          <VenueItem 
            key={v.id} 
            venue={v} 
            index={i} 
            onAssign={openAssignDialog} 
            onToggle={toggleVenue} 
          />
        ))}
      </div>

      {/* Create Venue Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-display font-light">
              <div className="p-2 rounded-xl border-brand-600/10">
                <Building2 className="h-5 w-5 border-brand-600" />
              </div> 
              Add Venue <span className="text-muted-foreground font-sans text-sm mt-1 border border-border/60 bg-secondary/50 px-2 py-0.5 rounded-md ml-2 hidden sm:inline-block">Enquiry Mode</span>
            </DialogTitle>
            <DialogDescription className="text-sm font-medium mt-2">This venue will be in Enquiry mode until an owner is assigned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Venue Name *</Label>
              <Input value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))} placeholder="PowerPlay Arena" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={venueForm.description} onChange={e => setVenueForm(p => ({ ...p, description: e.target.value }))} placeholder="Premium sports facility..." className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input value={venueForm.address} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main Street" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Area</Label>
                <Input value={venueForm.area} onChange={e => setVenueForm(p => ({ ...p, area: e.target.value }))} placeholder="Koramangala" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">City *</Label>
              <Input value={venueForm.city} onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))} placeholder="Bengaluru" className="mt-1" />
            </div>
            {/* Sports */}
            <div>
              <Label className="text-xs text-muted-foreground">Sports *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SPORTS_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => toggleFormArray("sports", s.toLowerCase())}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${venueForm.sports.includes(s.toLowerCase()) ? "-brand-600 border-brand-600-foreground border-brand-600" : "bg-secondary/50 text-muted-foreground border-border hover:border-brand-600/50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {/* Amenities */}
            <div>
              <Label className="text-xs text-muted-foreground">Amenities</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {AMENITIES_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => toggleFormArray("amenities", a)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${venueForm.amenities.includes(a) ? "-brand-600 border-brand-600-foreground border-brand-600" : "bg-secondary/50 text-muted-foreground border-border hover:border-brand-600/50"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Base Price (INR/hr)</Label>
                <Input type="number" value={venueForm.base_price} onChange={e => setVenueForm(p => ({ ...p, base_price: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Number of Turfs</Label>
                <Input type="number" value={venueForm.turfs} onChange={e => setVenueForm(p => ({ ...p, turfs: Number(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Opening Hour</Label>
                <Input type="number" min={0} max={23} value={venueForm.opening_hour} onChange={e => setVenueForm(p => ({ ...p, opening_hour: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Closing Hour</Label>
                <Input type="number" min={0} max={23} value={venueForm.closing_hour} onChange={e => setVenueForm(p => ({ ...p, closing_hour: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Slot (min)</Label>
                <Input type="number" value={venueForm.slot_duration_minutes} onChange={e => setVenueForm(p => ({ ...p, slot_duration_minutes: Number(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Owner's WhatsApp Number</Label>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs font-bold text-muted-foreground select-none">+91</span>
                <Input value={venueForm.contact_phone} onChange={e => setVenueForm(p => ({ ...p, contact_phone: cleanPhone(e.target.value) }))} placeholder="98765 43210" className="rounded-l-none" maxLength={10} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Enquiries from Lobbians will be sent to this WhatsApp number.</p>
            </div>
            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Venue Images</Label>
              {venueForm.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {venueForm.images.map((url, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setVenueForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium ${uploading ? "opacity-60 pointer-events-none border-border" : "-brand-600/40 hover:border-brand-600 hover:border-brand-600/5 text-muted-foreground hover:border-brand-600"}`}>
                {uploading ? <><div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Uploading...</> : <><ImagePlus className="h-4 w-4" />{venueForm.images.length > 0 ? "Add more images" : "Upload venue images"}</>}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} disabled={uploading} />
              </label>
            </div>
            <Button className="w-full border-brand-600 border-brand-600-foreground font-bold" onClick={handleCreateVenue} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Venue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Owner Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(o) => !o && setAssignDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-display font-light">
              <div className="p-2 rounded-xl border-brand-600/10">
                <UserPlus className="h-5 w-5 border-brand-600" />
              </div> 
              Assign Owner
            </DialogTitle>
            <DialogDescription className="text-sm font-medium mt-2">Assign a verified venue owner to <span className="text-foreground font-semibold">"{assignDialog?.name}"</span>. This will change the badge from Enquiry to Bookable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {venueOwners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active venue owners found. Venue owners must register and be approved first.</p>
            ) : (
              <>
                <Select value={selectedOwner} onValueChange={(v) => { setSelectedOwner(v); setConfirmAssign(false); }}>
                  <SelectTrigger><SelectValue placeholder="Select venue owner" /></SelectTrigger>
                  <SelectContent>
                    {venueOwners.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.email}){o.business_name ? ` — ${o.business_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Phone number info */}
                {selectedOwner && (() => {
                  const owner = venueOwners.find(o => o.id === selectedOwner);
                  const venuePhone = assignDialog?.contact_phone;
                  const ownerPhone = owner?.phone;
                  const phonesAreDifferent = venuePhone && ownerPhone && venuePhone !== ownerPhone;
                  return (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Venue phone:</span>
                        <span className="font-medium">{venuePhone || "Not set"}{venuePhone && <span className="text-muted-foreground font-normal"> (by admin)</span>}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Owner phone:</span>
                        <span className="font-medium">{ownerPhone || "Not set"}</span>
                      </div>
                      {phonesAreDifferent && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <Label htmlFor="use-owner-phone" className="text-xs text-muted-foreground cursor-pointer">
                            Update venue phone to owner's number
                          </Label>
                          <Switch id="use-owner-phone" checked={useOwnerPhone} onCheckedChange={setUseOwnerPhone} />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
            {/* Confirmation summary */}
            {confirmAssign && selectedOwner && (() => {
              const owner = venueOwners.find(o => o.id === selectedOwner);
              return (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Are you sure?
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>Venue: <span className="text-foreground font-medium">{assignDialog?.name}</span></p>
                    <p>Owner: <span className="text-foreground font-medium">{owner?.name} ({owner?.email})</span></p>
                    <p>Phone: <span className="text-foreground font-medium">{useOwnerPhone ? (owner?.phone || "Not set") + " (owner)" : (assignDialog?.contact_phone || owner?.phone || "Not set") + (!useOwnerPhone && assignDialog?.contact_phone ? " (by admin)" : "")}</span></p>
                    <p>Badge will change from <span className="text-amber-400 font-medium">Enquiry</span> to <span className="text-brand-400 font-medium">Bookable</span></p>
                  </div>
                </div>
              );
            })()}
            <div className="flex gap-2">
              {confirmAssign && (
                <Button variant="outline" className="flex-1 font-bold" onClick={() => setConfirmAssign(false)}>
                  Go Back
                </Button>
              )}
              <Button className={`${confirmAssign ? "flex-1" : "w-full"} font-bold`} onClick={handleAssignOwner} disabled={assigning || !selectedOwner}>
                {assigning ? "Assigning..." : confirmAssign ? "Yes, Assign Owner" : "Assign Owner"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showS3Secret, setShowS3Secret] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [s3Status, setS3Status] = useState(null); // null | {ok, message}
  const [activeSubTab, setActiveSubTab] = useState("payments");

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
        whatsapp: settings.whatsapp,
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

  if (!settings) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const s3 = settings.s3_storage || {};
  const s3Configured = !!(s3.access_key_id && s3.secret_access_key && s3.bucket_name && s3.region);

  const subTabs = [
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "storage", label: "Cloud Storage", icon: Cloud },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "platform", label: "Platform", icon: Crown },
    { id: "security", label: "Security", icon: ShieldCheck }
  ];

  return (
    <div className="space-y-8 max-w-4xl pb-10" data-testid="admin-settings-tab">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 glass-premium rounded-2xl w-fit mb-8 border border-white/5">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              activeSubTab === tab.id 
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20 active:scale-95" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeSubTab === tab.id ? "text-white" : "text-muted-foreground"}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-[400px]"
        >
          {activeSubTab === "payments" && (
            <section className="space-y-8 max-w-3xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                  <CreditCard className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-foreground uppercase">Payment Gateway</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Global Transaction Settings</p>
                </div>
              </div>
              
              <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Provider</Label>
                    <div className="h-12 flex items-center px-4 bg-white/5 rounded-2xl border border-white/10 text-sm font-bold text-foreground">
                      {settings.payment_gateway.provider}
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 w-fit">
                      <Switch checked={settings.payment_gateway.is_live} onCheckedChange={v => updateGateway("is_live", v)} data-testid="gateway-live-toggle" />
                      <Label className="text-xs font-black uppercase tracking-wider cursor-pointer">
                        {settings.payment_gateway.is_live ? "Live Mode" : "Test Mode"}
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Key ID</Label>
                    <Input 
                      value={settings.payment_gateway.key_id} 
                      onChange={e => updateGateway("key_id", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-bold rounded-2xl focus:ring-brand-600/50" 
                      placeholder="Enter Razorpay Key ID"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Key Secret</Label>
                    <div className="relative">
                      <Input 
                        type={showSecret ? "text" : "password"} 
                        value={settings.payment_gateway.key_secret}
                        onChange={e => updateGateway("key_secret", e.target.value)}
                        className="h-12 bg-white/5 border-white/10 text-sm font-bold pr-12 rounded-2xl focus:ring-brand-600/50" 
                        placeholder="Enter key secret"
                      />
                      <button 
                        onClick={() => setShowSecret(!showSecret)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "storage" && (
            <section className="space-y-8 max-w-3xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                  <Cloud className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black tracking-tight text-foreground uppercase">Cloud Storage</h3>
                    <Badge className={`text-[9px] font-black uppercase tracking-widest border-none ${s3Configured ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {s3Configured ? "Connected" : "Not Linked"}
                    </Badge>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Media Assets Management</p>
                </div>
              </div>

              <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl space-y-6 group">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Access Key ID</Label>
                    <Input 
                      value={s3.access_key_id || ""} 
                      onChange={e => updateS3("access_key_id", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-mono rounded-2xl focus:ring-brand-600/50"
                      placeholder="AWS_ACCESS_KEY_ID" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Secret Access Key</Label>
                    <div className="relative">
                      <Input
                        type={showS3Secret ? "text" : "password"}
                        value={s3.secret_access_key || ""}
                        onChange={e => updateS3("secret_access_key", e.target.value)}
                        className="h-12 bg-white/5 border-white/10 text-sm font-mono pr-12 rounded-2xl focus:ring-brand-600/50"
                        placeholder="AWS_SECRET_ACCESS_KEY" 
                      />
                      <button 
                        onClick={() => setShowS3Secret(!showS3Secret)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showS3Secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Bucket Name</Label>
                    <Input 
                      value={s3.bucket_name || ""} 
                      onChange={e => updateS3("bucket_name", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-bold rounded-2xl focus:ring-brand-600/50"
                      placeholder="horizon-mnt-media" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Region</Label>
                    <select
                      value={s3.region || "ap-south-1"}
                      onChange={e => updateS3("region", e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-600/50 appearance-none transition-all"
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

                {s3Status && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-start gap-3 rounded-2xl p-4 text-sm font-bold border-none ${s3Status.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}
                  >
                    {s3Status.ok ? <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
                    <span>{s3Status.message}</span>
                  </motion.div>
                )}

                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    onClick={handleTestS3} 
                    disabled={testingS3 || !s3Configured} 
                    className="w-full h-12 rounded-2xl text-xs font-black uppercase tracking-widest gap-3 border-white/10 bg-white/5 hover:bg-white/10 text-foreground hover:text-brand-600 hover:border-brand-600/50 transition-all shadow-lg active:scale-95"
                  >
                    {testingS3 ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    ) : (
                      <Wifi className="h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "whatsapp" && (
            <section className="space-y-8 max-w-3xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                  <MessageCircle className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-foreground uppercase">WhatsApp Business</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Automated Enquiry Messaging</p>
                </div>
              </div>

              <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Phone Number ID</Label>
                    <Input 
                      value={settings.whatsapp?.phone_number_id || ""} 
                      onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, phone_number_id: e.target.value } }))}
                      className="h-12 bg-white/5 border-white/10 text-sm font-mono rounded-2xl focus:ring-brand-600/50" 
                      placeholder="123456789012345" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Business Phone</Label>
                    <div className="flex">
                      <span className="h-12 inline-flex items-center px-4 bg-white/10 border border-white/10 border-r-0 rounded-l-2xl text-[11px] font-black text-muted-foreground">+91</span>
                      <Input 
                        value={settings.whatsapp?.business_phone || ""} 
                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, business_phone: cleanPhone(e.target.value) } }))}
                        className="h-12 bg-white/5 border-white/10 text-sm font-bold rounded-l-none rounded-r-2xl focus:ring-brand-600/50" 
                        placeholder="98765 43210" 
                        maxLength={10} 
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Access Token</Label>
                  <div className="relative">
                    <Input 
                      type={showWaToken ? "text" : "password"} 
                      value={settings.whatsapp?.access_token || ""} 
                      onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, access_token: e.target.value } }))}
                      className="h-12 bg-white/5 border-white/10 text-sm font-mono pr-12 rounded-2xl focus:ring-brand-600/50" 
                      placeholder="EAAxxxxxxx..." 
                    />
                    <button 
                      onClick={() => setShowWaToken(!showWaToken)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "platform" && (
            <section className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                      <Percent className="h-6 w-6 text-brand-600" />
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-foreground uppercase">Revenue Share</h3>
                  </div>
                  
                  <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl space-y-6">
                    {[
                      { label: "Bookings", key: "booking_commission_pct", icon: CalendarCheck },
                      { label: "Coaching", key: "coaching_commission_pct", icon: GraduationCap },
                      { label: "Tournaments", key: "tournament_commission_pct", icon: Trophy }
                    ].map((comm, idx) => (
                      <div key={comm.key} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-white/5 text-muted-foreground group-hover:text-brand-600 transition-colors">
                            <comm.icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{comm.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            min={0} 
                            max={50} 
                            value={settings[comm.key] ?? 10}
                            onChange={e => setSettings(s => ({ ...s, [comm.key]: Number(e.target.value) }))}
                            className="h-10 bg-white/5 border-white/10 text-sm font-black w-20 rounded-xl focus:ring-brand-600/50 text-center" 
                          />
                          <span className="text-xs font-black text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                      <Crown className="h-6 w-6 text-brand-600" />
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-foreground uppercase">Service Limits</h3>
                  </div>
                  <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl flex items-center justify-center">
                    <p className="text-sm font-bold text-muted-foreground text-center px-4">Subscription plan quotas are configured in the section below.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                    <Crown className="h-6 w-6 text-brand-600" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-foreground uppercase">SaaS Subscription Models</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {settings.subscription_plans.map((plan, idx) => (
                    <div key={plan.id} className="glass-premium rounded-[32px] p-6 border border-white/5 shadow-xl space-y-6 relative overflow-hidden group">
                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-sm font-black tracking-tight uppercase text-brand-600">{plan.name}</span>
                        <Badge className="text-[8px] font-black uppercase tracking-widest bg-white/10 text-white border-none py-1 px-2 rounded-full">{plan.id}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 relative z-10">
                        <div>
                          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Monthly Rate</Label>
                          <div className="flex items-center">
                            <span className="text-lg font-black mr-1 text-muted-foreground">₹</span>
                            <Input 
                              type="number" 
                              value={plan.price} 
                              onChange={e => updatePlan(idx, "price", Number(e.target.value))}
                              className="h-9 bg-white/5 border-white/10 text-sm font-black rounded-lg focus:ring-brand-600/50" 
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Max Units</Label>
                          <Input 
                            type="number" 
                            value={plan.max_venues} 
                            onChange={e => updatePlan(idx, "max_venues", Number(e.target.value))}
                            className="h-9 bg-white/5 border-white/10 text-sm font-black rounded-lg focus:ring-brand-600/50" 
                          />
                        </div>
                      </div>

                      <div className="relative z-10">
                        <Label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Core Features</Label>
                        <textarea 
                          value={plan.features.join(", ")} 
                          onChange={e => updatePlan(idx, "features", e.target.value.split(",").map(f => f.trim()).filter(Boolean))}
                          className="w-full bg-white/5 border border-white/10 text-[10px] font-bold p-3 rounded-xl h-24 focus:outline-none focus:ring-2 focus:ring-brand-600/50 transition-all resize-none" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "security" && (
            <section className="space-y-8 max-w-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-brand-600/10 shadow-inner">
                  <ShieldCheck className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-foreground uppercase">Access Security</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Admin Credentials & Auth</p>
                </div>
              </div>

              <div className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl space-y-6">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 block">Reset Alpha Credentials</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password" 
                      className="h-12 bg-white/5 border-white/10 text-sm font-bold rounded-2xl focus:ring-brand-600/50" 
                    />
                    <Button 
                      onClick={handleChangePassword} 
                      disabled={changingPw || !newPassword} 
                      className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-white/10 text-foreground hover:bg-brand-600 transition-all shadow-lg active:scale-95"
                    >
                      {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Global Save */}
      <div className="pt-8 border-t border-white/5">
        <Button 
          onClick={saveSettings} 
          disabled={saving} 
          className="w-full h-14 bg-brand-600 hover:bg-brand-700 text-white font-black text-sm uppercase tracking-[0.2em] rounded-full shadow-2xl shadow-brand-600/40 transition-all hover:scale-[1.01] active:scale-95 group"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex items-center gap-3">
              <Save className="h-5 w-5 transition-transform group-hover:rotate-12" />
              Commit Global Configuration
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-8" data-testid="super-admin-dashboard">
      <div className="w-full py-6 flex flex-col gap-8 items-start">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-1">Admin Console</h1>
            <p className="text-sm text-muted-foreground">Horizon Platform Management</p>
          </div>

          <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col min-w-0" data-testid="admin-tabs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-6">
              <TabsList className="bg-transparent h-auto p-0 rounded-none space-x-8 flex items-center w-full justify-start overflow-x-auto hide-scrollbar">
                {["overview", "users", "venues", "settings"].map((tab) => (
                  <TabsTrigger key={tab} value={tab} 
                    className="relative pb-2 text-sm font-bold text-muted-foreground hover:text-foreground data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none transition-colors capitalize px-0" 
                    data-testid={`tab-${tab}`}>
                    {tab}
                    <TabsIndicator />
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <TabsContent value="overview" className="mt-0 outline-none w-full"><OverviewTab /></TabsContent>
            <TabsContent value="users" className="mt-0 outline-none w-full"><UsersTab /></TabsContent>
            <TabsContent value="venues" className="mt-0 outline-none w-full"><VenuesTab /></TabsContent>
            <TabsContent value="settings" className="mt-0 outline-none w-full"><SettingsTab /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function TabsIndicator() {
  return (
    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full opacity-0 transition-opacity [[data-state=active]_&]:opacity-100" />
  );
}
