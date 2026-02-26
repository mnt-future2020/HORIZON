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
import { motion } from "framer-motion";
import {
  Users, Building2, CalendarCheck, IndianRupee, Clock, Shield,
  CheckCircle, XCircle, Ban, RotateCcw, Settings, CreditCard,
  Percent, Crown, Eye, EyeOff, Save, KeyRound,
  Cloud, Wifi, AlertCircle, CheckCircle2, GraduationCap, Trophy,
  FileText, Loader2, Star, Video, Plus, UserPlus, Phone,
  ImagePlus, X, MessageCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSkeleton } from "@/components/SkeletonLoader";

const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

function StatCard({ icon: Icon, label, value, sub, color = "-emerald-600" }) {
  return (
    <div className="bg-card text-card-foreground border border-border/40 shadow-sm rounded-2xl p-6 hover:shadow-md transition-all duration-300" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">{label}</div>
        <div className={`p-2.5 rounded-xl border-emerald-600/5 ${color}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div>
        <div className="text-3xl font-display font-light tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-2 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminAPI.dashboard().then(r => setData(r.data)).catch(() => toast.error("Failed to load dashboard"));
  }, []);
  if (!data) return <AdminSkeleton />;
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
        <StatCard icon={Clock} label="Pending Approvals" value={(data.pending_owners || 0) + (data.pending_coaches || 0)} color={(data.pending_owners || 0) + (data.pending_coaches || 0) > 0 ? "text-amber-400" : "-emerald-600"} />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Recent Registrations</h3>
        <div className="space-y-3">
          {data.recent_users.map(u => (
            <div key={u.id} className="bg-card border border-border/40 shadow-sm rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full border-emerald-600/10 flex items-center justify-center text-sm font-bold border-emerald-600">{u.name?.[0]}</div>
                <div>
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-[10px] font-semibold tracking-wider uppercase bg-secondary/50 px-2 py-0.5">{u.role.replace("_", " ")}</Badge>
                <Badge className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 ${u.account_status === "active" ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : u.account_status === "pending" ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>
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
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending", "player", "venue_owner", "coach"].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-widest transition-all duration-300 uppercase ${filter === f ? "bg-foreground text-background shadow-md" : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            {f === "all" ? "All Users" : f === "pending" ? "Pending Approval" : f === "player" ? "Lobbian" : f.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[200px]">
          <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <div className="text-muted-foreground text-sm font-medium">No users found matching this filter</div>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-card border border-border/40 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 group" data-testid={`user-row-${u.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-11 w-11 rounded-full border-emerald-600/10 flex items-center justify-center text-base font-bold border-emerald-600 shrink-0 border border-emerald-600/20">{u.name?.[0]}</div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate text-foreground tracking-tight">{u.name}</div>
                    <div className="text-xs text-muted-foreground font-medium truncate mt-0.5">{u.email} {u.phone && <span className="opacity-60 px-1.5">•</span>} {u.phone}</div>
                    {u.business_name && <div className="text-[11px] text-muted-foreground/80 font-medium mt-1.5 inline-flex items-center bg-secondary/50 px-2 py-0.5 rounded-md">Business: {u.business_name} {u.gst_number && <span className="opacity-60 mx-1.5">|</span>} {u.gst_number && `GST: ${u.gst_number}`}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap opacity-95 group-hover:opacity-100 transition-opacity">
                  <Badge variant="secondary" className="text-[10px] font-bold tracking-wider uppercase bg-secondary/60 px-2.5 py-1">{u.role.replace("_", " ")}</Badge>
                  {u.role === "venue_owner" && u.subscription_plan && (
                    <Badge className="text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2.5 py-1">{u.subscription_plan}</Badge>
                  )}
                  <Badge className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 ${u.account_status === "active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : u.account_status === "pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                    {u.account_status}
                  </Badge>
                  {/* Venue owner: doc icon */}
                  {u.role === "venue_owner" && u.doc_verification_status && u.doc_verification_status !== "not_uploaded" && (
                    <Button size="sm" variant="ghost"
                      className={`h-8 px-3 rounded-lg font-semibold text-xs transition-colors ${
                        u.doc_verification_status === "pending_review" ? "text-amber-500 bg-amber-500/5 hover:bg-amber-500/15" :
                        u.doc_verification_status === "verified" ? "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/15" :
                        "text-destructive bg-destructive/5 hover:bg-destructive/15"
                      }`}
                      onClick={() => openDocViewer(u.id)} data-testid={`docs-${u.id}`}>
                      <FileText className="h-4 w-4 mr-1.5" /> Docs
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
                    <Badge className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 ${u.doc_verification_status === "pending_review" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-blue-500/10 text-blue-600 border border-blue-500/20"}`}>
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
                    <Button size="sm" variant="ghost" className={`h-7 px-2 ${u.is_verified ? "text-blue-400 hover:bg-blue-500/10" : "text-muted-foreground hover:border-emerald-600/10"}`}
                      onClick={() => handleVerify(u.id)} data-testid={`verify-${u.id}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 mr-1 ${u.is_verified ? "" : "opacity-40"}`} />
                      {u.is_verified ? "Verified" : "Verify"}
                    </Button>
                  )}
                  {(u.account_status === "suspended" || u.account_status === "rejected") && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 border-emerald-600 hover:border-emerald-600/10"
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
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin border-emerald-600" /></div>
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
                            className="flex items-center gap-2 mt-2 p-2 rounded-md bg-background/50 text-xs border-emerald-600 hover:underline">
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

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-3" data-testid="admin-venues-tab">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{venues.length} venues</span>
        <Button size="sm" className="gap-2 h-9 px-5 text-xs font-bold tracking-wide rounded-full shadow-md hover:shadow-lg transition-all" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" /> Add Venue
        </Button>
      </div>

      <div className="grid gap-4">
      {venues.map(v => (
        <div key={v.id} className="bg-card border border-border/40 shadow-sm rounded-xl p-5 flex items-center justify-between flex-wrap gap-4 hover:shadow-md transition-all duration-300" data-testid={`venue-row-${v.id}`}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-base font-semibold tracking-tight text-foreground">{v.name}</span>
              <Badge className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 ${v.badge === "bookable" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}>
                {v.badge === "bookable" ? "Bookable" : "Enquiry"}
              </Badge>
              <Badge className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 ${v.owner_id ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" : "bg-orange-500/10 text-orange-600 border border-orange-500/20"}`}>
                {v.owner_id ? "Owner Linked" : "Manual Entry"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground font-medium mb-3">{v.address}{v.address && ", "}{v.city}</div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-[10px] font-bold tracking-wider uppercase bg-secondary/60 px-2.5 py-1">{v.sports?.join(", ")}</Badge>
              <span className="text-xs text-muted-foreground font-medium">{v.turfs} turfs <span className="opacity-50 mx-1.5">•</span> {v.total_bookings} bookings</span>
              {!v.owner_id && <span className="text-[11px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">No owner</span>}
              {v.contact_phone && <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 bg-secondary/30 border border-border/50 px-2 py-1 rounded-md"><Phone className="h-3 w-3 opacity-70" />{v.contact_phone}</span>}
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            {!v.owner_id && (
              <Button size="sm" variant="outline" className="h-9 px-3.5 text-xs gap-2 font-bold rounded-lg border-border/60 hover:bg-secondary/50" onClick={() => openAssignDialog(v)}>
                <UserPlus className="h-4 w-4 border-emerald-600" /> Assign Owner
              </Button>
            )}
            <div className="flex items-center gap-3 border-l border-border/40 pl-5">
              <Badge className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 ${v.status === "active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>{v.status}</Badge>
              <Switch checked={v.status === "active"} onCheckedChange={() => toggleVenue(v.id, v.status)} data-testid={`toggle-venue-${v.id}`} />
            </div>
          </div>
        </div>
      ))}
      </div>

      {/* Create Venue Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-display font-light">
              <div className="p-2 rounded-xl border-emerald-600/10">
                <Building2 className="h-5 w-5 border-emerald-600" />
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
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${venueForm.sports.includes(s.toLowerCase()) ? "-emerald-600 border-emerald-600-foreground border-emerald-600" : "bg-secondary/50 text-muted-foreground border-border hover:border-emerald-600/50"}`}>
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
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${venueForm.amenities.includes(a) ? "-emerald-600 border-emerald-600-foreground border-emerald-600" : "bg-secondary/50 text-muted-foreground border-border hover:border-emerald-600/50"}`}>
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
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm font-medium ${uploading ? "opacity-60 pointer-events-none border-border" : "-emerald-600/40 hover:border-emerald-600 hover:border-emerald-600/5 text-muted-foreground hover:border-emerald-600"}`}>
                {uploading ? <><div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />Uploading...</> : <><ImagePlus className="h-4 w-4" />{venueForm.images.length > 0 ? "Add more images" : "Upload venue images"}</>}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} disabled={uploading} />
              </label>
            </div>
            <Button className="w-full border-emerald-600 border-emerald-600-foreground font-bold" onClick={handleCreateVenue} disabled={creating}>
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
              <div className="p-2 rounded-xl border-emerald-600/10">
                <UserPlus className="h-5 w-5 border-emerald-600" />
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
                    <p>Badge will change from <span className="text-amber-400 font-medium">Enquiry</span> to <span className="text-emerald-400 font-medium">Bookable</span></p>
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

  if (!settings) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;

  const s3 = settings.s3_storage || {};
  const s3Configured = !!(s3.access_key_id && s3.secret_access_key && s3.bucket_name && s3.region);

  return (
    <div className="space-y-8 max-w-2xl" data-testid="admin-settings-tab">
      {/* Payment Gateway */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <CreditCard className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">Payment Gateway</h3>
        </div>
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-300">
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
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={settings.payment_gateway.is_live} onCheckedChange={v => updateGateway("is_live", v)} data-testid="gateway-live-toggle" />
            <Label className="text-sm font-semibold">{settings.payment_gateway.is_live ? "Live Mode Active" : "Test Mode Active"}</Label>
          </div>
        </div>
      </section>

      {/* ─── AWS S3 Storage ─── */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <Cloud className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">AWS S3 Storage</h3>
          {s3Configured ? (
            <span className="ml-auto flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" /> Configured
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground font-bold bg-secondary/50 border border-border px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block mr-1" /> Not Configured
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-medium mb-5 px-1">
          Venue images, profile photos, and match videos will be stored in your S3 bucket.
        </p>
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-300">
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
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:border-emerald-600/50"
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
            {testingS3 ? <><div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> Testing...</>
              : <><Wifi className="h-4 w-4" /> Test S3 Connection</>}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            ⚠️ Make sure your S3 bucket has public read access enabled (or use a CDN). IAM user needs <code className="bg-secondary px-1 rounded">s3:PutObject</code> and <code className="bg-secondary px-1 rounded">s3:HeadBucket</code> permissions.
          </p>
        </div>
      </section>

      {/* WhatsApp Business Cloud API */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <MessageCircle className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">WhatsApp Business API</h3>
          {settings.whatsapp?.phone_number_id && settings.whatsapp?.access_token ? (
            <span className="ml-auto flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" /> Configured
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground font-bold bg-secondary/50 border border-border px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block mr-1" /> Not Configured
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-medium mb-5 px-1">
          Enquiry messages are sent from your business number to venue owners automatically.
        </p>
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-300">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Phone Number ID</Label>
            <Input value={settings.whatsapp?.phone_number_id || ""} onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, phone_number_id: e.target.value } }))}
              className="mt-1.5 bg-background border-border h-10 text-sm font-mono" placeholder="e.g. 123456789012345" />
            <p className="text-[10px] text-muted-foreground mt-1">Found in Meta Developer Console → WhatsApp → API Setup</p>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Permanent Access Token</Label>
            <div className="relative mt-1.5">
              <Input type={showWaToken ? "text" : "password"} value={settings.whatsapp?.access_token || ""} onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, access_token: e.target.value } }))}
                className="bg-background border-border h-10 text-sm font-mono pr-10" placeholder="EAAxxxxxxx..." />
              <button onClick={() => setShowWaToken(!showWaToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Generate a permanent token from Meta Business Settings → System Users</p>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Business Phone (display)</Label>
            <div className="flex mt-1.5">
              <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs font-bold text-muted-foreground select-none">+91</span>
              <Input value={settings.whatsapp?.business_phone || ""} onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp, business_phone: cleanPhone(e.target.value) } }))}
                className="bg-background border-border h-10 text-sm rounded-l-none" placeholder="98765 43210" maxLength={10} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">The registered WhatsApp Business number (for reference only).</p>
          </div>
        </div>
      </section>

      {/* Platform Commissions */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <Percent className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">Platform Commissions</h3>
        </div>
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-300">
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
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <Crown className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">SaaS Subscription Plans</h3>
        </div>
        <div className="space-y-4">
          {settings.subscription_plans.map((plan, idx) => (
            <div key={plan.id} className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 space-y-4 hover:shadow-md transition-all duration-300" data-testid={`plan-${plan.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold tracking-tight">{plan.name}</span>
                <Badge variant="secondary" className="text-[10px] font-bold tracking-widest uppercase bg-secondary/60 px-2.5 py-1">{plan.id}</Badge>
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

      <Button onClick={saveSettings} disabled={saving} className="-emerald-600 border-emerald-600-foreground font-bold text-sm tracking-wide w-full h-12 rounded-xl shadow-md hover:shadow-lg transition-all mb-10" data-testid="save-settings-btn">
        {saving ? "Saving..." : <><Save className="h-4 w-4 mr-2" /> Save All Settings</>}
      </Button>

      {/* Change Password */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl border-emerald-600/10">
            <KeyRound className="h-5 w-5 border-emerald-600" />
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight">Change Admin Password</h3>
        </div>
        <div className="bg-card border border-border/40 shadow-sm rounded-2xl p-6 hover:shadow-md transition-all duration-300">
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
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-24 md:pb-12" data-testid="super-admin-dashboard" style={{ "--primary": "160 84% 39%", "--ring": "160 84% 39%" }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl border-emerald-600/5 flex items-center justify-center border border-emerald-600/10">
              <Shield className="h-7 w-7 border-emerald-600" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-light tracking-tight text-foreground">Admin Console</h1>
              <p className="text-sm text-muted-foreground font-medium mt-1">Horizon Platform Management</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full" data-testid="admin-tabs">
          <TabsList className="bg-transparent border-b border-border/40 w-full justify-start h-auto p-0 rounded-none mb-8 space-x-6 overflow-x-auto hide-scrollbar">
            <TabsTrigger value="overview" className="text-sm font-semibold tracking-wide px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground mb-[-1px] whitespace-nowrap" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="users" className="text-sm font-semibold tracking-wide px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground mb-[-1px] whitespace-nowrap" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="venues" className="text-sm font-semibold tracking-wide px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground mb-[-1px] whitespace-nowrap" data-testid="tab-venues">Venues</TabsTrigger>
            <TabsTrigger value="settings" className="text-sm font-semibold tracking-wide px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground mb-[-1px] whitespace-nowrap" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0 outline-none"><OverviewTab /></TabsContent>
          <TabsContent value="users" className="mt-0 outline-none"><UsersTab /></TabsContent>
          <TabsContent value="venues" className="mt-0 outline-none"><VenuesTab /></TabsContent>
          <TabsContent value="settings" className="mt-0 outline-none"><SettingsTab /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
