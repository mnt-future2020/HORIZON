import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { academyAPI, coachingAPI, organizationAPI, performanceAPI, trainingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AthleticStatCard } from "@/components/ui/stat-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  GraduationCap, Users, IndianRupee, Clock, Plus, Trash2, UserPlus,
  TrendingUp, Calendar, Star, CheckCircle, XCircle, Play, Settings,
  QrCode, ScanLine, Loader2, ShieldCheck, Camera, ClipboardList, UserCheck, UserX,
  Building2, FileText, Dumbbell, ChevronDown, ChevronUp, Award, Activity, BadgeCheck, Package
} from "lucide-react";

const COACH_HERO = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80";
const ACADEMY_EMPTY = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table_tennis", "swimming"];
const ORG_TYPES = ["academy", "school", "college"];
const RECORD_TYPES = ["assessment", "achievement", "match_result", "training"];

export default function CoachDashboard() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("sessions");
  // Academy state
  const [academies, setAcademies] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", sport: "badminton", description: "", monthly_fee: 2000,
    location: "", max_students: 50, schedule: "",
  });
  const [studentForm, setStudentForm] = useState({ name: "", email: "", phone: "" });
  // Sessions state
  const [sessionStats, setSessionStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [availForm, setAvailForm] = useState({ day_of_week: "1", start_time: "09:00", end_time: "10:00" });
  const [profileForm, setProfileForm] = useState({
    coaching_bio: "", coaching_sports: [], session_price: "500",
    session_duration_minutes: "60", city: "", coaching_venue: "",
  });

  // ─── Organization state ───
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: "", org_type: "academy", sports: [], location: "", city: "", description: "",
  });
  const [orgCreating, setOrgCreating] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [orgDashboards, setOrgDashboards] = useState({});
  const [addPlayerEmail, setAddPlayerEmail] = useState("");
  const [addStaffEmail, setAddStaffEmail] = useState("");
  const [orgActionLoading, setOrgActionLoading] = useState(false);

  // ─── Records state ───
  const [orgPlayers, setOrgPlayers] = useState([]);
  const [recordForm, setRecordForm] = useState({
    player_id: "", record_type: "assessment", sport: "badminton",
    title: "", date: new Date().toISOString().slice(0, 10),
    stats: [{ key: "", value: "" }], notes: "",
  });
  const [trainingForm, setTrainingForm] = useState({
    title: "", sport: "badminton", date: new Date().toISOString().slice(0, 10),
    duration_minutes: "60", drills: "", player_ids: [], notes: "",
  });
  const [recentRecords, setRecentRecords] = useState([]);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [submittingTraining, setSubmittingTraining] = useState(false);

  // ─── Packages state ───
  const [packages, setPackages] = useState([]);
  const [showCreatePkg, setShowCreatePkg] = useState(false);
  const [pkgForm, setPkgForm] = useState({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "" });
  const [pkgCreating, setPkgCreating] = useState(false);

  const loadAcademyData = useCallback(async () => {
    try {
      const res = await academyAPI.list();
      const myAcademies = (res.data || []).filter(a => a.coach_id === user?.id);
      setAcademies(myAcademies);
      if (myAcademies.length > 0 && !selectedAcademy) {
        const detail = await academyAPI.get(myAcademies[0].id);
        setSelectedAcademy(detail.data);
      } else if (selectedAcademy) {
        const detail = await academyAPI.get(selectedAcademy.id);
        setSelectedAcademy(detail.data);
      }
    } catch { setAcademies([]); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessionData = useCallback(async () => {
    try {
      const [statsRes, sessionsRes, availRes] = await Promise.all([
        coachingAPI.stats(),
        coachingAPI.listSessions({}),
        coachingAPI.getAvailability(),
      ]);
      setSessionStats(statsRes.data);
      setSessions(sessionsRes.data || []);
      setAvailability(availRes.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      const res = await coachingAPI.listPackages();
      setPackages(res.data || []);
    } catch { setPackages([]); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAcademyData(), loadSessionData(), loadPackages()]).finally(() => setLoading(false));
  }, [loadAcademyData, loadSessionData, loadPackages]);

  // Initialize profile form from user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        coaching_bio: user.coaching_bio || "",
        coaching_sports: user.coaching_sports || [],
        session_price: String(user.session_price || 500),
        session_duration_minutes: String(user.session_duration_minutes || 60),
        city: user.city || "",
        coaching_venue: user.coaching_venue || "",
      });
    }
  }, [user]);

  // ─── Organization data loader ───
  const loadOrganizations = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await organizationAPI.my();
      setOrgs(res.data || []);
    } catch { setOrgs([]); }
    setOrgsLoading(false);
  }, []);

  // Load org dashboard when expanding
  const loadOrgDashboard = useCallback(async (orgId) => {
    try {
      const [dashRes, orgRes] = await Promise.all([
        organizationAPI.dashboard(orgId),
        organizationAPI.get(orgId),
      ]);
      setOrgDashboards(prev => ({
        ...prev,
        [orgId]: { ...dashRes.data, detail: orgRes.data },
      }));
    } catch { /* ignore */ }
  }, []);

  // ─── Records data loader ───
  const loadRecordsData = useCallback(async () => {
    setRecordsLoading(true);
    try {
      // Gather all players from orgs for the dropdown
      const orgRes = await organizationAPI.my();
      const myOrgs = orgRes.data || [];
      const allPlayers = [];
      for (const org of myOrgs) {
        try {
          const orgDetail = await organizationAPI.get(org.id);
          const players = orgDetail.data?.players || [];
          players.forEach(p => {
            if (!allPlayers.find(x => x.id === p.id || x.user_id === p.user_id)) {
              allPlayers.push({ ...p, org_id: org.id, org_name: org.name });
            }
          });
        } catch { /* skip */ }
      }
      setOrgPlayers(allPlayers);

      // Load recent training logs
      const [trainingRes] = await Promise.all([
        trainingAPI.list({ limit: 20 }),
      ]);
      setTrainingLogs(trainingRes.data || []);

      // Load recent records for all org players
      const allRecords = [];
      for (const p of allPlayers.slice(0, 10)) {
        try {
          const pId = p.user_id || p.id;
          const recs = await performanceAPI.getPlayerRecords(pId, { limit: 5 });
          (recs.data || []).forEach(r => {
            allRecords.push({ ...r, player_name: p.name || p.email });
          });
        } catch { /* skip */ }
      }
      allRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRecentRecords(allRecords.slice(0, 20));
    } catch { /* ignore */ }
    setRecordsLoading(false);
  }, []);

  // Load orgs when switching to organization tab
  useEffect(() => {
    if (activeView === "organization") {
      loadOrganizations();
    }
  }, [activeView, loadOrganizations]);

  // Load records data when switching to records tab
  useEffect(() => {
    if (activeView === "records") {
      loadRecordsData();
    }
  }, [activeView, loadRecordsData]);

  // Academy handlers
  const handleCreate = async () => {
    try {
      const res = await academyAPI.create(form);
      toast.success("Academy created!");
      setCreateOpen(false);
      setSelectedAcademy(res.data);
      loadAcademyData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleAddStudent = async () => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.addStudent(selectedAcademy.id, studentForm);
      toast.success("Student added!");
      setAddStudentOpen(false);
      setStudentForm({ name: "", email: "", phone: "" });
      loadAcademyData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleRemoveStudent = async (studentId) => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.removeStudent(selectedAcademy.id, studentId);
      toast.success("Student removed");
      loadAcademyData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // Sessions handlers
  const handleSaveProfile = async () => {
    try {
      await coachingAPI.updateProfile({
        ...profileForm,
        session_price: parseInt(profileForm.session_price, 10),
        session_duration_minutes: parseInt(profileForm.session_duration_minutes, 10),
      });
      toast.success("Profile updated!");
      setProfileOpen(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleAddAvailability = async () => {
    try {
      await coachingAPI.addAvailability({
        day_of_week: parseInt(availForm.day_of_week, 10),
        start_time: availForm.start_time,
        end_time: availForm.end_time,
      });
      toast.success("Availability added!");
      setAvailOpen(false);
      loadSessionData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleRemoveAvailability = async (id) => {
    try {
      await coachingAPI.removeAvailability(id);
      toast.success("Removed");
      loadSessionData();
    } catch { toast.error("Failed"); }
  };
  const handleCompleteSession = async (id) => {
    try {
      await coachingAPI.completeSession(id);
      toast.success("Session completed!");
      loadSessionData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleCancelSession = async (id) => {
    try {
      await coachingAPI.cancelSession(id);
      toast.success("Session cancelled");
      loadSessionData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // ─── Package handlers ───
  const handleCreatePackage = async () => {
    if (!pkgForm.name.trim()) { toast.error("Package name is required"); return; }
    setPkgCreating(true);
    try {
      await coachingAPI.createPackage({
        name: pkgForm.name,
        sessions_per_month: parseInt(pkgForm.sessions_per_month),
        price: parseInt(pkgForm.price),
        duration_minutes: parseInt(pkgForm.duration_minutes),
        sports: pkgForm.sports,
        description: pkgForm.description,
      });
      toast.success("Package created!");
      setShowCreatePkg(false);
      setPkgForm({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "" });
      loadPackages();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create package"); }
    setPkgCreating(false);
  };

  const handleDeletePackage = async (id) => {
    try {
      await coachingAPI.deletePackage(id);
      toast.success("Package deactivated");
      loadPackages();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const togglePkgSport = (sport) => {
    setPkgForm(prev => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter(s => s !== sport)
        : [...prev.sports, sport],
    }));
  };

  // ─── Organization handlers ───
  const handleCreateOrg = async () => {
    if (!orgForm.name.trim()) { toast.error("Organization name is required"); return; }
    setOrgCreating(true);
    try {
      await organizationAPI.create({
        name: orgForm.name,
        org_type: orgForm.org_type,
        sports: orgForm.sports,
        location: orgForm.location,
        city: orgForm.city,
        description: orgForm.description,
      });
      toast.success("Organization created!");
      setShowCreateOrg(false);
      setOrgForm({ name: "", org_type: "academy", sports: [], location: "", city: "", description: "" });
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create organization"); }
    setOrgCreating(false);
  };

  const handleToggleOrgExpand = async (orgId) => {
    if (expandedOrgId === orgId) {
      setExpandedOrgId(null);
    } else {
      setExpandedOrgId(orgId);
      loadOrgDashboard(orgId);
    }
  };

  const handleAddOrgPlayer = async (orgId) => {
    if (!addPlayerEmail.trim()) return;
    setOrgActionLoading(true);
    try {
      await organizationAPI.addPlayer(orgId, { email: addPlayerEmail.trim() });
      toast.success("Player added!");
      setAddPlayerEmail("");
      loadOrgDashboard(orgId);
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add player"); }
    setOrgActionLoading(false);
  };

  const handleRemoveOrgPlayer = async (orgId, userId) => {
    setOrgActionLoading(true);
    try {
      await organizationAPI.removePlayer(orgId, userId);
      toast.success("Player removed");
      loadOrgDashboard(orgId);
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    setOrgActionLoading(false);
  };

  const handleAddOrgStaff = async (orgId) => {
    if (!addStaffEmail.trim()) return;
    setOrgActionLoading(true);
    try {
      await organizationAPI.addStaff(orgId, { email: addStaffEmail.trim() });
      toast.success("Staff added!");
      setAddStaffEmail("");
      loadOrgDashboard(orgId);
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add staff"); }
    setOrgActionLoading(false);
  };

  const handleRemoveOrgStaff = async (orgId, userId) => {
    setOrgActionLoading(true);
    try {
      await organizationAPI.removeStaff(orgId, userId);
      toast.success("Staff removed");
      loadOrgDashboard(orgId);
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    setOrgActionLoading(false);
  };

  // ─── Records handlers ───
  const handleSubmitRecord = async () => {
    if (!recordForm.player_id) { toast.error("Select a player"); return; }
    if (!recordForm.title.trim()) { toast.error("Title is required"); return; }
    setSubmittingRecord(true);
    try {
      const statsObj = {};
      recordForm.stats.forEach(s => {
        if (s.key.trim()) statsObj[s.key.trim()] = s.value;
      });
      await performanceAPI.createRecord({
        player_id: recordForm.player_id,
        record_type: recordForm.record_type,
        sport: recordForm.sport,
        title: recordForm.title,
        date: recordForm.date,
        stats: Object.keys(statsObj).length > 0 ? statsObj : undefined,
        notes: recordForm.notes || undefined,
      });
      toast.success("Record submitted!");
      setRecordForm({
        player_id: "", record_type: "assessment", sport: "badminton",
        title: "", date: new Date().toISOString().slice(0, 10),
        stats: [{ key: "", value: "" }], notes: "",
      });
      loadRecordsData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to submit record"); }
    setSubmittingRecord(false);
  };

  const handleLogTraining = async () => {
    if (!trainingForm.title.trim()) { toast.error("Title is required"); return; }
    setSubmittingTraining(true);
    try {
      const drillsArr = trainingForm.drills
        .split(",")
        .map(d => d.trim())
        .filter(Boolean);

      // Find the org_id from the first selected player
      let orgId = null;
      if (trainingForm.player_ids.length > 0) {
        const firstPlayer = orgPlayers.find(p => (p.user_id || p.id) === trainingForm.player_ids[0]);
        orgId = firstPlayer?.org_id || null;
      }

      await trainingAPI.log({
        title: trainingForm.title,
        sport: trainingForm.sport,
        date: trainingForm.date,
        duration_minutes: parseInt(trainingForm.duration_minutes, 10),
        drills: drillsArr.length > 0 ? drillsArr : undefined,
        player_ids: trainingForm.player_ids.length > 0 ? trainingForm.player_ids : undefined,
        notes: trainingForm.notes || undefined,
      }, orgId);
      toast.success("Training logged!");
      setTrainingForm({
        title: "", sport: "badminton", date: new Date().toISOString().slice(0, 10),
        duration_minutes: "60", drills: "", player_ids: [], notes: "",
      });
      loadRecordsData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to log training"); }
    setSubmittingTraining(false);
  };

  const addStatRow = () => {
    setRecordForm(prev => ({
      ...prev,
      stats: [...prev.stats, { key: "", value: "" }],
    }));
  };

  const updateStatRow = (index, field, value) => {
    setRecordForm(prev => ({
      ...prev,
      stats: prev.stats.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const removeStatRow = (index) => {
    setRecordForm(prev => ({
      ...prev,
      stats: prev.stats.filter((_, i) => i !== index),
    }));
  };

  const togglePlayerForTraining = (playerId) => {
    setTrainingForm(prev => ({
      ...prev,
      player_ids: prev.player_ids.includes(playerId)
        ? prev.player_ids.filter(id => id !== playerId)
        : [...prev.player_ids, playerId],
    }));
  };

  const toggleOrgSport = (sport) => {
    setOrgForm(prev => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter(s => s !== sport)
        : [...prev.sports, sport],
    }));
  };

  const academy = selectedAcademy;
  const upcomingSessions = sessions.filter(s => s.status === "confirmed");
  const completedSessions = sessions.filter(s => s.status === "completed");

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const VIEWS = [
    { id: "sessions", icon: Calendar, label: "Sessions" },
    { id: "checkin", icon: QrCode, label: "Check-in" },
    { id: "academy", icon: GraduationCap, label: "Academy" },
    { id: "availability", icon: Clock, label: "Availability" },
    { id: "profile", icon: Settings, label: "Profile" },
    { id: "organization", icon: Building2, label: "Organization" },
    { id: "packages", icon: Package, label: "Packages" },
    { id: "records", icon: FileText, label: "Records" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6" data-testid="coach-dashboard">
      {/* Welcome Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
        <div className="grid md:grid-cols-3 gap-0">
          <div className="md:col-span-2 p-8 md:p-10 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coach Dashboard</span>
              {user?.is_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 text-[10px] font-bold">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
            <h1 className="font-display text-display-md md:text-display-lg font-black tracking-athletic mt-2">
              Welcome, <span className="bg-gradient-athletic bg-clip-text text-transparent">{user?.name}</span>
            </h1>
            <p className="text-muted-foreground font-semibold mt-3 text-base">
              Manage sessions, train champions, and grow your coaching business.
            </p>
          </div>
          <div className="hidden md:block relative h-full min-h-[200px]">
            <img src={COACH_HERO} alt="Coach training" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 to-transparent" />
          </div>
        </div>
      </motion.div>

      {/* Session Stats */}
      {sessionStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
          <AthleticStatCard icon={Calendar} label="Upcoming" value={sessionStats.upcoming} iconColor="sky" delay={0.1} />
          <AthleticStatCard icon={CheckCircle} label="Completed" value={sessionStats.completed} iconColor="primary" delay={0.2} />
          <AthleticStatCard icon={IndianRupee} label="Revenue" value={`₹${(sessionStats.total_revenue || 0).toLocaleString()}`} iconColor="amber" delay={0.3} />
          <AthleticStatCard icon={Star} label="Rating" value={sessionStats.avg_rating || "—"} iconColor="violet" delay={0.4} />
          <AthleticStatCard icon={Users} label="Subscribers" value={sessionStats.active_subscribers || 0} iconColor="sky" delay={0.5} />
          <AthleticStatCard icon={IndianRupee} label="Package Revenue" value={`₹${(sessionStats.package_revenue || 0).toLocaleString()}`} iconColor="amber" delay={0.6} />
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary/30 p-1 rounded-lg w-fit flex-wrap">
        {VIEWS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveView(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeView === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`coach-tab-${id}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ─── Sessions View ─── */}
      {activeView === "sessions" && (
        <div className="space-y-4">
          {upcomingSessions.length > 0 && (
            <>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Upcoming Sessions</h3>
              {upcomingSessions.map(s => (
                <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3"
                  data-testid={`session-${s.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm">{s.player_name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                      <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} - {s.end_time}</span>
                      <span className="font-bold text-primary">₹{s.price}</span>
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="bg-emerald-600 text-white font-bold text-[10px] h-7"
                      onClick={() => handleCompleteSession(s.id)}>
                      <CheckCircle className="h-3 w-3 mr-1" />Done
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7 text-destructive border-destructive/30"
                      onClick={() => handleCancelSession(s.id)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}

          {completedSessions.length > 0 && (
            <>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mt-6">Completed Sessions</h3>
              {completedSessions.slice(0, 10).map(s => (
                <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 opacity-80">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm">{s.player_name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                      {s.rating && (
                        <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" />{s.rating}/5
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.date} · {s.start_time} · ₹{s.price}
                      {s.review && <span className="ml-2 italic">"{s.review}"</span>}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {sessions.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sessions yet. Set up your availability to start receiving bookings!</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setActiveView("availability")}>
                Set Availability
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Check-in View ─── */}
      {activeView === "checkin" && (
        <QRCheckinPanel sessions={sessions} onRefresh={loadSessionData} />
      )}

      {/* ─── Academy View ─── */}
      {activeView === "academy" && (
        <>
          {academy ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-display text-xl font-black">{academy.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{academy.description}</p>
                  </div>
                  <Badge variant="athletic" className="uppercase">{academy.sport}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Students:</span> <span className="font-bold">{academy.current_students}/{academy.max_students}</span></div>
                  <div><span className="text-muted-foreground">Fee:</span> <span className="font-bold text-primary">₹{academy.monthly_fee}/mo</span></div>
                  <div><span className="text-muted-foreground">Schedule:</span> <span className="font-bold">{academy.schedule}</span></div>
                  <div><span className="text-muted-foreground">Revenue:</span> <span className="font-bold text-amber-400">₹{((academy.current_students || 0) * academy.monthly_fee).toLocaleString()}/mo</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold">Students</h3>
                <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8" data-testid="add-student-btn">
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-sm">
                    <DialogHeader><DialogTitle className="font-display">Add Student</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label className="text-xs text-muted-foreground">Name</Label>
                        <Input value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))}
                          className="mt-1 bg-background border-border" data-testid="student-name-input" /></div>
                      <div><Label className="text-xs text-muted-foreground">Email</Label>
                        <Input type="email" value={studentForm.email} onChange={e => setStudentForm(p => ({ ...p, email: e.target.value }))}
                          className="mt-1 bg-background border-border" data-testid="student-email-input" /></div>
                      <div><Label className="text-xs text-muted-foreground">Phone</Label>
                        <Input value={studentForm.phone} onChange={e => setStudentForm(p => ({ ...p, phone: e.target.value }))}
                          className="mt-1 bg-background border-border" data-testid="student-phone-input" /></div>
                      <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAddStudent} data-testid="submit-student-btn">Add Student</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {academy.students?.length > 0 ? (
                <div className="glass-card rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-mono text-xs">Name</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-xs">Email</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-xs">Status</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-xs w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {academy.students.map(s => (
                        <TableRow key={s.id} className="border-border">
                          <TableCell className="font-medium text-sm">{s.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                          <TableCell>
                            <Badge variant={s.subscription_status === "active" ? "default" : "secondary"} className="text-[10px]">
                              {s.subscription_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => handleRemoveStudent(s.id)} data-testid={`remove-student-${s.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No students yet</p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-center py-16">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-bold mb-2">No Academy Yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create an academy to manage group training.</p>
              <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground font-bold"
                data-testid="create-academy-btn">
                <Plus className="h-4 w-4 mr-1" /> Create Academy
              </Button>
            </div>
          )}
        </>
      )}

      {/* ─── Availability View ─── */}
      {activeView === "availability" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Weekly Availability</h3>
              <p className="text-xs text-muted-foreground">Set your available time slots for 1-on-1 coaching</p>
            </div>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
              onClick={() => { setAvailForm({ day_of_week: "1", start_time: "09:00", end_time: "10:00" }); setAvailOpen(true); }}
              data-testid="add-availability-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
            </Button>
          </div>

          {availability.length > 0 ? (
            <div className="space-y-2">
              {DAY_LABELS.map((day, dayIdx) => {
                const daySlots = availability.filter(a => a.day_of_week === dayIdx);
                if (daySlots.length === 0) return null;
                return (
                  <div key={dayIdx} className="glass-card rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold w-8 text-primary">{day}</span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {daySlots.map(slot => (
                          <div key={slot.id} className="flex items-center gap-1.5 bg-secondary/50 rounded-full px-3 py-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-bold">{slot.start_time} - {slot.end_time}</span>
                            <button onClick={() => handleRemoveAvailability(slot.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No availability set. Add your coaching hours.</p>
            </div>
          )}

          <Dialog open={availOpen} onOpenChange={setAvailOpen}>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader><DialogTitle className="font-display">Add Availability</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Day</Label>
                  <Select value={availForm.day_of_week} onValueChange={v => setAvailForm(p => ({ ...p, day_of_week: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <Input type="time" value={availForm.start_time}
                      onChange={e => setAvailForm(p => ({ ...p, start_time: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <Input type="time" value={availForm.end_time}
                      onChange={e => setAvailForm(p => ({ ...p, end_time: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                </div>
                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAddAvailability}>
                  Add Slot
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ─── Profile View ─── */}
      {activeView === "profile" && (
        <div className="space-y-4 max-w-lg">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-sm">Coaching Profile</h3>
            <div>
              <Label className="text-xs text-muted-foreground">Bio</Label>
              <textarea value={profileForm.coaching_bio}
                onChange={e => setProfileForm(p => ({ ...p, coaching_bio: e.target.value }))}
                rows={3} placeholder="Tell players about your coaching experience..."
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Session Price (₹)</Label>
                <Input type="number" value={profileForm.session_price}
                  onChange={e => setProfileForm(p => ({ ...p, session_price: e.target.value }))}
                  className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                <Input type="number" value={profileForm.session_duration_minutes}
                  onChange={e => setProfileForm(p => ({ ...p, session_duration_minutes: e.target.value }))}
                  className="mt-1 bg-background border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input value={profileForm.city}
                onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))}
                placeholder="e.g. Bengaluru" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Coaching Venue / Location</Label>
              <Input value={profileForm.coaching_venue}
                onChange={e => setProfileForm(p => ({ ...p, coaching_venue: e.target.value }))}
                placeholder="e.g. Koramangala Indoor Court" className="mt-1 bg-background border-border" />
            </div>
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </div>
      )}

      {/* ─── Organization View ─── */}
      {activeView === "organization" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">My Organizations</h3>
              <p className="text-xs text-muted-foreground mt-1">Manage your academies, schools, and colleges</p>
            </div>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
              onClick={() => setShowCreateOrg(!showCreateOrg)} data-testid="create-org-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Organization
            </Button>
          </div>

          {/* Create Organization Inline Form */}
          {showCreateOrg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="glass-card rounded-xl p-5 space-y-4">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> New Organization
              </h4>
              <div>
                <Label className="text-xs text-muted-foreground">Organization Name</Label>
                <Input value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Elite Sports Academy" className="mt-1 bg-background border-border"
                  data-testid="org-name-input" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={orgForm.org_type} onValueChange={v => setOrgForm(p => ({ ...p, org_type: v }))}>
                  <SelectTrigger className="mt-1 bg-background border-border" data-testid="org-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Sports</Label>
                <div className="flex flex-wrap gap-2">
                  {SPORTS.map(sport => (
                    <label key={sport}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${
                        orgForm.sports.includes(sport)
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      <Checkbox
                        checked={orgForm.sports.includes(sport)}
                        onCheckedChange={() => toggleOrgSport(sport)}
                        className="h-3 w-3"
                      />
                      <span className="capitalize">{sport.replace("_", " ")}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input value={orgForm.location} onChange={e => setOrgForm(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. MG Road Complex" className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={orgForm.city} onChange={e => setOrgForm(p => ({ ...p, city: e.target.value }))}
                    placeholder="e.g. Bengaluru" className="mt-1 bg-background border-border" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <textarea value={orgForm.description}
                  onChange={e => setOrgForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} placeholder="Brief description of the organization..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={handleCreateOrg}
                  disabled={orgCreating} data-testid="submit-org-btn">
                  {orgCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Create
                </Button>
                <Button variant="outline" className="font-bold" onClick={() => setShowCreateOrg(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {/* Organization List */}
          {orgsLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-xl text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold mb-1">No Organizations Yet</p>
              <p className="text-sm">Create an organization to manage players and staff.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map(org => {
                const isExpanded = expandedOrgId === org.id;
                const dashboard = orgDashboards[org.id];
                const orgDetail = dashboard?.detail;
                return (
                  <motion.div key={org.id} layout
                    className="glass-card rounded-xl overflow-hidden" data-testid={`org-card-${org.id}`}>
                    {/* Org Card Header */}
                    <button onClick={() => handleToggleOrgExpand(org.id)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-secondary/10 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm truncate">{org.name}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{org.org_type}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />{org.player_count ?? org.players_count ?? 0} players
                            </span>
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />{org.staff_count ?? org.staffs_count ?? 0} staff
                            </span>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Expanded Org Details */}
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="border-t border-border p-4 space-y-5">

                        {/* Org Dashboard Stats */}
                        {dashboard && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-secondary/20 rounded-lg p-3 text-center">
                              <div className="text-lg font-black text-primary">{dashboard.total_records ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Records</div>
                            </div>
                            <div className="bg-secondary/20 rounded-lg p-3 text-center">
                              <div className="text-lg font-black text-primary">{dashboard.total_training_sessions ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Training Sessions</div>
                            </div>
                            <div className="bg-secondary/20 rounded-lg p-3 text-center">
                              <div className="text-lg font-black text-primary">{orgDetail?.players?.length ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Players</div>
                            </div>
                            <div className="bg-secondary/20 rounded-lg p-3 text-center">
                              <div className="text-lg font-black text-primary">{orgDetail?.staff?.length ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Staff</div>
                            </div>
                          </div>
                        )}

                        {/* Players Section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Players</h4>
                            <div className="flex items-center gap-2">
                              <Input value={addPlayerEmail}
                                onChange={e => setAddPlayerEmail(e.target.value)}
                                placeholder="Player email..."
                                className="h-7 text-xs bg-background border-border w-48"
                                onKeyDown={e => e.key === "Enter" && handleAddOrgPlayer(org.id)}
                                data-testid="org-add-player-email" />
                              <Button size="sm" className="h-7 text-[10px] bg-primary text-primary-foreground font-bold"
                                onClick={() => handleAddOrgPlayer(org.id)} disabled={orgActionLoading}
                                data-testid="org-add-player-btn">
                                <UserPlus className="h-3 w-3 mr-1" /> Add Player
                              </Button>
                            </div>
                          </div>
                          {orgDetail?.players?.length > 0 ? (
                            <div className="space-y-1.5">
                              {orgDetail.players.map(p => (
                                <div key={p.id || p.user_id} className="flex items-center justify-between bg-secondary/10 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium truncate">{p.name || p.email}</span>
                                    {p.email && p.name && <span className="text-xs text-muted-foreground truncate">{p.email}</span>}
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0"
                                    onClick={() => handleRemoveOrgPlayer(org.id, p.user_id || p.id)}
                                    disabled={orgActionLoading} data-testid={`org-remove-player-${p.user_id || p.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">No players yet. Add one above.</p>
                          )}
                        </div>

                        {/* Staff Section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Staff</h4>
                            <div className="flex items-center gap-2">
                              <Input value={addStaffEmail}
                                onChange={e => setAddStaffEmail(e.target.value)}
                                placeholder="Staff email..."
                                className="h-7 text-xs bg-background border-border w-48"
                                onKeyDown={e => e.key === "Enter" && handleAddOrgStaff(org.id)}
                                data-testid="org-add-staff-email" />
                              <Button size="sm" className="h-7 text-[10px] bg-primary text-primary-foreground font-bold"
                                onClick={() => handleAddOrgStaff(org.id)} disabled={orgActionLoading}
                                data-testid="org-add-staff-btn">
                                <UserPlus className="h-3 w-3 mr-1" /> Add Staff
                              </Button>
                            </div>
                          </div>
                          {orgDetail?.staff?.length > 0 ? (
                            <div className="space-y-1.5">
                              {orgDetail.staff.map(s => (
                                <div key={s.id || s.user_id} className="flex items-center justify-between bg-secondary/10 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium truncate">{s.name || s.email}</span>
                                    {s.email && s.name && <span className="text-xs text-muted-foreground truncate">{s.email}</span>}
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0"
                                    onClick={() => handleRemoveOrgStaff(org.id, s.user_id || s.id)}
                                    disabled={orgActionLoading} data-testid={`org-remove-staff-${s.user_id || s.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">No staff yet. Add one above.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Packages View ─── */}
      {activeView === "packages" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Monthly Packages</h3>
              <p className="text-xs text-muted-foreground mt-1">Create and manage subscription packages for players</p>
            </div>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
              onClick={() => setShowCreatePkg(!showCreatePkg)} data-testid="create-pkg-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Package
            </Button>
          </div>

          {/* Create Package Dialog */}
          <Dialog open={showCreatePkg} onOpenChange={setShowCreatePkg}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="font-display">Create Monthly Package</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Package Name</Label>
                  <Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pro Training Monthly" className="mt-1 bg-background border-border"
                    data-testid="pkg-name-input" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Sessions/Month</Label>
                    <Input type="number" value={pkgForm.sessions_per_month}
                      onChange={e => setPkgForm(p => ({ ...p, sessions_per_month: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="pkg-sessions-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (Rs.)</Label>
                    <Input type="number" value={pkgForm.price}
                      onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="pkg-price-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                    <Input type="number" value={pkgForm.duration_minutes}
                      onChange={e => setPkgForm(p => ({ ...p, duration_minutes: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="pkg-duration-input" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Sports</Label>
                  <div className="flex flex-wrap gap-2">
                    {SPORTS.map(sport => (
                      <label key={sport}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${
                          pkgForm.sports.includes(sport)
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        <Checkbox
                          checked={pkgForm.sports.includes(sport)}
                          onCheckedChange={() => togglePkgSport(sport)}
                          className="h-3 w-3"
                        />
                        <span className="capitalize">{sport.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input value={pkgForm.description}
                    onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the package..."
                    className="mt-1 bg-background border-border" data-testid="pkg-description-input" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={handleCreatePackage}
                    disabled={pkgCreating} data-testid="submit-pkg-btn">
                    {pkgCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Create Package
                  </Button>
                  <Button variant="outline" className="font-bold" onClick={() => setShowCreatePkg(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Package List */}
          {packages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg, idx) => (
                <motion.div key={pkg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card rounded-xl p-5 flex flex-col gap-3" data-testid={`pkg-card-${pkg.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{pkg.name}</h4>
                        <p className="text-xs text-muted-foreground">{pkg.sessions_per_month} sessions/month</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => handleDeletePackage(pkg.id)} data-testid={`delete-pkg-${pkg.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black text-lg text-primary">Rs.{(pkg.price || 0).toLocaleString()}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.duration_minutes} min/session</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.subscriber_count || 0} subscribers</span>
                  </div>
                  {pkg.sports?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.sports.map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>
                      ))}
                    </div>
                  )}
                  {pkg.description && (
                    <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass-card rounded-xl text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold mb-1">No Packages Yet</p>
              <p className="text-sm">Create a monthly package to offer subscription-based coaching.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Records View ─── */}
      {activeView === "records" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {recordsLoading && orgPlayers.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">Loading records data...</p>
            </div>
          ) : (
            <>
              {/* Submit Record Form */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-display font-bold text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Submit Performance Record
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Player</Label>
                    <Select value={recordForm.player_id} onValueChange={v => setRecordForm(p => ({ ...p, player_id: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border" data-testid="record-player-select">
                        <SelectValue placeholder="Select player..." />
                      </SelectTrigger>
                      <SelectContent>
                        {orgPlayers.map(p => (
                          <SelectItem key={p.user_id || p.id} value={p.user_id || p.id}>
                            {p.name || p.email} {p.org_name ? `(${p.org_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Record Type</Label>
                    <Select value={recordForm.record_type} onValueChange={v => setRecordForm(p => ({ ...p, record_type: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border" data-testid="record-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECORD_TYPES.map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sport</Label>
                    <Select value={recordForm.sport} onValueChange={v => setRecordForm(p => ({ ...p, sport: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPORTS.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" value={recordForm.date}
                      onChange={e => setRecordForm(p => ({ ...p, date: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input value={recordForm.title}
                    onChange={e => setRecordForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Fitness Assessment Q1, 100m Sprint Record"
                    className="mt-1 bg-background border-border" data-testid="record-title-input" />
                </div>

                {/* Stats Key-Value Pairs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Stats (Key-Value Pairs)</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={addStatRow}>
                      <Plus className="h-3 w-3 mr-0.5" /> Add Stat
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {recordForm.stats.map((stat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input value={stat.key}
                          onChange={e => updateStatRow(idx, "key", e.target.value)}
                          placeholder="Key (e.g. speed)"
                          className="flex-1 h-8 text-xs bg-background border-border" />
                        <Input value={stat.value}
                          onChange={e => updateStatRow(idx, "value", e.target.value)}
                          placeholder="Value (e.g. 11.2s)"
                          className="flex-1 h-8 text-xs bg-background border-border" />
                        {recordForm.stats.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => removeStatRow(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <textarea value={recordForm.notes}
                    onChange={e => setRecordForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="Additional notes or observations..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
                </div>

                <Button className="w-full bg-primary text-primary-foreground font-bold"
                  onClick={handleSubmitRecord} disabled={submittingRecord} data-testid="submit-record-btn">
                  {submittingRecord ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Award className="h-4 w-4 mr-1" />}
                  Submit Record
                </Button>
              </div>

              {/* Log Training Form */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-display font-bold text-sm flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" /> Log Training Session
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input value={trainingForm.title}
                      onChange={e => setTrainingForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Morning Drill Session"
                      className="mt-1 bg-background border-border" data-testid="training-title-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sport</Label>
                    <Select value={trainingForm.sport} onValueChange={v => setTrainingForm(p => ({ ...p, sport: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPORTS.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" value={trainingForm.date}
                      onChange={e => setTrainingForm(p => ({ ...p, date: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
                    <Input type="number" value={trainingForm.duration_minutes}
                      onChange={e => setTrainingForm(p => ({ ...p, duration_minutes: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Drills (comma-separated)</Label>
                  <Input value={trainingForm.drills}
                    onChange={e => setTrainingForm(p => ({ ...p, drills: e.target.value }))}
                    placeholder="e.g. Warm-up, Shuttle runs, Smash practice, Cool-down"
                    className="mt-1 bg-background border-border" data-testid="training-drills-input" />
                </div>

                {/* Player Selection Checkboxes */}
                {orgPlayers.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Select Players</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                      {orgPlayers.map(p => {
                        const pId = p.user_id || p.id;
                        const isSelected = trainingForm.player_ids.includes(pId);
                        return (
                          <label key={pId}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${
                              isSelected
                                ? "bg-primary/15 border-primary/40 text-primary"
                                : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                            }`}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePlayerForTraining(pId)}
                              className="h-3 w-3"
                            />
                            <span>{p.name || p.email}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <textarea value={trainingForm.notes}
                    onChange={e => setTrainingForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="Session observations, player feedback..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
                </div>

                <Button className="w-full bg-primary text-primary-foreground font-bold"
                  onClick={handleLogTraining} disabled={submittingTraining} data-testid="submit-training-btn">
                  {submittingTraining ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Dumbbell className="h-4 w-4 mr-1" />}
                  Log Training
                </Button>
              </div>

              {/* Recent Performance Records */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Recent Performance Records</h3>
                {recentRecords.length > 0 ? (
                  recentRecords.map((r, idx) => (
                    <motion.div key={r.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{r.title}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{r.record_type?.replace("_", " ")}</Badge>
                          {r.sport && <Badge className="bg-primary/15 text-primary text-[10px] capitalize">{r.sport}</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{r.date}</span>
                      </div>
                      {r.player_name && (
                        <p className="text-xs text-muted-foreground mb-1">Player: <span className="font-medium text-foreground">{r.player_name}</span></p>
                      )}
                      {r.stats && Object.keys(r.stats).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(r.stats).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-secondary/30 rounded-full px-2 py-0.5 font-mono">
                              {k}: <span className="font-bold text-primary">{v}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {r.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{r.notes}</p>}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 glass-card rounded-xl text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No performance records yet. Submit one above.</p>
                  </div>
                )}
              </div>

              {/* Training Log History */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Training Log History</h3>
                {trainingLogs.length > 0 ? (
                  trainingLogs.map((log, idx) => (
                    <motion.div key={log.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Dumbbell className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-sm">{log.title}</span>
                          {log.sport && <Badge variant="secondary" className="text-[10px] capitalize">{log.sport}</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{log.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {log.duration_minutes && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{log.duration_minutes} min</span>
                        )}
                        {log.player_ids?.length > 0 && (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{log.player_ids.length} players</span>
                        )}
                      </div>
                      {log.drills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {log.drills.map((d, di) => (
                            <span key={di} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-bold">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                      {log.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{log.notes}</p>}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 glass-card rounded-xl text-muted-foreground">
                    <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No training logs yet. Log a session above.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Create Academy Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="font-display">Create Academy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs text-muted-foreground">Academy Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1 bg-background border-border" data-testid="academy-name-input" /></div>
            <div><Label className="text-xs text-muted-foreground">Sport</Label>
              <Input value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                className="mt-1 bg-background border-border" data-testid="academy-sport-input" /></div>
            <div><Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="mt-1 bg-background border-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Monthly Fee</Label>
                <Input type="number" value={form.monthly_fee} onChange={e => setForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))}
                  className="mt-1 bg-background border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Max Students</Label>
                <Input type="number" value={form.max_students} onChange={e => setForm(p => ({ ...p, max_students: Number(e.target.value) }))}
                  className="mt-1 bg-background border-border" /></div>
            </div>
            <div><Label className="text-xs text-muted-foreground">Location</Label>
              <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                className="mt-1 bg-background border-border" /></div>
            <div><Label className="text-xs text-muted-foreground">Schedule</Label>
              <Input value={form.schedule} onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))}
                placeholder="Mon/Wed/Fri 5-7 PM" className="mt-1 bg-background border-border" /></div>
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreate} data-testid="submit-academy-btn">
              Create Academy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function QRCheckinPanel({ sessions = [], onRefresh }) {
  const [scanMode, setScanMode] = useState("camera"); // "camera" | "manual"
  const [qrInput, setQrInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(s => s.date === today && s.status !== "cancelled");
  const checkedIn = todaySessions.filter(s => s.checked_in);
  const notCheckedIn = todaySessions.filter(s => !s.checked_in && s.status === "confirmed");

  const handleVerify = async (code) => {
    const qrData = (code || qrInput).trim();
    if (!qrData) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await coachingAPI.verifyCheckin({ qr_data: qrData });
      setResult(res.data);
      if (onRefresh) onRefresh();
      // Stop camera after successful scan
      stopCamera();
    } catch (err) {
      setResult({ error: true, message: err.response?.data?.detail || "Verification failed" });
    }
    setVerifying(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    setResult(null);

    // Delay to allow the DOM element to mount
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Auto-verify on successful scan
            handleVerify(decodedText);
          },
          () => {} // ignore scan failures
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

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Scanner Mode Toggle */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        <button onClick={() => { setScanMode("camera"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Camera className="h-3.5 w-3.5" />Camera Scan
        </button>
        <button onClick={() => { setScanMode("manual"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <ScanLine className="h-3.5 w-3.5" />Manual Entry
        </button>
        <button onClick={() => { setScanMode("attendance"); stopCamera(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${scanMode === "attendance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <ClipboardList className="h-3.5 w-3.5" />Attendance
          {todaySessions.length > 0 && (
            <span className="ml-0.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {checkedIn.length}/{todaySessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Camera Scanner ─── */}
      {scanMode === "camera" && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base">Scan Player's QR Code</h3>
              <p className="text-xs text-muted-foreground">
                Point your camera at the player's phone to verify check-in.
              </p>
            </div>
          </div>

          {!cameraActive ? (
            <div className="text-center">
              <div className="w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 flex flex-col items-center justify-center mb-4 border-2 border-dashed border-border">
                <Camera className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Camera preview will appear here</p>
                {cameraError && (
                  <p className="text-xs text-destructive mt-2 px-4">{cameraError}</p>
                )}
              </div>
              <Button
                className="bg-gradient-athletic text-white font-bold shadow-glow-primary hover:shadow-glow-hover"
                onClick={startCamera}
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera Scanner
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div
                id="qr-reader"
                ref={scannerRef}
                className="w-full max-w-sm mx-auto rounded-xl overflow-hidden mb-4"
              />
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground font-bold">Scanning... point at QR code</span>
              </div>
              <Button variant="outline" size="sm" onClick={stopCamera} className="text-xs">
                <XCircle className="h-3.5 w-3.5 mr-1" /> Stop Camera
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Manual Entry ─── */}
      {scanMode === "manual" && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base">Manual Code Entry</h3>
              <p className="text-xs text-muted-foreground">
                Type the check-in code shown below the player's QR.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">QR Code Data</Label>
              <Input
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="HORIZON_CHECKIN:session-id:TOKEN"
                className="mt-1 bg-background border-border font-mono text-sm"
                onKeyDown={e => e.key === "Enter" && handleVerify()}
                data-testid="qr-input"
              />
            </div>
            <Button
              className="w-full bg-gradient-athletic text-white font-bold shadow-glow-primary hover:shadow-glow-hover"
              onClick={() => handleVerify()}
              disabled={verifying || !qrInput.trim()}
              data-testid="verify-qr-btn"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Verify Check-in
            </Button>
          </div>
        </div>
      )}

      {/* ─── Attendance Tracker ─── */}
      {scanMode === "attendance" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm">Today's Attendance</h3>
                  <p className="text-[10px] text-muted-foreground">{today}</p>
                </div>
              </div>
              {todaySessions.length > 0 && (
                <div className="text-right">
                  <div className="font-display font-black text-xl text-primary">
                    {checkedIn.length}/{todaySessions.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold">Checked In</div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {todaySessions.length > 0 && (
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-athletic rounded-full transition-all duration-500"
                  style={{ width: `${(checkedIn.length / todaySessions.length) * 100}%` }}
                />
              </div>
            )}

            {todaySessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No sessions scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Not checked in (show first) */}
                {notCheckedIn.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/50">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <UserX className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{s.player_name}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{s.sport}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.start_time} - {s.end_time}
                      </div>
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">
                      Pending
                    </Badge>
                  </div>
                ))}

                {/* Checked in */}
                {checkedIn.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <UserCheck className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{s.player_name}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{s.sport}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.start_time} - {s.end_time}
                        {s.checkin_time && (
                          <span className="ml-2 text-emerald-400">
                            Checked in at {new Date(s.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] shrink-0">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Present
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Result (shown for camera + manual modes) */}
      {scanMode !== "attendance" && result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border-2 p-6 text-center ${
            result.error
              ? "border-destructive/50 bg-destructive/5"
              : result.already_checked_in
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-emerald-500/50 bg-emerald-500/5"
          }`}
          data-testid="checkin-result"
        >
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
              <p className="text-sm text-muted-foreground mt-1">
                {result.player_name} has already checked in for this session.
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
              <p className="font-display font-bold text-lg text-emerald-400">Check-in Successful!</p>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-bold text-foreground">{result.player_name}</span> checked in
              </p>
              {result.booking && (
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{result.booking.date}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.booking.start_time}</span>
                  {result.booking.sport && (
                    <Badge variant="secondary" className="text-[10px] capitalize">{result.booking.sport}</Badge>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
