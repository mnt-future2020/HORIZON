import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { adminAPI, uploadAPI, payoutAPI } from "@/lib/api";
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
  ImagePlus, X, MessageCircle, ShieldCheck,
  ChevronLeft, ChevronRight, Search
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSkeleton } from "@/components/SkeletonLoader";

const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

function StatCard({ icon: Icon, label, value, sub, colorClass = "text-brand-600", bgClass = "bg-brand-600/10", index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl sm:rounded-[28px] p-4 sm:p-6 lg:p-7 border border-border/40 shadow-sm overflow-hidden relative group h-full flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-6 relative z-10">
        <div className="admin-label text-xs sm:text-sm">{label}</div>
        <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${bgClass} flex items-center justify-center border border-border/40`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colorClass}`} />
        </div>
      </div>

      <div className="relative z-10">
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-foreground tracking-tight mb-1 sm:mb-2 flex items-baseline">
          {value}
        </div>
        {sub && (
          <div className="admin-label text-xs flex items-center gap-1.5 mt-1 sm:mt-2 bg-secondary/20 py-1 sm:py-1.5 px-2 sm:px-3 rounded-full w-fit border border-border/40">
            {sub}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RecentUserItem({ user: u, index }) {
  const roleColors = {
    venue_owner: "bg-purple-500/10 text-purple-600",
    coach: "bg-blue-500/10 text-blue-600",
    player: "bg-emerald-500/10 text-emerald-600",
    admin: "bg-brand-600/10 text-brand-600"
  };

  const statusColors = {
    active: "bg-green-500/10 text-green-600",
    pending: "bg-amber-500/10 text-amber-600",
    suspended: "bg-red-500/10 text-red-600",
    rejected: "bg-red-500/10 text-red-600"
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.05 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 hover:bg-white/5 transition-colors group rounded-xl sm:rounded-2xl gap-2 sm:gap-4"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base shrink-0 border border-white/5 ${roleColors[u.role] || "bg-brand-600/10 text-brand-600"}`}>
          {u.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="admin-name text-sm sm:text-base truncate">{u.name}</div>
          <div className="admin-secondary text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[200px]">{u.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 ml-12 sm:ml-0 shrink-0">
        <Badge variant="outline" className={`admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none text-[10px] sm:text-xs ${roleColors[u.role] || "bg-brand-600/10 text-brand-600"}`}>
          {u.role === "player" ? "Lobbian" : u.role.replace("_", " ")}
        </Badge>
        <Badge variant="outline" className={`admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none text-[10px] sm:text-xs ${statusColors[u.account_status] || "bg-secondary text-muted-foreground"}`}>
          {u.account_status}
        </Badge>
      </div>
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
    <div className="space-y-8 sm:space-y-10" data-testid="admin-overview-tab">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Total Users" value={data.total_users} index={0} />
        <StatCard icon={Building2} label="Active Venues" value={data.active_venues} index={1} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={data.total_bookings} index={2} />
        <StatCard icon={IndianRupee} label="Booking Revenue" value={`\u20B9${data.total_revenue.toLocaleString()}`} index={3} />
        
        <StatCard icon={Percent} label="Booking Share" value={`${data.commission_pct}%`} sub={`\u20B9${(data.platform_earnings || 0).toLocaleString()}`} index={4} />
        <StatCard icon={GraduationCap} label="Coach Revenue" value={`\u20B9${(data.coaching_revenue || 0).toLocaleString()}`} sub={`${data.coaching_commission_pct || 10}% = \u20B9${(data.coaching_earnings || 0).toLocaleString()}`} index={5} />
        <StatCard icon={Trophy} label="Tournament" value={`\u20B9${(data.tournament_revenue || 0).toLocaleString()}`} sub={`${data.tournament_commission_pct || 10}% = \u20B9${(data.tournament_earnings || 0).toLocaleString()}`} index={6} />
        
        <StatCard icon={Crown} label="Total Earnings" value={`\u20B9${(data.total_platform_earnings || 0).toLocaleString()}`} index={7} />
        <StatCard 
          icon={Clock} 
          label="Pending Approvals" 
          value={(data.pending_owners || 0) + (data.pending_coaches || 0)} 
          index={8}
          colorClass={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "text-amber-500" : "text-brand-600"} 
          bgClass={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "bg-amber-500/10" : "bg-brand-600/10"}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-1 sm:px-2">
          <h3 className="admin-section-label text-[11px] sm:text-xs">Recent Registrations</h3>
          <div className="h-[1px] flex-1 bg-border/40 ml-4 sm:ml-6" />
        </div>

        <div className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] p-1.5 sm:p-2 shadow-sm">
          <div className="p-1 sm:p-2 space-y-0.5 sm:space-y-1">
            {data.recent_users.map((u, i) => (
              <RecentUserItem key={u.id} user={u} index={i} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function UsersTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10));
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const LIMIT = 10;
  const filterChangedRef = useRef(false);
  // Document viewer state
  const [docViewUserId, setDocViewUserId] = useState(null);
  const [docViewData, setDocViewData] = useState(null);
  const [docViewLoading, setDocViewLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectMode, setRejectMode] = useState(false);

  const load = useCallback((p = 1) => {
    setLoading(true);
    const params = { page: p, limit: LIMIT };
    if (filter === "pending") params.status = "pending";
    else if (filter !== "all") params.role = filter;
    adminAPI.users(params).then(r => {
      const data = r.data || {};
      setUsers(data.users || []);
      setTotalPages(data.pages || 1);
      setTotalUsers(data.total || 0);
      setPage(data.page || p);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  // Mount: load URL-restored page
  useEffect(() => {
    load(page);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter change: reset to page 1 (skip on initial mount)
  useEffect(() => {
    if (!filterChangedRef.current) { filterChangedRef.current = true; return; }
    setPage(1);
    load(1);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filter + page → URL (preserve other params)
  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (filter !== "all") p.set("filter", filter); else p.delete("filter");
      if (page > 1) p.set("page", String(page)); else p.delete("page");
      return p;
    }, { replace: true });
  }, [filter, page, setSearchParams]);

  const handleAction = async (userId, action) => {
    try {
      if (action === "approve") await adminAPI.approveUser(userId);
      else if (action === "reject") await adminAPI.rejectUser(userId, "");
      else if (action === "suspend") await adminAPI.suspendUser(userId);
      else if (action === "activate") await adminAPI.activateUser(userId);
      toast.success(`User ${action}d`);
      load(page);
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
  const COACH_DOC_LABELS = {
    government_id: "Government ID (Aadhaar/PAN/Passport)",
    coaching_certification: "Coaching Certification",
    federation_membership: "Federation Membership",
    profile_photo: "Professional Photo",
    playing_experience: "Playing Experience Proof",
    first_aid_certificate: "First Aid / CPR Certificate",
    fitness_certificate: "Fitness Certificate",
    background_check: "Background / Police Check",
    qualification_proof: "Qualification Proof",
  };

function UserItem({ user: u, index, onAction, onVerify, onOpenDocs }) {
  const roleColors = {
    venue_owner: "bg-purple-500/10 text-purple-600",
    coach: "bg-blue-500/10 text-blue-600",
    player: "bg-brand-500/10 text-brand-600",
    admin: "bg-brand-600/10 text-brand-600"
  };

  const statusColors = {
    active: "bg-green-500/10 text-green-600",
    pending: "bg-amber-500/10 text-amber-600",
    suspended: "bg-red-500/10 text-red-600",
    rejected: "bg-red-500/10 text-red-600"
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex flex-col md:flex-row md:items-center justify-between p-3 sm:p-4 hover:bg-secondary/30 transition-colors rounded-xl sm:rounded-2xl group gap-3"
    >
      {/* User info row */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base shrink-0 ${roleColors[u.role] || "bg-brand-600/10 text-brand-600"}`}>
          {u.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h4 className="admin-name text-sm sm:text-base truncate max-w-[140px] sm:max-w-none">{u.name}</h4>
            <Badge variant="outline" className={`admin-badge h-5 rounded-full border-none px-2 sm:px-2.5 text-[10px] sm:text-xs ${roleColors[u.role] || "bg-brand-600/10 text-brand-600"}`}>
              {u.role === "player" ? "Lobbian" : u.role.replace("_", " ")}
            </Badge>
            {/* Status indicator - inline on mobile */}
            <div className="flex items-center gap-1 md:hidden">
              <div className={`w-1.5 h-1.5 rounded-full ${
                u.account_status === "active" ? "bg-green-500" :
                u.account_status === "pending" ? "bg-amber-500" : "bg-red-500"
              }`} />
              <span className={`text-[10px] font-medium capitalize ${
                u.account_status === "active" ? "text-green-600" :
                u.account_status === "pending" ? "text-amber-600" : "text-red-500"
              }`}>{u.account_status}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 admin-secondary text-xs sm:text-sm">
            <span className="truncate max-w-[120px] sm:max-w-none">{u.email}</span>
            {u.phone && (
              <>
                <span className="opacity-40 hidden sm:inline">•</span>
                <span className="hidden sm:flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span>
              </>
            )}
            {u.business_name && (
              <>
                <span className="opacity-40 hidden sm:inline">•</span>
                <span className="hidden sm:flex items-center gap-1"><Building2 className="w-3 h-3" /> {u.business_name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-12 md:ml-0 flex-wrap">
        {/* Status indicator - desktop only */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${
            u.account_status === "active" ? "bg-green-500" :
            u.account_status === "pending" ? "bg-amber-500" :
            u.account_status === "suspended" ? "bg-red-500" :
            u.account_status === "rejected" ? "bg-red-500" : "bg-gray-400"
          }`} />
          <span className={`text-xs font-medium capitalize ${
            u.account_status === "active" ? "text-green-600" :
            u.account_status === "pending" ? "text-amber-600" :
            "text-red-500"
          }`}>{u.account_status}</span>
        </div>

        {u.role === "venue_owner" && u.subscription_plan && (
          <span className="text-[10px] sm:text-xs text-purple-600 font-medium bg-purple-500/10 px-2 py-0.5 rounded-md">{u.subscription_plan}</span>
        )}

        {/* Grouped action toolbar */}
        <div className="flex items-center bg-secondary/30 rounded-lg sm:rounded-xl overflow-hidden border border-border/30">
          {(u.role === "venue_owner" || u.role === "coach") && u.doc_verification_status && u.doc_verification_status !== "not_uploaded" && (
            <button
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors border-r border-border/30 min-h-[36px] ${
                u.doc_verification_status === "pending_review" ? "text-amber-600 hover:bg-amber-500/10" :
                u.doc_verification_status === "verified" ? "text-brand-600 hover:bg-brand-600/10" :
                "text-rose-500 hover:bg-rose-500/10"
              }`}
              onClick={() => onOpenDocs(u.id)}>
              <FileText className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Docs</span>
            </button>
          )}

          {u.account_status === "pending" && u.role !== "venue_owner" && u.role !== "coach" && (
            <>
              <button className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-brand-600 hover:bg-brand-600/10 transition-colors border-r border-border/30 min-h-[36px]"
                onClick={() => onAction(u.id, "approve")}>
                <CheckCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Approve</span>
              </button>
              <button className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors min-h-[36px]"
                onClick={() => onAction(u.id, "reject")}>
                <XCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reject</span>
              </button>
            </>
          )}

          {u.account_status === "pending" && (u.role === "venue_owner" || u.role === "coach") && (
            <span className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[36px] ${u.doc_verification_status === "pending_review" ? "text-amber-600" : "text-blue-600"}`}>
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{u.doc_verification_status === "pending_review" ? "Docs Submitted" : "Awaiting Docs"}</span>
              <span className="sm:hidden">{u.doc_verification_status === "pending_review" ? "Docs" : "Wait"}</span>
            </span>
          )}

          {u.account_status === "active" && (
            <button className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-amber-600 hover:bg-amber-500/10 transition-colors min-h-[36px]"
              onClick={() => onAction(u.id, "suspend")}>
              <Ban className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Suspend</span>
            </button>
          )}

          {u.role === "coach" && u.account_status === "active" && (
            <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 border-l border-border/30 min-h-[36px]">
              <span className={`text-[11px] sm:text-xs font-medium hidden sm:inline ${u.is_verified ? "text-brand-600" : "text-muted-foreground"}`}>
                {u.is_verified ? "Verified" : "Verify"}
              </span>
              <Switch
                checked={u.is_verified}
                onCheckedChange={() => onVerify(u.id)}
                className="scale-75 origin-right data-[state=checked]:bg-brand-600"
              />
            </div>
          )}

          {(u.account_status === "suspended" || u.account_status === "rejected") && (
            <button className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-brand-600 hover:bg-brand-600/10 transition-colors min-h-[36px]"
              onClick={() => onAction(u.id, "activate")}>
              <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Activate</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

  return (
    <div className="space-y-4" data-testid="admin-users-tab">
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
        {["all", "pending", "player", "venue_owner", "coach"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} data-testid={`filter-${f}`}
            className={`px-3 sm:px-5 py-2 rounded-full admin-btn transition-all duration-300 active:scale-95 text-[11px] sm:text-xs min-h-[36px] ${
              filter === f
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
            }`}>
            {f === "all" ? "All" : f === "pending" ? "Pending" : f === "player" ? "Lobbian" : f.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 text-brand-600 animate-spin" /></div>
      ) : users.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] p-12 sm:p-20 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px]"
        >
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-secondary/30 mb-4 sm:mb-6">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
          </div>
          <div className="text-muted-foreground text-xs sm:text-sm font-medium">No users found matching this filter</div>
        </motion.div>
      ) : (
        <div className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] p-1.5 sm:p-2 shadow-sm">
          <div className="divide-y divide-border/30">
            {users.map((u, i) => (
              <UserItem
                key={u.id}
                user={u}
                index={i}
                onAction={handleAction}
                onVerify={handleVerify}
                onOpenDocs={openDocViewer}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 px-2 gap-3">
          <span className="admin-section-label text-[11px] sm:text-xs">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, totalUsers)} of {totalUsers}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-muted-foreground/50 text-xs">...</span>
                ) : (
                  <button key={p} onClick={() => load(p)}
                    className={`h-9 min-w-[36px] px-2 rounded-xl admin-btn transition-all ${
                      p === page
                        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}>
                    {p}
                  </button>
                )
              )}
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Document Viewer Dialog */}
      <Dialog open={!!docViewUserId} onOpenChange={(open) => { if (!open) setDocViewUserId(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto rounded-[28px] p-0">
          <DialogHeader className="border-b border-border/40 pb-4 px-7 pt-7">
            <DialogTitle className="admin-heading">Verification Documents</DialogTitle>
            <DialogDescription className="admin-label mt-1">
              {docViewData?.name} {docViewData?.business_name && <span className="text-foreground"> — {docViewData.business_name}</span>}
            </DialogDescription>
          </DialogHeader>

          {docViewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin border-brand-600" /></div>
          ) : docViewData ? (
            <div className="space-y-5 px-7 py-5">
              <Badge className={`admin-btn px-3 py-1.5 rounded-lg border-0 ${
                docViewData.doc_verification_status === "pending_review" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                docViewData.doc_verification_status === "verified" ? "bg-brand-600 hover:bg-brand-600 text-white" :
                docViewData.doc_verification_status === "rejected" ? "bg-destructive hover:bg-destructive text-white" :
                "bg-secondary hover:bg-secondary text-muted-foreground"
              }`}>{docViewData.doc_verification_status?.replace("_", " ") || "unknown"}</Badge>

              {docViewData.doc_rejection_reason && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <span className="font-medium">Previous rejection:</span> {docViewData.doc_rejection_reason}
                </div>
              )}

              {/* Document grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(docViewData.role === "coach" ? COACH_DOC_LABELS : DOC_LABELS).map(([key, label]) => {
                  const doc = docViewData.role === "coach"
                    ? docViewData.coach_verification_documents?.[key]
                    : docViewData.verification_documents?.[key];
                  const isPdf = doc?.url?.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={key} className="bg-secondary/20 border border-border/50 rounded-xl p-4 transition-colors hover:bg-secondary/40">
                      <Label className="admin-section-label text-brand-600">{label}</Label>
                      {doc?.url ? (
                        isPdf ? (
                          <a href={mediaUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-brand-600/5 text-sm font-medium text-brand-600 border border-brand-600/20 hover:bg-brand-600/10 transition-colors">
                            <FileText className="h-4 w-4" /> View PDF
                          </a>
                        ) : (
                          <img src={mediaUrl(doc.url)} alt={label}
                            className="mt-2 rounded max-h-40 w-full object-contain cursor-pointer bg-background/50"
                            onClick={() => window.open(mediaUrl(doc.url), "_blank")} />
                        )
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground/60 py-4 text-center">Not uploaded</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Turf images */}
              {docViewData.verification_documents?.turf_images?.length > 0 && (
                <div>
                  <Label className="admin-section-label text-brand-600">Turf Images</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {docViewData.verification_documents.turf_images.map((img, i) => (
                      <img key={i} src={mediaUrl(img.url || img)} alt={`Turf ${i + 1}`}
                        className="w-20 h-20 rounded-xl object-cover cursor-pointer border border-border/40 hover:border-brand-600/40 transition-colors"
                        onClick={() => window.open(mediaUrl(img.url || img), "_blank")} />
                    ))}
                  </div>
                </div>
              )}

              {/* Turf videos */}
              {docViewData.verification_documents?.turf_videos?.length > 0 && (
                <div>
                  <Label className="admin-section-label text-brand-600">Turf Videos</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {docViewData.verification_documents.turf_videos.map((vid, i) => (
                      <video key={i} src={mediaUrl(vid.url || vid)} controls className="w-40 h-28 rounded-md object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {/* Coach: experience letters */}
              {docViewData.role === "coach" && docViewData.coach_verification_documents?.experience_letters?.length > 0 && (
                <div>
                  <Label className="admin-section-label text-brand-600">Experience Letters</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {docViewData.coach_verification_documents.experience_letters.map((doc, i) => (
                      <a key={i} href={mediaUrl(doc.url || doc)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-brand-600/5 text-sm font-medium text-brand-600 border border-brand-600/20 hover:bg-brand-600/10 transition-colors">
                        <FileText className="h-4 w-4" /> Letter {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {docViewData.doc_verification_status === "pending_review" && (
                <div className="border-t border-border pt-4 space-y-3">
                  {!rejectMode ? (
                    <div className="flex gap-3">
                      <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn h-11 rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                        onClick={() => handleVerifyDocs(docViewUserId)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Verify & Approve
                      </Button>
                      <Button variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 admin-btn h-11 rounded-xl"
                        onClick={() => setRejectMode(true)}>
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="admin-section-label ml-1">Rejection Reason (required)</Label>
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
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-card rounded-2xl sm:rounded-[28px] p-4 sm:p-6 mb-3 sm:mb-4 shadow-sm group relative overflow-hidden transition-all duration-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 relative z-10">
        {/* Venue Thumbnail + mobile header */}
        <div className="flex items-center gap-3 sm:block">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 bg-muted/20">
            {mainImage ? (
              <img src={mediaUrl(mainImage)} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-600/5">
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-brand-600/30" />
              </div>
            )}
          </div>
          {/* Mobile: name + badges inline with thumbnail */}
          <div className="sm:hidden flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="admin-name text-sm truncate">{v.name}</h4>
              <Badge variant="outline" className={`admin-badge h-5 rounded-full border-none text-[10px] px-2 ${
                v.badge === "bookable" ? "bg-brand-600/10 text-brand-600" : "bg-amber-500/10 text-amber-600"
              }`}>
                {v.badge === "bookable" ? "Bookable" : "Enquiry"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium line-clamp-1 opacity-80">{v.address}{v.address && ", "}{v.city}</p>
          </div>
          {/* Mobile: toggle */}
          <div className="sm:hidden flex items-center gap-2 shrink-0">
            <Switch checked={v.status === "active"} onCheckedChange={() => onToggle(v.id, v.status)} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Desktop: name + badges */}
          <div className="hidden sm:flex items-center gap-3 mb-2">
            <h4 className="admin-name truncate">{v.name}</h4>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={`admin-badge h-5 rounded-full border-none ${
                v.badge === "bookable" ? "bg-brand-600/10 text-brand-600" : "bg-amber-500/10 text-amber-600"
              }`}>
                {v.badge === "bookable" ? "Bookable" : "Enquiry"}
              </Badge>
              {v.owner_id ? (
                <Badge variant="outline" className="admin-badge h-5 rounded-full border-none bg-brand-600/10 text-brand-600">
                  Linked
                </Badge>
              ) : (
                <Badge variant="outline" className="admin-badge h-5 rounded-full border-none bg-secondary/30 text-muted-foreground">
                  Manual
                </Badge>
              )}
            </div>
          </div>

          <p className="hidden sm:block text-xs text-muted-foreground font-medium mb-4 line-clamp-1 opacity-80">{v.address}{v.address && ", "}{v.city}</p>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {v.sports?.map(sport => (
              <span key={sport} className="admin-badge bg-secondary/20 text-muted-foreground py-0.5 sm:py-1 px-2 sm:px-3 rounded-full border border-border/40 text-[10px] sm:text-xs">
                {sport}
              </span>
            ))}
            <div className="h-3 sm:h-4 w-[1px] bg-border/40 mx-0.5 sm:mx-1" />
            <span className="admin-label opacity-60 flex items-center gap-1 text-[10px] sm:text-sm">
              <Crown className="w-3 h-3" /> {v.turfs}
            </span>
            <span className="admin-label opacity-60 flex items-center gap-1 text-[10px] sm:text-sm">
              <CalendarCheck className="w-3 h-3" /> {v.total_bookings}
            </span>
            {v.contact_phone && (
              <span className="admin-label opacity-60 hidden sm:flex items-center gap-1">
                <Phone className="w-3 h-3" /> {v.contact_phone}
              </span>
            )}
          </div>
        </div>

        {/* Actions Section - desktop */}
        <div className="hidden sm:flex flex-col items-end justify-between self-stretch gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`admin-btn capitalize ${v.status === "active" ? "text-brand-600" : "text-rose-500"}`}>
              {v.status === "active" ? "Live" : "Inactive"}
            </span>
            <Switch checked={v.status === "active"} onCheckedChange={() => onToggle(v.id, v.status)} />
          </div>

          {!v.owner_id && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-4 admin-btn rounded-full border-border/40 bg-card hover:bg-brand-600/10 hover:text-brand-600 hover:border-brand-600/30 transition-all shadow-sm"
              onClick={() => onAssign(v)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-2" /> Assign Owner
            </Button>
          )}
        </div>

        {/* Mobile: assign owner button */}
        {!v.owner_id && (
          <Button
            size="sm"
            variant="outline"
            className="sm:hidden w-full h-9 admin-btn rounded-xl border-border/40 bg-card hover:bg-brand-600/10 hover:text-brand-600 hover:border-brand-600/30 transition-all"
            onClick={() => onAssign(v)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-2" /> Assign Owner
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function VenuesTab() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVenues, setTotalVenues] = useState(0);
  const LIMIT = 10;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const SPORTS_OPTIONS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball", "Table Tennis"];
  const AMENITIES_OPTIONS = ["Parking", "Washroom", "Changing Room", "Drinking Water", "Floodlights", "Cafeteria", "First Aid", "WiFi", "Seating Area", "Scoreboard"];
  const [venueForm, setVenueForm] = useState({ name: "", description: "", address: "", area: "", city: "", sports: [], amenities: [], turfs: 1, opening_hour: 6, closing_hour: 23, slot_duration_minutes: 60, contact_phone: "", images: [] });
  const toggleFormArray = (field, val) => setVenueForm(p => ({ ...p, [field]: p[field].includes(val) ? p[field].filter(v => v !== val) : [...p[field], val] }));
  const [uploading, setUploading] = useState(false);
  // Assign owner
  const [assignDialog, setAssignDialog] = useState(null); // venue object or null
  const [venueOwners, setVenueOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [useOwnerPhone, setUseOwnerPhone] = useState(false);
  const [confirmAssign, setConfirmAssign] = useState(false);

  const load = useCallback((p = 1) => {
    setLoading(true);
    adminAPI.venues({ page: p, limit: LIMIT }).then(r => {
      const data = r.data || {};
      setVenues(data.venues || []);
      setTotalPages(data.pages || 1);
      setTotalVenues(data.total || 0);
      setPage(data.page || p);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleVenue = async (venueId, currentStatus) => {
    try {
      if (currentStatus === "active") await adminAPI.suspendVenue(venueId);
      else await adminAPI.activateVenue(venueId);
      toast.success(`Venue ${currentStatus === "active" ? "suspended" : "activated"}`);
      load(page);
    } catch { toast.error("Failed to update venue"); }
  };

  const handleCreateVenue = async () => {
    if (!venueForm.name.trim() || !venueForm.city.trim()) { toast.error("Name and city are required"); return; }
    setCreating(true);
    try {
      await adminAPI.createVenue(venueForm);
      toast.success("Venue created (Enquiry mode)");
      setShowCreateDialog(false);
      setVenueForm({ name: "", description: "", address: "", city: "", sports: ["football"], turfs: 1, contact_phone: "", images: [] });
      load(1);
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
      load(page);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to assign owner"); }
    finally { setAssigning(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-3" data-testid="admin-venues-tab">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h2 className="admin-heading text-base sm:text-lg">Venues</h2>
          <p className="admin-label mt-0.5 sm:mt-1 text-xs">{totalVenues} Managed</p>
        </div>
        <Button size="sm" className="gap-1.5 sm:gap-2 h-9 sm:h-10 px-3 sm:px-5 admin-btn rounded-full shadow-lg shadow-brand-600/20 transition-all hover:scale-105 hover:bg-brand-500 active:scale-95 bg-brand-600 text-white text-[11px] sm:text-xs" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add New</span> Venue
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 px-2 gap-3">
          <span className="admin-section-label text-[11px] sm:text-xs">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, totalVenues)} of {totalVenues}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-muted-foreground/50 text-xs">...</span>
                ) : (
                  <button key={p} onClick={() => load(p)}
                    className={`h-9 min-w-[36px] px-2 rounded-xl admin-btn transition-all ${
                      p === page
                        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}>
                    {p}
                  </button>
                )
              )}
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Venue Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-[28px] p-0">
          <DialogHeader className="border-b border-border/40 pb-4 px-7 pt-7">
            <DialogTitle className="flex items-center gap-3 admin-heading">
              <div className="p-2.5 rounded-2xl bg-brand-600/10">
                <Building2 className="h-5 w-5 text-brand-600" />
              </div> 
              Add Venue <span className="admin-badge px-2.5 py-1 rounded-lg border border-border/60 bg-secondary/50 ml-2 hidden sm:inline-block">Enquiry Mode</span>
            </DialogTitle>
            <DialogDescription className="admin-label mt-2">This venue will be in Enquiry mode until an owner is assigned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-7 py-5">
            <div>
              <Label className="admin-section-label ml-1">Venue Name *</Label>
              <Input value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))} placeholder="PowerPlay Arena" className="mt-1.5 h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />
            </div>
            <div>
              <Label className="admin-section-label ml-1">Description</Label>
              <Textarea value={venueForm.description} onChange={e => setVenueForm(p => ({ ...p, description: e.target.value }))} placeholder="Premium sports facility..." className="mt-1.5 rounded-xl bg-secondary/20 border-border/40 px-4 py-3 font-medium" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="admin-section-label ml-1">Address</Label>
                <Input value={venueForm.address} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main Street" className="mt-1.5 h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />
              </div>
              <div>
                <Label className="admin-section-label ml-1">Area</Label>
                <Input value={venueForm.area} onChange={e => setVenueForm(p => ({ ...p, area: e.target.value }))} placeholder="Koramangala" className="mt-1.5 h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />
              </div>
            </div>
            <div>
              <Label className="admin-section-label ml-1">City *</Label>
              <Input value={venueForm.city} onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))} placeholder="Bengaluru" className="mt-1.5 h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />
            </div>
            {/* Sports */}
            <div>
              <Label className="admin-section-label ml-1">Sports *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SPORTS_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => toggleFormArray("sports", s.toLowerCase())}
                    className={`px-3 py-1.5 rounded-xl admin-btn border transition-colors ${venueForm.sports.includes(s.toLowerCase()) ? "bg-brand-600/10 text-brand-600 border-brand-600" : "bg-secondary/20 text-muted-foreground border-border/40 hover:border-brand-600/50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {/* Amenities */}
            <div>
              <Label className="admin-section-label ml-1">Amenities</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {AMENITIES_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => toggleFormArray("amenities", a)}
                    className={`px-3 py-1.5 rounded-xl admin-btn border transition-colors ${venueForm.amenities.includes(a) ? "bg-brand-600/10 text-brand-600 border-brand-600" : "bg-secondary/20 text-muted-foreground border-border/40 hover:border-brand-600/50"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="admin-section-label ml-1">Number of Turfs</Label>
              <Input type="number" value={venueForm.turfs} onChange={e => setVenueForm(p => ({ ...p, turfs: Number(e.target.value) }))} className="mt-1.5 h-11 rounded-xl bg-secondary/20 border-border/40 px-4 font-medium" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <Label className="admin-section-label ml-1 text-[10px] sm:text-xs">Open</Label>
                <Input type="number" min={0} max={23} value={venueForm.opening_hour} onChange={e => setVenueForm(p => ({ ...p, opening_hour: Number(e.target.value) }))} className="mt-1.5 h-10 sm:h-11 rounded-xl bg-secondary/20 border-border/40 px-3 sm:px-4 font-medium text-sm" />
              </div>
              <div>
                <Label className="admin-section-label ml-1 text-[10px] sm:text-xs">Close</Label>
                <Input type="number" min={0} max={23} value={venueForm.closing_hour} onChange={e => setVenueForm(p => ({ ...p, closing_hour: Number(e.target.value) }))} className="mt-1.5 h-10 sm:h-11 rounded-xl bg-secondary/20 border-border/40 px-3 sm:px-4 font-medium text-sm" />
              </div>
              <div>
                <Label className="admin-section-label ml-1 text-[10px] sm:text-xs">Slot (min)</Label>
                <Input type="number" value={venueForm.slot_duration_minutes} onChange={e => setVenueForm(p => ({ ...p, slot_duration_minutes: Number(e.target.value) }))} className="mt-1.5 h-10 sm:h-11 rounded-xl bg-secondary/20 border-border/40 px-3 sm:px-4 font-medium text-sm" />
              </div>
            </div>
            <div>
              <Label className="admin-section-label ml-1">Owner's WhatsApp Number</Label>
              <div className="flex mt-1.5">
                <span className="inline-flex items-center px-3 bg-secondary/20 border border-r-0 border-border/40 rounded-l-xl admin-label select-none">+91</span>
                <Input value={venueForm.contact_phone} onChange={e => setVenueForm(p => ({ ...p, contact_phone: cleanPhone(e.target.value) }))} placeholder="98765 43210" className="rounded-l-none h-11 rounded-r-xl bg-secondary/20 border-border/40 px-4 font-medium" maxLength={10} />
              </div>
              <p className="admin-label mt-1.5 ml-1">Enquiries from Lobbians will be sent to this WhatsApp number.</p>
            </div>
            {/* Image upload */}
            <div className="space-y-2">
              <Label className="admin-section-label ml-1">Venue Images</Label>
              {venueForm.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {venueForm.images.map((url, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-border/40">
                      <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setVenueForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors admin-label ${uploading ? "opacity-60 pointer-events-none border-border/40" : "border-brand-600/30 hover:border-brand-600 text-muted-foreground hover:text-brand-600"}`}>
                {uploading ? <><div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Uploading...</> : <><ImagePlus className="h-4 w-4" />{venueForm.images.length > 0 ? "Add more images" : "Upload venue images"}</>}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} disabled={uploading} />
              </label>
            </div>
            <Button className="w-full h-12 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleCreateVenue} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Venue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Owner Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(o) => !o && setAssignDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[28px] p-0">
          <DialogHeader className="border-b border-border/40 pb-4 px-7 pt-7">
            <DialogTitle className="flex items-center gap-3 admin-heading">
              <div className="p-2.5 rounded-2xl bg-brand-600/10">
                <UserPlus className="h-5 w-5 text-brand-600" />
              </div> 
              Assign Owner
            </DialogTitle>
            <DialogDescription className="admin-label mt-2">Assign a verified venue owner to <span className="text-foreground font-medium">"{assignDialog?.name}"</span>. This will change the badge from Enquiry to Bookable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-7 py-5">
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
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Are you sure?
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
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
                <Button variant="outline" className="flex-1 admin-btn rounded-xl h-11" onClick={() => setConfirmAssign(false)}>
                  Go Back
                </Button>
              )}
              <Button className={`${confirmAssign ? "flex-1" : "w-full"} h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all`} onClick={handleAssignOwner} disabled={assigning || !selectedOwner}>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showS3Secret, setShowS3Secret] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [s3Status, setS3Status] = useState(null); // null | {ok, message}
  const [activeSubTab, setActiveSubTab] = useState(searchParams.get("subtab") || "payments");

  useEffect(() => {
    adminAPI.getSettings().then(r => setSettings(r.data)).catch(() => toast.error("Failed to load settings"));
  }, []);

  // Sync activeSubTab → URL (preserve other params)
  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (activeSubTab !== "payments") p.set("subtab", activeSubTab); else p.delete("subtab");
      return p;
    }, { replace: true });
  }, [activeSubTab, setSearchParams]);

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
    <div className="space-y-6 sm:space-y-8 max-w-4xl pb-10" data-testid="admin-settings-tab">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 glass-premium rounded-xl sm:rounded-2xl w-full sm:w-fit mb-6 sm:mb-8 border border-white/5 overflow-x-auto hide-scrollbar">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl admin-btn transition-all duration-300 min-h-[36px] shrink-0 ${
              activeSubTab === tab.id
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20 active:scale-95"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <tab.icon className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${activeSubTab === tab.id ? "text-white" : "text-muted-foreground"}`} />
            <span className="hidden sm:inline">{tab.label}</span>
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
            <section className="space-y-6 sm:space-y-8 max-w-3xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="admin-heading text-base sm:text-lg">Payment Gateway</h3>
                  <p className="admin-label mt-0.5 text-xs">Global Transaction Settings</p>
                </div>
              </div>

              <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl space-y-5 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Provider</Label>
                    <div className="h-12 flex items-center px-4 bg-white/5 rounded-2xl border border-white/10 text-sm font-medium text-foreground">
                      {settings.payment_gateway.provider}
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 w-fit">
                      <Switch checked={settings.payment_gateway.is_live} onCheckedChange={v => updateGateway("is_live", v)} data-testid="gateway-live-toggle" />
                      <Label className="text-xs font-medium cursor-pointer">
                        {settings.payment_gateway.is_live ? "Live Mode" : "Test Mode"}
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Key ID</Label>
                    <Input 
                      value={settings.payment_gateway.key_id} 
                      onChange={e => updateGateway("key_id", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-bold rounded-2xl focus:ring-brand-600/50" 
                      placeholder="Enter Razorpay Key ID"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Key Secret</Label>
                    <div className="relative">
                      <Input 
                        type={showSecret ? "text" : "password"} 
                        value={settings.payment_gateway.key_secret}
                        onChange={e => updateGateway("key_secret", e.target.value)}
                        className="h-12 bg-white/5 border-white/10 text-sm font-medium rounded-2xl focus:ring-brand-600/50" 
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

                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Webhook Secret</Label>
                  <div className="relative">
                    <Input
                      type={showWebhookSecret ? "text" : "password"}
                      value={settings.payment_gateway.webhook_secret || ""}
                      onChange={e => updateGateway("webhook_secret", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-bold pr-12 rounded-2xl focus:ring-brand-600/50"
                      placeholder="Enter Razorpay webhook secret"
                      data-testid="gateway-webhook-secret"
                    />
                    <button
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Found in Razorpay Dashboard → Webhooks → Secret</p>
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "storage" && (
            <section className="space-y-6 sm:space-y-8 max-w-3xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                  <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h3 className="admin-heading text-base sm:text-lg">Cloud Storage</h3>
                    <Badge className={`admin-badge border-none text-[10px] sm:text-xs ${s3Configured ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {s3Configured ? "Connected" : "Not Linked"}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Media Assets Management</p>
                </div>
              </div>

              <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl space-y-5 sm:space-y-6 group">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Access Key ID</Label>
                    <Input 
                      value={s3.access_key_id || ""} 
                      onChange={e => updateS3("access_key_id", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-mono rounded-2xl focus:ring-brand-600/50"
                      placeholder="AWS_ACCESS_KEY_ID" 
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Secret Access Key</Label>
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
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Bucket Name</Label>
                    <Input 
                      value={s3.bucket_name || ""} 
                      onChange={e => updateS3("bucket_name", e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-sm font-medium rounded-2xl focus:ring-brand-600/50"
                      placeholder="horizon-mnt-media" 
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Region</Label>
                    <select
                      value={s3.region || "ap-south-1"}
                      onChange={e => updateS3("region", e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-600/50 appearance-none transition-all"
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
                    className={`flex items-start gap-3 rounded-2xl p-4 text-sm font-medium border-none ${s3Status.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}
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
                    className="w-full h-12 rounded-2xl text-xs font-medium tracking-wide gap-3 border-white/10 bg-white/5 hover:bg-white/10 text-foreground hover:text-brand-600 hover:border-brand-600/50 transition-all shadow-lg active:scale-95"
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
            <section className="space-y-6 sm:space-y-8 max-w-3xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="admin-heading text-base sm:text-lg">WhatsApp Business</h3>
                  <p className="admin-label mt-0.5 text-xs">Automated Enquiry Messaging</p>
                </div>
              </div>

              <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl space-y-5 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Phone Number ID</Label>
                    <Input 
                      value={settings.whatsapp?.phone_number_id || ""} 
                      onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, phone_number_id: e.target.value } }))}
                      className="h-12 bg-white/5 border-white/10 text-sm font-mono rounded-2xl focus:ring-brand-600/50" 
                      placeholder="123456789012345" 
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Business Phone</Label>
                    <div className="flex">
                      <span className="h-12 inline-flex items-center px-4 bg-white/10 border border-white/10 border-r-0 rounded-l-2xl text-xs font-medium text-muted-foreground">+91</span>
                      <Input 
                        value={settings.whatsapp?.business_phone || ""} 
                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, business_phone: cleanPhone(e.target.value) } }))}
                        className="h-12 bg-white/5 border-white/10 text-sm font-medium rounded-l-none rounded-r-2xl focus:ring-brand-600/50" 
                        placeholder="98765 43210" 
                        maxLength={10} 
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Access Token</Label>
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
            <section className="space-y-8 sm:space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                      <Percent className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                    </div>
                    <h3 className="admin-heading text-base sm:text-lg">Revenue Share</h3>
                  </div>

                  <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl space-y-5 sm:space-y-6">
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
                          <span className="admin-label">{comm.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            min={0} 
                            max={50} 
                            value={settings[comm.key] ?? 10}
                            onChange={e => setSettings(s => ({ ...s, [comm.key]: Number(e.target.value) }))}
                            className="h-10 bg-white/5 border-white/10 text-sm font-medium w-20 rounded-xl focus:ring-brand-600/50 text-center" 
                          />
                          <span className="admin-label">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                      <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                    </div>
                    <h3 className="admin-heading text-base sm:text-lg">Service Limits</h3>
                  </div>
                  <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl flex items-center justify-center">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground text-center px-4">Subscription plan quotas are configured in the section below.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                    <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                  </div>
                  <h3 className="admin-heading text-base sm:text-lg">SaaS Subscription Models</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {settings.subscription_plans.map((plan, idx) => (
                    <div key={plan.id} className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-6 border border-white/5 shadow-xl space-y-4 sm:space-y-6 relative overflow-hidden group">
                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-sm font-medium tracking-tight text-brand-600">{plan.name}</span>
                        <Badge className="text-xs font-medium uppercase tracking-wide bg-brand-600/10 text-brand-600 border-none py-1 px-2 rounded-full transition-colors hover:bg-brand-600 hover:text-white pointer-events-none">{plan.id}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 relative z-10">
                        <div>
                          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">Monthly Rate</Label>
                          <div className="flex items-center">
                            <span className="text-lg font-medium mr-1 text-muted-foreground">₹</span>
                            <Input 
                              type="number" 
                              value={plan.price} 
                              onChange={e => updatePlan(idx, "price", Number(e.target.value))}
                              className="h-9 bg-white/5 border-white/10 text-sm font-medium rounded-lg focus:ring-brand-600/50" 
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">Max Units</Label>
                          <Input 
                            type="number" 
                            value={plan.max_venues} 
                            onChange={e => updatePlan(idx, "max_venues", Number(e.target.value))}
                            className="h-9 bg-white/5 border-white/10 text-sm font-bold rounded-lg focus:ring-brand-600/50" 
                          />
                        </div>
                      </div>

                      <div className="relative z-10">
                        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">Core Features</Label>
                        <textarea 
                          value={plan.features.join(", ")} 
                          onChange={e => updatePlan(idx, "features", e.target.value.split(",").map(f => f.trim()).filter(Boolean))}
                          className="w-full bg-white/5 border border-white/10 text-xs font-medium p-3 rounded-xl h-24 focus:outline-none focus:ring-2 focus:ring-brand-600/50 transition-all resize-none" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSubTab === "security" && (
            <section className="space-y-6 sm:space-y-8 max-w-xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-brand-600/10 shadow-inner">
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="admin-heading text-base sm:text-lg">Access Security</h3>
                  <p className="admin-label mt-0.5 text-xs">Admin Credentials & Auth</p>
                </div>
              </div>

              <div className="glass-premium rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-white/5 shadow-xl space-y-5 sm:space-y-6">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4 block">Reset Alpha Credentials</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password" 
                      className="h-12 bg-white/5 border-white/10 text-sm font-medium rounded-2xl focus:ring-brand-600/50" 
                    />
                    <Button 
                      onClick={handleChangePassword} 
                      disabled={changingPw || !newPassword} 
                      className="h-12 px-6 rounded-2xl font-medium tracking-wide text-xs bg-white/10 text-foreground hover:bg-brand-600 transition-all shadow-lg active:scale-95"
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
      <div className="pt-6 sm:pt-8 border-t border-white/5">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="w-full h-12 sm:h-14 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm tracking-wide rounded-full shadow-2xl shadow-brand-600/40 transition-all hover:scale-[1.01] active:scale-95 group"
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

function PayoutsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  // State
  const [loading, setLoading] = useState(true);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [subTab, setSubTab] = useState(searchParams.get("ptab") || "pending"); // pending | history | accounts
  const [processing, setProcessing] = useState(null); // user_id being processed
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [detailDialog, setDetailDialog] = useState(null); // settlement object or null
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  // Pagination state
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const LIMIT = 10;

  // Load data
  const loadPending = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await payoutAPI.pending({ page: p, limit: LIMIT });
      const data = res.data || {};
      setPendingPayouts(data.payouts || []);
      setPendingTotalPages(data.pages || 1);
      setPendingTotal(data.total || 0);
      setPendingPage(data.page || p);
    } catch { toast.error("Failed to load pending payouts"); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await payoutAPI.settlements({ page: p, limit: LIMIT });
      const sData = res.data || {};
      setSettlements(sData.settlements || []);
      setHistoryTotalPages(sData.pages || Math.ceil((sData.total || 0) / LIMIT) || 1);
      setHistoryTotal(sData.total || 0);
      setHistoryPage(sData.page || p);
    } catch { toast.error("Failed to load settlements"); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPending(1), loadHistory(1)]);
    } catch {}
    finally { setLoading(false); }
  }, [loadPending, loadHistory]);

  useEffect(() => { load(); }, [load]);

  // Sync subTab + searchQuery → URL (preserve other params)
  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (subTab !== "pending") p.set("ptab", subTab); else p.delete("ptab");
      if (searchQuery) p.set("q", searchQuery); else p.delete("q");
      return p;
    }, { replace: true });
  }, [subTab, searchQuery, setSearchParams]);

  // Process single payout
  const handleProcessPayout = async (userId) => {
    setProcessing(userId);
    try {
      await payoutAPI.createSettlement({ user_id: userId });
      toast.success("Payout processed successfully");
      loadPending(pendingPage);
      loadHistory(1);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to process payout"); }
    finally { setProcessing(null); }
  };

  // Bulk process
  const handleBulkProcess = async () => {
    setBulkProcessing(true);
    try {
      const res = await payoutAPI.bulkSettle();
      toast.success(`Processed ${res.data?.processed || 0} payouts`);
      loadPending(1);
      loadHistory(1);
    } catch (err) { toast.error(err?.response?.data?.detail || "Bulk process failed"); }
    finally { setBulkProcessing(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  // Filtered lists
  const filteredPending = searchQuery
    ? pendingPayouts.filter(p => p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.user_role?.toLowerCase().includes(searchQuery.toLowerCase()))
    : pendingPayouts;

  const filteredSettlements = searchQuery
    ? settlements.filter(s => s.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.id?.toLowerCase().includes(searchQuery.toLowerCase()))
    : settlements;

  const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);
  const totalSettledAmount = settlements.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.net_amount || 0), 0);

  const statusColors = {
    completed: "bg-green-500/10 text-green-600",
    processing: "bg-blue-500/10 text-blue-600",
    failed: "bg-red-500/10 text-red-600",
    draft: "bg-gray-500/10 text-gray-600",
  };
  const roleColors = {
    coach: "bg-blue-500/10 text-blue-600",
    venue_owner: "bg-purple-500/10 text-purple-600",
  };

  const subTabs = [
    { id: "pending", label: "Pending", icon: Clock },
    { id: "history", label: "History", icon: FileText },
    { id: "accounts", label: "Linked Accounts", icon: CreditCard },
  ];

  return (
    <div className="space-y-6" data-testid="admin-payouts-tab">
      {/* Header with stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={IndianRupee} label="Total Settled" value={`₹${totalSettledAmount.toLocaleString()}`} index={0} />
        <StatCard icon={Clock} label="Pending Payouts" value={pendingTotal} sub={`₹${totalPendingAmount.toLocaleString()}`} index={1} colorClass="text-amber-500" bgClass="bg-amber-500/10" />
        <StatCard icon={CheckCircle} label="Completed" value={settlements.filter(s => s.status === "completed").length} index={2} />
        <StatCard icon={CreditCard} label="Active Accounts" value={settlements.length > 0 ? "—" : "0"} index={3} />
      </div>

      {/* Sub-tab navigation + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setSubTab(tab.id); setSearchQuery(""); }}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-full admin-btn transition-all shrink-0 min-h-[36px] ${
                subTab === tab.id
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${subTab === tab.id ? "text-white" : "text-muted-foreground"}`} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 sm:h-10 w-full sm:w-48 rounded-full text-sm"
            />
          </div>
          {subTab === "pending" && pendingPayouts.length > 0 && (
            <Button
              size="sm"
              onClick={handleBulkProcess}
              disabled={bulkProcessing}
              className="gap-1.5 sm:gap-2 h-9 sm:h-10 px-3 sm:px-5 admin-btn rounded-full bg-brand-600 hover:bg-brand-500 text-white shrink-0 text-[11px] sm:text-xs"
            >
              {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
              <span className="hidden sm:inline">Process All</span>
              <span className="sm:hidden">All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Pending Payouts */}
      <AnimatePresence mode="wait">
        {subTab === "pending" && (
          <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {filteredPending.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
                <p className="text-sm font-medium">All payouts are settled!</p>
              </div>
            ) : (
              <div className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left p-3 sm:p-4 admin-th">User</th>
                        <th className="text-left p-3 sm:p-4 admin-th">Role</th>
                        <th className="text-right p-3 sm:p-4 admin-th">Items</th>
                        <th className="text-right p-3 sm:p-4 admin-th">Gross</th>
                        <th className="text-right p-3 sm:p-4 admin-th hidden sm:table-cell">Commission</th>
                        <th className="text-right p-3 sm:p-4 admin-th">Net</th>
                        <th className="text-left p-3 sm:p-4 admin-th">Bank</th>
                        <th className="text-right p-3 sm:p-4 admin-th">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPending.map((p, i) => (
                        <motion.tr
                          key={p.user_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/20 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-3 sm:p-4 font-medium text-foreground text-xs sm:text-sm">{p.user_name || "—"}</td>
                          <td className="p-3 sm:p-4">
                            <Badge variant="outline" className={`admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none text-[10px] sm:text-xs ${roleColors[p.user_role] || "bg-secondary text-muted-foreground"}`}>
                              {p.user_role === "venue_owner" ? "Owner" : p.user_role}
                            </Badge>
                          </td>
                          <td className="p-3 sm:p-4 text-right text-muted-foreground text-xs sm:text-sm">{p.pending_items_count || 0}</td>
                          <td className="p-3 sm:p-4 text-right font-medium text-xs sm:text-sm">₹{(p.gross_amount || 0).toLocaleString()}</td>
                          <td className="p-3 sm:p-4 text-right text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">₹{(p.commission_amount || 0).toLocaleString()}</td>
                          <td className="p-3 sm:p-4 text-right font-medium text-brand-600 text-xs sm:text-sm">₹{(p.net_amount || 0).toLocaleString()}</td>
                          <td className="p-3 sm:p-4">
                            {p.has_linked_account ? (
                              <Badge variant="outline" className="admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none bg-green-500/10 text-green-600 text-[10px] sm:text-xs">Linked</Badge>
                            ) : (
                              <Badge variant="outline" className="admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none bg-red-500/10 text-red-600 text-[10px] sm:text-xs">No</Badge>
                            )}
                          </td>
                          <td className="p-3 sm:p-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleProcessPayout(p.user_id)}
                              disabled={processing === p.user_id || !p.has_linked_account}
                              className="gap-1 h-8 sm:h-9 px-3 sm:px-4 admin-btn rounded-full bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 text-[11px] sm:text-xs"
                            >
                              {processing === p.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IndianRupee className="h-3.5 w-3.5" />}
                              Pay
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Pending Pagination */}
            {pendingTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 px-2 gap-3">
                <span className="admin-section-label text-[11px] sm:text-xs">
                  {(pendingPage - 1) * LIMIT + 1}–{Math.min(pendingPage * LIMIT, pendingTotal)} of {pendingTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button disabled={pendingPage <= 1} onClick={() => loadPending(pendingPage - 1)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: pendingTotalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pendingTotalPages || Math.abs(p - pendingPage) <= 1)
                    .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`dots-${i}`} className="px-1 text-muted-foreground/50 text-xs">...</span>
                      ) : (
                        <button key={p} onClick={() => loadPending(p)}
                          className={`h-9 min-w-[36px] px-2 rounded-xl admin-btn transition-all ${p === pendingPage ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}>
                          {p}
                        </button>
                      )
                    )}
                  <button disabled={pendingPage >= pendingTotalPages} onClick={() => loadPending(pendingPage + 1)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Settlement History */}
        {subTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {filteredSettlements.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-sm font-medium">No settlements yet</p>
              </div>
            ) : (
              <div className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[650px]">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left p-3 sm:p-4 admin-th">Date</th>
                        <th className="text-left p-3 sm:p-4 admin-th">Payee</th>
                        <th className="text-left p-3 sm:p-4 admin-th hidden sm:table-cell">Role</th>
                        <th className="text-right p-3 sm:p-4 admin-th">Amount</th>
                        <th className="text-left p-3 sm:p-4 admin-th">Status</th>
                        <th className="text-left p-3 sm:p-4 admin-th hidden md:table-cell">Transfer ID</th>
                        <th className="text-right p-3 sm:p-4 admin-th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSettlements.map((s, i) => (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/20 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-3 sm:p-4 text-muted-foreground text-[11px] sm:text-xs whitespace-nowrap">{s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</td>
                          <td className="p-3 sm:p-4 font-medium text-foreground text-xs sm:text-sm">{s.user_name || "—"}</td>
                          <td className="p-3 sm:p-4 hidden sm:table-cell">
                            <Badge variant="outline" className={`admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none text-[10px] sm:text-xs ${roleColors[s.user_role] || "bg-secondary text-muted-foreground"}`}>
                              {s.user_role === "venue_owner" ? "Owner" : s.user_role}
                            </Badge>
                          </td>
                          <td className="p-3 sm:p-4 text-right font-medium text-brand-600 text-xs sm:text-sm">₹{(s.net_amount || 0).toLocaleString()}</td>
                          <td className="p-3 sm:p-4">
                            <Badge variant="outline" className={`admin-badge px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-none text-[10px] sm:text-xs ${statusColors[s.status] || "bg-secondary text-muted-foreground"}`}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="p-3 sm:p-4 text-[10px] sm:text-xs text-muted-foreground font-mono hidden md:table-cell truncate max-w-[120px]">{s.razorpay_transfer_id || "—"}</td>
                          <td className="p-3 sm:p-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailDialog(s)}
                              className="h-8 w-8 p-0 rounded-full"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* History Pagination */}
            {historyTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 px-2 gap-3">
                <span className="admin-section-label text-[11px] sm:text-xs">
                  {(historyPage - 1) * LIMIT + 1}–{Math.min(historyPage * LIMIT, historyTotal)} of {historyTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: historyTotalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === historyTotalPages || Math.abs(p - historyPage) <= 1)
                    .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`dots-${i}`} className="px-1 text-muted-foreground/50 text-xs">...</span>
                      ) : (
                        <button key={p} onClick={() => loadHistory(p)}
                          className={`h-9 min-w-[36px] px-2 rounded-xl admin-btn transition-all ${p === historyPage ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}>
                          {p}
                        </button>
                      )
                    )}
                  <button disabled={historyPage >= historyTotalPages} onClick={() => loadHistory(historyPage + 1)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Linked Accounts placeholder */}
        {subTab === "accounts" && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium">Linked accounts are managed by coaches and venue owners from their dashboards.</p>
              <p className="text-xs text-muted-foreground mt-2">Bank account status is visible in the Pending Payouts table.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settlement Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-2xl sm:rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="admin-heading text-base sm:text-lg">Settlement Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground truncate">
              {detailDialog?.id}
            </DialogDescription>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-3 sm:space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payee</p>
                  <p className="font-medium">{detailDialog.user_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Role</p>
                  <p className="font-semibold capitalize">{detailDialog.user_role?.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Period</p>
                  <p className="font-medium">{detailDialog.period_start || "—"} → {detailDialog.period_end || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant="outline" className={`admin-badge px-3 py-1 rounded-full border-none ${statusColors[detailDialog.status] || "bg-secondary text-muted-foreground"}`}>
                    {detailDialog.status}
                  </Badge>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross Amount</span><span className="font-medium">₹{(detailDialog.gross_amount || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission ({detailDialog.commission_pct || 10}%)</span><span className="font-medium text-red-500">-₹{(detailDialog.commission_amount || 0).toLocaleString()}</span></div>
                <div className="border-t border-border/40 pt-2 flex justify-between"><span className="font-medium">Net Payout</span><span className="font-medium text-brand-600">₹{(detailDialog.net_amount || 0).toLocaleString()}</span></div>
              </div>
              {detailDialog.razorpay_transfer_id && (
                <div className="text-xs text-muted-foreground">
                  <p>Transfer ID: <span className="font-mono">{detailDialog.razorpay_transfer_id}</span></p>
                  {detailDialog.transfer_utr && <p>UTR: <span className="font-mono">{detailDialog.transfer_utr}</span></p>}
                </div>
              )}
              {detailDialog.line_items?.length > 0 && (
                <div>
                  <p className="admin-section-label mb-2">Line Items ({detailDialog.line_items.length})</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {detailDialog.line_items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-secondary/20 rounded-xl text-xs">
                        <div>
                          <span className="font-medium text-foreground">{item.description || item.type}</span>
                          <span className="text-muted-foreground ml-2">{item.date}</span>
                        </div>
                        <span className="font-medium">₹{(item.net || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");

  // Sync main tab → URL (preserve other params)
  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (activeTab !== "overview") p.set("tab", activeTab); else p.delete("tab");
      return p;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-8" data-testid="super-admin-dashboard">
      <div className="w-full py-4 sm:py-6 flex flex-col gap-6 sm:gap-8 items-start">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">

          {/* Page Header */}
          <div className="mb-5 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-display font-medium tracking-tight text-foreground mb-0.5 sm:mb-1">Admin Console</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Horizon Platform Management</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-w-0" data-testid="admin-tabs">
            <div className="flex items-center justify-between border-b border-border/40 pb-1 sm:pb-2 mb-4 sm:mb-6">
              <TabsList className="bg-transparent h-auto p-0 rounded-none space-x-4 sm:space-x-8 flex items-center w-full justify-start overflow-x-auto hide-scrollbar">
                {["overview", "users", "venues", "payouts", "settings"].map((tab) => (
                  <TabsTrigger key={tab} value={tab}
                    className="relative pb-2 admin-btn text-xs sm:text-sm text-muted-foreground hover:text-foreground data-[state=active]:text-brand-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-none bg-transparent shadow-none transition-colors capitalize px-0 min-h-[36px] shrink-0"
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
            <TabsContent value="payouts" className="mt-0 outline-none w-full"><PayoutsTab /></TabsContent>
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
