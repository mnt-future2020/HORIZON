import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { academyAPI, coachingAPI, organizationAPI, performanceAPI, trainingAPI, payoutAPI } from "@/lib/api";
import { fmt12h } from "@/lib/utils";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  GraduationCap, Users, IndianRupee, Clock, Plus, Trash2, UserPlus,
  TrendingUp, Calendar, Star, CheckCircle, XCircle, Play, Settings,
  QrCode, ScanLine, Loader2, ShieldCheck, Camera, ClipboardList, UserCheck, UserX,
  Building2, FileText, Dumbbell, ChevronDown, ChevronUp, Award, Activity, BadgeCheck, Package,
  Upload, AlertTriangle, Info, X, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Filter, Pencil,
  Eye, Download, MessageCircle, Banknote, CheckCircle2
} from "lucide-react";

const COACH_HERO = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80";
const ACADEMY_EMPTY = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table_tennis", "swimming"];
const PKG_TYPES = [
  { value: "monthly",   label: "Monthly",   priceLabel: "/month",    sessionsLabel: "Sessions/Month" },
  { value: "quarterly", label: "Quarterly", priceLabel: "/quarter",  sessionsLabel: "Sessions/Quarter" },
  { value: "one_time",  label: "One-time",  priceLabel: "one-time",  sessionsLabel: "Total Sessions" },
  { value: "batch",     label: "Batch",     priceLabel: "per batch", sessionsLabel: "Batch Sessions" },
];
const PKG_FEATURES_PRESET = [
  "Video analysis", "WhatsApp group", "Progress reports",
  "Fitness assessment", "Nutrition guidance", "Competition prep",
];
const ORG_TYPES = ["academy", "school", "college"];
const RECORD_TYPES = ["assessment", "achievement", "match_result", "training"];
const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

export default function CoachDashboard({ defaultView }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isIndividualCoach = user?.coach_type === "individual";
  const coachSports = user?.coaching_sports?.length ? user.coaching_sports : SPORTS;

  // Derive view from route for individual coaches
  const routeView = location.pathname === "/coach/manage" ? "coach_mgmt" : (isIndividualCoach ? "home" : "coaching");
  const [activeView, setActiveView] = useState(() => {
    if (location.pathname === "/coach/manage") return "coach_mgmt";
    const saved = sessionStorage.getItem("coachDashReturnTab");
    if (saved) { sessionStorage.removeItem("coachDashReturnTab"); return saved; }
    return isIndividualCoach ? "home" : "coaching";
  });

  // Sync activeView when route changes
  useEffect(() => {
    setActiveView(routeView);
  }, [routeView]);
  const [coachingSubTab, setCoachingSubTab] = useState("sessions");
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
  // Academy enhanced state
  const [academyTab, setAcademyTab] = useState("overview");
  const [enrollments, setEnrollments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [feeStatus, setFeeStatus] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: "", max_students: 30, start_time: "06:00", end_time: "08:00", days: [] });
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBatchForAttendance, setSelectedBatchForAttendance] = useState("");
  const [presentStudents, setPresentStudents] = useState(new Set());
  const [collectFeeOpen, setCollectFeeOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({ student_id: "", amount: 0, payment_method: "cash", period_month: new Date().toISOString().slice(0, 7), notes: "" });
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressStudent, setProgressStudent] = useState("");
  const [progressForm, setProgressForm] = useState({ skill_ratings: {}, assessment_type: "monthly", notes: "" });
  const [progressHistory, setProgressHistory] = useState([]);
  const [assignBatchOpen, setAssignBatchOpen] = useState(false);
  const [assignBatchId, setAssignBatchId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  // Sessions state
  const [sessionStats, setSessionStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [availability, setAvailability] = useState([]);
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
  const [pkgForm, setPkgForm] = useState({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "", type: "monthly", max_subscribers: "", features: [], is_public: true });
  const [pkgCreating, setPkgCreating] = useState(false);
  const [editPkgId, setEditPkgId] = useState(null);
  const [confirmDeletePkgId, setConfirmDeletePkgId] = useState(null);

  // ─── Individual Coach state ───
  const [clients, setClients] = useState([]);
  const [clientFilter, setClientFilter] = useState("all");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [viewClientId, setViewClientId] = useState(null);
  const [viewClientData, setViewClientData] = useState(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", phone: "", email: "", sport: "badminton", source: "walk_in", notes: "", payment_mode: "cash", monthly_fee: 0, reminder_day: 1, age: "", skill_level: "", coaching_goal: "", guardian_name: "" });
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [waSettings, setWaSettings] = useState({});
  const [waLogs, setWaLogs] = useState([]);
  const [waLoading, setWaLoading] = useState(false);
  const [offlineSessions, setOfflineSessions] = useState([]);
  const [logSessionOpen, setLogSessionOpen] = useState(false);
  const [offlineSessionForm, setOfflineSessionForm] = useState({ client_id: "", date: new Date().toISOString().slice(0, 10), start_time: "06:00", end_time: "07:00", sport: "badminton", amount: "500", payment_status: "paid", payment_mode: "cash", notes: "" });
  const [payments, setPayments] = useState([]);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ client_id: "", amount: "", mode: "cash", reference: "", period: new Date().toISOString().slice(0, 7), notes: "" });
  const [revenueData, setRevenueData] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [mgmtTab, setMgmtTab] = useState("schedule");
  const [indScheduleTab, setIndScheduleTab] = useState("upcoming");
  // ─── Schedule filters ───
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all"); // all | today | upcoming | completed | cancelled
  const [sessionSearch, setSessionSearch] = useState("");
  const [offlineLogClientFilter, setOfflineLogClientFilter] = useState("");
  const [offlineLogPaymentFilter, setOfflineLogPaymentFilter] = useState("all");
  const [offlineLogDateFrom, setOfflineLogDateFrom] = useState("");
  const [offlineLogDateTo, setOfflineLogDateTo] = useState("");
  // ─── Client filters ───
  const [clientSearch, setClientSearch] = useState("");
  const [clientSportFilter, setClientSportFilter] = useState("all");
  const [clientSortBy, setClientSortBy] = useState("name"); // name | joined | fee
  // ─── Finance enhanced state ───
  const [financeSubTab, setFinanceSubTab] = useState("overview");
  const [financeSummaryData, setFinanceSummaryData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionFilters, setTransactionFilters] = useState({ date_from: "", date_to: "", type: "all", category: "", payment_mode: "" });
  const [expenses, setExpenses] = useState([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "venue_rent", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_mode: "cash", reference: "" });
  const [editExpenseId, setEditExpenseId] = useState(null);
  const [clientOutstanding, setClientOutstanding] = useState([]);
  const [outstandingFilter, setOutstandingFilter] = useState("all");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  // ─── Invoice state ───
  const [invoices, setInvoices] = useState([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState([{ description: "", qty: "1", rate: "" }]);
  const [invoiceForm, setInvoiceForm] = useState({ client_id: "", client_name: "", client_phone: "", client_email: "", date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: "sent", payment_mode: "cash", gst_enabled: false, notes: "" });
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [gstSettings, setGstSettings] = useState({ gst_enabled: false, gst_rate: 18, gstin: "", invoice_prefix: "INV" });
  const [showGSTSettings, setShowGSTSettings] = useState(false);
  const [gstSaving, setGstSaving] = useState(false);

  // ─── Payout state ───
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [myPayouts, setMyPayouts] = useState([]);
  const [linkedAccount, setLinkedAccount] = useState(null);
  const [bankForm, setBankForm] = useState({ account_number: "", ifsc_code: "", beneficiary_name: "", bank_name: "", business_type: "individual", phone: "", email: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [payoutDetailDialog, setPayoutDetailDialog] = useState(null);

  const loadAcademyData = useCallback(async () => {
    try {
      const res = await academyAPI.list();
      const allAcademies = res.data?.academies || res.data || [];
      const myAcademies = (Array.isArray(allAcademies) ? allAcademies : []).filter(a => a.coach_id === user?.id);
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

  // ─── Individual Coach data loaders ───
  const loadClients = useCallback(async () => {
    try {
      const res = await coachingAPI.listClients();
      setClients(res.data || []);
    } catch { setClients([]); }
  }, []);

  const openClientProfile = useCallback(async (clientId) => {
    setViewClientId(clientId);
    setViewClientData(null);
    setClientProfileLoading(true);
    try {
      const res = await coachingAPI.getClient(clientId);
      setViewClientData(res.data);
    } catch { setViewClientData(null); }
    finally { setClientProfileLoading(false); }
  }, []);

  const loadOfflineSessions = useCallback(async () => {
    try {
      const res = await coachingAPI.listOfflineSessions();
      setOfflineSessions(res.data || []);
    } catch { setOfflineSessions([]); }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const res = await coachingAPI.listPayments();
      setPayments(res.data || []);
    } catch { setPayments([]); }
  }, []);

  const loadRevenue = useCallback(async () => {
    try {
      const res = await coachingAPI.revenueAnalytics();
      setRevenueData(res.data);
    } catch { setRevenueData(null); }
  }, []);

  const loadFinanceSummary = useCallback(async () => {
    try {
      const res = await coachingAPI.financeSummary();
      setFinanceSummaryData(res.data);
    } catch { setFinanceSummaryData(null); }
  }, []);

  const loadTransactions = useCallback(async (filters = {}) => {
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.type && filters.type !== "all") params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.payment_mode) params.payment_mode = filters.payment_mode;
    try {
      const res = await coachingAPI.listTransactions(params);
      setTransactions(res.data || []);
    } catch { setTransactions([]); }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      const res = await coachingAPI.listExpenses();
      setExpenses(res.data || []);
    } catch { setExpenses([]); }
  }, []);

  const loadPayoutData = useCallback(async () => {
    try {
      const [summaryRes, payoutsRes, accountRes] = await Promise.allSettled([
        payoutAPI.mySummary(),
        payoutAPI.myPayouts(),
        payoutAPI.getLinkedAccount(),
      ]);
      if (summaryRes.status === "fulfilled") setPayoutSummary(summaryRes.value.data);
      if (payoutsRes.status === "fulfilled") { const pd = payoutsRes.value.data; setMyPayouts(Array.isArray(pd) ? pd : pd?.settlements || []); }
      if (accountRes.status === "fulfilled") { const ad = accountRes.value.data; setLinkedAccount(ad?.linked === false ? null : ad); }
    } catch {}
  }, []);

  const loadClientOutstanding = useCallback(async () => {
    try {
      const res = await coachingAPI.clientOutstanding();
      setClientOutstanding(res.data || []);
    } catch { setClientOutstanding([]); }
  }, []);

  const loadOnboarding = useCallback(async () => {
    try {
      const res = await coachingAPI.onboardingStatus();
      setOnboardingData(res.data);
    } catch { setOnboardingData(null); }
  }, []);

  const loadInvoices = useCallback(async (params = {}) => {
    try {
      const res = await coachingAPI.listInvoices(params);
      setInvoices(res.data || []);
    } catch { setInvoices([]); }
  }, []);

  const loadGstSettings = useCallback(async () => {
    try {
      const res = await coachingAPI.getGstSettings();
      setGstSettings(res.data || { gst_enabled: false, gst_rate: 18, gstin: "", invoice_prefix: "INV" });
    } catch { }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (isIndividualCoach) {
      Promise.all([loadSessionData(), loadPackages(), loadClients(), loadOfflineSessions(), loadPayments(), loadRevenue(), loadOnboarding()])
        .finally(() => setLoading(false));
    } else {
      Promise.all([loadAcademyData(), loadSessionData(), loadPackages()]).finally(() => setLoading(false));
    }
  }, [isIndividualCoach, loadAcademyData, loadSessionData, loadPackages, loadClients, loadOfflineSessions, loadPayments, loadRevenue, loadOnboarding]);

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

  // Load records data when switching to records sub-tab
  useEffect(() => {
    if (activeView === "coaching" && coachingSubTab === "records") {
      loadRecordsData();
    }
  }, [activeView, coachingSubTab, loadRecordsData]);

  // Load finance data when switching to finance tab
  useEffect(() => {
    if (activeView === "coach_mgmt" && mgmtTab === "finance") {
      loadFinanceSummary();
      loadPayoutData();
      loadExpenses();
      loadClientOutstanding();
      loadTransactions(transactionFilters);
      loadInvoices({ month: invoiceMonth, status: invoiceStatusFilter !== "all" ? invoiceStatusFilter : undefined });
      loadGstSettings();
    }
  }, [activeView, mgmtTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Enhanced academy data loader
  const loadAcademyEnhanced = useCallback(async () => {
    if (!selectedAcademy) return;
    const id = selectedAcademy.id;
    try {
      const [enrollRes, batchRes, statsRes, feeRes, attStatsRes] = await Promise.all([
        academyAPI.listEnrollments(id).catch(() => ({ data: [] })),
        academyAPI.listBatches(id).catch(() => ({ data: [] })),
        academyAPI.getDashboard(id).catch(() => ({ data: null })),
        academyAPI.getFeeStatus(id).catch(() => ({ data: [] })),
        academyAPI.getAttendanceStats(id).catch(() => ({ data: null })),
      ]);
      setEnrollments(enrollRes.data || []);
      setBatches(batchRes.data || []);
      setDashboardStats(statsRes.data);
      setFeeStatus(feeRes.data || []);
      setAttendanceStats(attStatsRes.data);
    } catch { /* ignore */ }
  }, [selectedAcademy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeView === "academy" && selectedAcademy) loadAcademyEnhanced();
  }, [activeView, selectedAcademy?.id, loadAcademyEnhanced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Batch handlers
  const handleCreateBatch = async () => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.createBatch(selectedAcademy.id, batchForm);
      toast.success("Batch created!");
      setBatchOpen(false);
      setBatchForm({ name: "", max_students: 30, start_time: "06:00", end_time: "08:00", days: [] });
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleDeleteBatch = async (batchId) => {
    try {
      await academyAPI.deleteBatch(batchId);
      toast.success("Batch deactivated");
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleAssignBatch = async () => {
    if (!assignBatchId || !assignStudentId) return;
    try {
      await academyAPI.assignBatch(assignBatchId, { student_id: assignStudentId });
      toast.success("Student assigned to batch!");
      setAssignBatchOpen(false);
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // Attendance handlers
  const handleMarkAttendance = async () => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.markAttendance(selectedAcademy.id, {
        date: attendanceDate,
        batch_id: selectedBatchForAttendance,
        present_student_ids: Array.from(presentStudents),
      });
      toast.success("Attendance marked!");
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // Fee handlers
  const handleCollectFee = async () => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.collectFee(selectedAcademy.id, feeForm);
      toast.success("Fee collected!");
      setCollectFeeOpen(false);
      setFeeForm({ student_id: "", amount: 0, payment_method: "cash", period_month: new Date().toISOString().slice(0, 7), notes: "" });
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // Progress handlers
  const handleAddProgress = async () => {
    if (!selectedAcademy || !progressStudent) return;
    try {
      await academyAPI.addProgress(selectedAcademy.id, progressStudent, progressForm);
      toast.success("Progress recorded!");
      setProgressOpen(false);
      setProgressForm({ skill_ratings: {}, assessment_type: "monthly", notes: "" });
      loadAcademyEnhanced();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleLoadProgress = async (studentId) => {
    if (!selectedAcademy) return;
    try {
      const res = await academyAPI.getProgress(selectedAcademy.id, studentId);
      setProgressHistory(res.data || []);
    } catch { setProgressHistory([]); }
  };
  const handleCancelEnrollment = async (enrollmentId) => {
    try {
      await academyAPI.cancelEnrollment(enrollmentId);
      toast.success("Enrollment cancelled");
      loadAcademyData();
      loadAcademyEnhanced();
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
        type: pkgForm.type,
        sessions_per_month: parseInt(pkgForm.sessions_per_month),
        price: parseInt(pkgForm.price),
        duration_minutes: parseInt(pkgForm.duration_minutes),
        sports: pkgForm.sports,
        description: pkgForm.description,
        max_subscribers: pkgForm.max_subscribers ? parseInt(pkgForm.max_subscribers) : null,
        features: pkgForm.features,
        is_public: pkgForm.is_public,
      });
      toast.success("Package created!");
      setShowCreatePkg(false);
      setEditPkgId(null);
      setPkgForm({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "", type: "monthly", max_subscribers: "", features: [], is_public: true });
      loadPackages();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create package"); }
    setPkgCreating(false);
  };

  const handleUpdatePackage = async () => {
    if (!pkgForm.name.trim()) { toast.error("Package name is required"); return; }
    setPkgCreating(true);
    try {
      await coachingAPI.updatePackage(editPkgId, {
        name: pkgForm.name,
        type: pkgForm.type,
        sessions_per_month: parseInt(pkgForm.sessions_per_month),
        price: parseInt(pkgForm.price),
        duration_minutes: parseInt(pkgForm.duration_minutes),
        sports: pkgForm.sports,
        description: pkgForm.description,
        max_subscribers: pkgForm.max_subscribers ? parseInt(pkgForm.max_subscribers) : null,
        features: pkgForm.features,
        is_public: pkgForm.is_public,
      });
      toast.success("Package updated!");
      setShowCreatePkg(false);
      setEditPkgId(null);
      setPkgForm({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "", type: "monthly", max_subscribers: "", features: [], is_public: true });
      loadPackages();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to update package"); }
    setPkgCreating(false);
  };

  const openEditPkg = (pkg) => {
    setPkgForm({
      name: pkg.name,
      type: pkg.type || "monthly",
      sessions_per_month: String(pkg.sessions_per_month),
      price: String(pkg.price),
      duration_minutes: String(pkg.duration_minutes || 60),
      sports: pkg.sports || [],
      description: pkg.description || "",
      max_subscribers: pkg.max_subscribers ? String(pkg.max_subscribers) : "",
      features: pkg.features || [],
      is_public: pkg.is_public !== false,
    });
    setEditPkgId(pkg.id);
    setShowCreatePkg(true);
  };

  const handleDeletePackage = async (id) => {
    try {
      await coachingAPI.deletePackage(id);
      toast.success("Package deleted");
      setConfirmDeletePkgId(null);
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

  // ─── Individual Coach handlers ───
  const handleAddClient = async () => {
    if (!clientForm.name.trim()) { toast.error("Client name is required"); return; }
    try {
      await coachingAPI.addClient(clientForm);
      toast.success("Client added!");
      setAddClientOpen(false);
      setClientForm({ name: "", phone: "", email: "", sport: "badminton", source: "walk_in", notes: "", payment_mode: "cash", monthly_fee: 0, reminder_day: 1, age: "", skill_level: "", coaching_goal: "", guardian_name: "" });
      loadClients();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleSendWelcome = async (clientId, e) => {
    e.stopPropagation();
    try {
      const res = await coachingAPI.sendWelcomeWhatsapp(clientId);
      if (res.data?.ok === false && res.data?.wa_link) {
        window.open(res.data.wa_link, "_blank");
        toast("WhatsApp not configured — opened manual link", { icon: "📱" });
      } else {
        toast.success("Welcome message sent via WhatsApp!");
        loadClients();
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.wa_link) { window.open(d.wa_link, "_blank"); toast("Opened manual WhatsApp link", { icon: "📱" }); }
      else toast.error(d?.detail || "Failed to send");
    }
  };

  const handleSendReminder = async (clientId, e) => {
    e.stopPropagation();
    try {
      const res = await coachingAPI.sendPaymentReminder(clientId);
      if (res.data?.ok) {
        if (res.data.whatsapp_sent) toast.success("Payment reminder sent via WhatsApp!");
        else { window.open(res.data.wa_fallback, "_blank"); toast("WhatsApp not configured — opened manual link", { icon: "💰" }); }
      }
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to send reminder"); }
  };

  const loadReminders = async () => {
    setRemindersLoading(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const res = await coachingAPI.listReminders({ month: currentMonth });
      setReminders(res.data || []);
    } catch { /* silent */ }
    finally { setRemindersLoading(false); }
  };

  const handleRunDailyReminders = async () => {
    try {
      await coachingAPI.runDailyReminders();
      toast.success("Daily reminders triggered!");
      loadReminders();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const loadWaSettings = async () => {
    setWaLoading(true);
    try {
      const [s, l] = await Promise.all([coachingAPI.getWaSettings(), coachingAPI.getWaLogs()]);
      setWaSettings(s.data || {});
      setWaLogs(l.data || []);
    } catch { /* silent */ }
    finally { setWaLoading(false); }
  };

  const handleWaToggle = async (key, enabled) => {
    const next = { ...waSettings, [key]: { ...waSettings[key], enabled } };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({ [key]: { ...waSettings[key], enabled } });
      setWaSettings(res.data);
      toast.success(enabled ? "Automation enabled" : "Automation disabled");
    } catch { toast.error("Failed to update"); setWaSettings(waSettings); }
  };

  const handleWaConfigChange = async (key, field, value) => {
    const next = { ...waSettings, [key]: { ...waSettings[key], [field]: value } };
    setWaSettings(next);
    try {
      const res = await coachingAPI.updateWaSettings({ [key]: next[key] });
      setWaSettings(res.data);
    } catch { toast.error("Failed to update"); }
  };

  const handleDeactivateClient = async (id) => {
    try {
      await coachingAPI.deactivateClient(id);
      toast.success("Client deactivated");
      loadClients();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleLogOfflineSession = async () => {
    try {
      await coachingAPI.logOfflineSession({
        ...offlineSessionForm,
        amount: parseFloat(offlineSessionForm.amount) || 0,
      });
      toast.success("Session logged!");
      setLogSessionOpen(false);
      setOfflineSessionForm({ client_id: "", date: new Date().toISOString().slice(0, 10), start_time: "06:00", end_time: "07:00", sport: "badminton", amount: "500", payment_status: "paid", payment_mode: "cash", notes: "" });
      loadOfflineSessions();
      loadRevenue();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast.error("Amount is required"); return; }
    try {
      const selectedClient = clients.find(c => c.id === paymentForm.client_id);
      await coachingAPI.recordOfflinePayment({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
        client_name: selectedClient?.name || "",
      });
      toast.success("Payment recorded!");
      setRecordPaymentOpen(false);
      setPaymentForm({ client_id: "", amount: "", mode: "cash", reference: "", period: new Date().toISOString().slice(0, 7), notes: "" });
      loadPayments();
      loadRevenue();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // ─── Finance / Expense handlers ───
  const handleSaveExpense = async () => {
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { toast.error("Amount is required"); return; }
    try {
      const payload = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
      if (editExpenseId) {
        await coachingAPI.updateExpense(editExpenseId, payload);
        toast.success("Expense updated!");
        setEditExpenseId(null);
      } else {
        await coachingAPI.createExpense(payload);
        toast.success("Expense added!");
      }
      setAddExpenseOpen(false);
      setExpenseForm({ category: "venue_rent", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_mode: "cash", reference: "" });
      loadExpenses();
      loadFinanceSummary();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await coachingAPI.deleteExpense(id);
      toast.success("Expense deleted");
      loadExpenses();
      loadFinanceSummary();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const openEditExpense = (exp) => {
    setExpenseForm({
      category: exp.category,
      amount: String(exp.amount),
      date: exp.date,
      description: exp.description || "",
      payment_mode: exp.payment_mode || "cash",
      reference: exp.reference || "",
    });
    setEditExpenseId(exp.id);
    setAddExpenseOpen(true);
  };

  // ─── Invoice handlers ───
  const handleCreateInvoice = async () => {
    const validItems = invoiceItems.filter(i => i.description.trim() && parseFloat(i.rate) > 0);
    if (!validItems.length) { toast.error("Add at least one item with description and rate"); return; }
    if (!invoiceForm.client_name.trim()) { toast.error("Client name is required"); return; }
    setInvoiceCreating(true);
    try {
      await coachingAPI.createInvoice({
        ...invoiceForm,
        gst_enabled: invoiceForm.gst_enabled,
        gst_rate: gstSettings.gst_rate,
        items: validItems.map(i => ({ description: i.description, qty: parseFloat(i.qty) || 1, rate: parseFloat(i.rate) || 0 })),
      });
      toast.success("Invoice created!");
      setShowCreateInvoice(false);
      setInvoiceItems([{ description: "", qty: "1", rate: "" }]);
      setInvoiceForm({ client_id: "", client_name: "", client_phone: "", client_email: "", date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: "sent", payment_mode: "cash", gst_enabled: false, notes: "" });
      loadInvoices({ month: invoiceMonth });
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create invoice"); }
    setInvoiceCreating(false);
  };

  const handleMarkInvoicePaid = async (id) => {
    try {
      await coachingAPI.markInvoicePaid(id);
      toast.success("Invoice marked as paid");
      loadInvoices({ month: invoiceMonth });
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleDeleteInvoice = async (id) => {
    try {
      await coachingAPI.deleteInvoice(id);
      toast.success("Invoice deleted");
      loadInvoices({ month: invoiceMonth });
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleViewInvoicePdf = async (inv) => {
    try {
      const res = await coachingAPI.getInvoicePdf(inv.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch { toast.error("Failed to generate PDF"); }
  };

  const handleDownloadInvoicePdf = async (inv) => {
    try {
      const res = await coachingAPI.getInvoicePdf(inv.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${inv.invoice_no}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Failed to download PDF"); }
  };

  const handleSendInvoiceWhatsapp = async (inv) => {
    try {
      const res = await coachingAPI.sendInvoiceWhatsapp(inv.id);
      if (res.data.sent_via_api) {
        toast.success("Invoice sent via WhatsApp!");
      } else {
        window.open(res.data.wa_link, "_blank");
        toast.success("Opening WhatsApp...");
      }
    } catch { toast.error("Failed"); }
  };

  const handleSaveGstSettings = async () => {
    setGstSaving(true);
    try {
      const res = await coachingAPI.saveGstSettings(gstSettings);
      setGstSettings(res.data);
      toast.success("GST settings saved!");
      setShowGSTSettings(false);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    setGstSaving(false);
  };

  // Invoice computed totals
  const invoiceSubtotal = invoiceItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0);
  const invoiceGstAmt = invoiceForm.gst_enabled ? invoiceSubtotal * gstSettings.gst_rate / 100 : 0;
  const invoiceTotal = invoiceSubtotal + invoiceGstAmt;

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
      toast.success("Lobbian added!");
      setAddPlayerEmail("");
      loadOrgDashboard(orgId);
      loadOrganizations();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add Lobbian"); }
    setOrgActionLoading(false);
  };

  const handleRemoveOrgPlayer = async (orgId, userId) => {
    setOrgActionLoading(true);
    try {
      await organizationAPI.removePlayer(orgId, userId);
      toast.success("Lobbian removed");
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
    if (!recordForm.player_id) { toast.error("Select a Lobbian"); return; }
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
  const upcomingSessions = sessions.filter(s => s.status === "confirmed" || s.status === "payment_pending");
  const completedSessions = sessions.filter(s => s.status === "completed");

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const verificationStatus = user?.doc_verification_status || "not_uploaded";

  const VIEWS = isIndividualCoach
    ? [
        { id: "home", icon: TrendingUp, label: "Dashboard" },
        { id: "coach_mgmt", icon: ClipboardList, label: "Coach Management" },
      ]
    : [
        { id: "coaching", icon: Play, label: "Coaching" },
        { id: "academy", icon: GraduationCap, label: "Academy" },
        { id: "organization", icon: Building2, label: "Organization" },
      ];

  const COACHING_SUB_TABS = [
    { id: "sessions", icon: Calendar, label: "Sessions" },
    { id: "checkin", icon: QrCode, label: "Check-in" },
    { id: "packages", icon: Package, label: "Packages" },
    { id: "records", icon: FileText, label: "Records" },
  ];

  const MGMT_SUB_TABS = [
    { id: "schedule", icon: Calendar, label: "Schedule" },
    { id: "clients", icon: Users, label: "Clients" },
    { id: "packages", icon: Package, label: "Packages" },
    { id: "finance", icon: IndianRupee, label: "Finance" },
    { id: "reviews", icon: Star, label: "Reviews" },
    { id: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6" data-testid="coach-dashboard">
      {/* Welcome Hero, Verification, Stats — only on Dashboard home */}
      {activeView !== "coach_mgmt" && (<>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
        <div className="grid md:grid-cols-3 gap-0 relative">
          <div className="md:col-span-2 p-8 md:p-10 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coach Dashboard</span>
              {user?.doc_verification_status === "verified" && (
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
          {/* Profile button - top right */}
          <button onClick={() => navigate("/profile")}
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background hover:border-primary/30 transition-all text-xs font-bold text-muted-foreground hover:text-foreground"
            data-testid="coach-profile-btn">
            <Settings className="h-4 w-4" /> Profile
          </button>
        </div>
      </motion.div>

      {/* Verification Banner */}
      {verificationStatus !== "verified" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`mb-6 rounded-xl border-2 p-4 flex items-center justify-between gap-3 cursor-pointer ${
            verificationStatus === "rejected" ? "border-red-500/30 bg-red-500/5" :
            verificationStatus === "pending_review" ? "border-blue-500/30 bg-blue-500/5" :
            "border-amber-500/30 bg-amber-500/5"
          }`}
          onClick={() => navigate("/profile")}>
          <div className="flex items-center gap-3">
            {verificationStatus === "rejected" ? <XCircle className="h-5 w-5 text-red-500 shrink-0" /> :
             verificationStatus === "pending_review" ? <Info className="h-5 w-5 text-blue-500 shrink-0" /> :
             <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />}
            <div>
              <p className={`text-sm font-bold ${
                verificationStatus === "rejected" ? "text-red-500" :
                verificationStatus === "pending_review" ? "text-blue-500" : "text-amber-500"
              }`}>
                {verificationStatus === "rejected" ? "Verification Rejected" :
                 verificationStatus === "pending_review" ? "Documents Under Review" :
                 "Complete Your Profile Verification"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {verificationStatus === "rejected"
                  ? `Reason: ${user?.doc_rejection_reason || "Please re-upload your documents."}`
                  : verificationStatus === "pending_review"
                  ? "Your documents are being reviewed by our team."
                  : "Upload your documents to get verified and start coaching."}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">Go to Profile</Badge>
        </motion.div>
      )}

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
      </>)}

      {/* View Tabs */}
      {!isIndividualCoach && (
        <div className="flex gap-1 mb-6 bg-secondary/30 p-1 rounded-lg w-fit flex-wrap">
          {VIEWS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeView === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`coach-tab-${id}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Coaching View (with sub-tabs) ─── */}
      {activeView === "coaching" && (
        <>
          <div className="flex gap-1 mb-6 bg-secondary/20 p-1 rounded-lg w-fit flex-wrap">
            {COACHING_SUB_TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setCoachingSubTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${coachingSubTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

      {/* Sessions Sub-tab */}
      {coachingSubTab === "sessions" && (
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
                      {s.status === "payment_pending"
                        ? <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Awaiting Payment</Badge>
                        : <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt12h(s.start_time)} - {fmt12h(s.end_time)}</span>
                      <span className="font-bold text-primary">₹{s.price}</span>
                      {s.location && <span className="text-muted-foreground">{s.location}</span>}
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{s.notes}"</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {s.status === "confirmed" && (
                      <Button size="sm" className="bg-brand-600 text-white font-bold text-[10px] h-7"
                        onClick={() => handleCompleteSession(s.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" />Done
                      </Button>
                    )}
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
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">No sessions yet. Set up your availability to start receiving bookings!</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/coach/settings")}>
                Set Availability
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Check-in Sub-tab */}
      {coachingSubTab === "checkin" && (
        <QRCheckinPanel sessions={sessions} onRefresh={loadSessionData} />
      )}

      {/* Availability moved to Settings */}
      {coachingSubTab === "availability" && (
        <div className="space-y-4">
          <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-semibold">Availability has moved to Settings</p>
            <p className="text-xs mt-1 opacity-70">Manage your weekly time slots in Coach Settings</p>
            <Button size="sm" className="mt-4 bg-primary text-primary-foreground font-bold text-xs"
              onClick={() => navigate("/coach/settings")}>
              <Settings className="h-3.5 w-3.5 mr-1.5" /> Open Settings
            </Button>
          </div>
        </div>
      )}

      {/* Packages Sub-tab */}
      {coachingSubTab === "packages" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Monthly Packages</h3>
              <p className="text-xs text-muted-foreground mt-1">Create and manage subscription packages for Lobbians</p>
            </div>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
              onClick={() => setShowCreatePkg(!showCreatePkg)} data-testid="create-pkg-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Package
            </Button>
          </div>
          <Dialog open={showCreatePkg} onOpenChange={setShowCreatePkg}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Create Package</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Package Name *</Label>
                  <Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pro Training Monthly" className="mt-1 bg-background border-border"
                    data-testid="pkg-name-input" />
                </div>
                {/* Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Package Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {PKG_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setPkgForm(p => ({ ...p, type: t.value }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          pkgForm.type === t.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>{t.label}</button>
                    ))}
                  </div>
                </div>
                {/* Sessions / Price / Duration */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{PKG_TYPES.find(t => t.value === pkgForm.type)?.sessionsLabel || "Sessions/Month"}</Label>
                    <Input type="number" value={pkgForm.sessions_per_month}
                      onChange={e => setPkgForm(p => ({ ...p, sessions_per_month: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="pkg-sessions-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (₹)</Label>
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
                {/* Sports */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Sports</Label>
                  <div className="flex flex-wrap gap-2">
                    {coachSports.map(sport => (
                      <label key={sport}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${
                          pkgForm.sports.includes(sport)
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        <Checkbox checked={pkgForm.sports.includes(sport)} onCheckedChange={() => togglePkgSport(sport)} className="h-3 w-3" />
                        <span className="capitalize">{sport.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Features */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Included Features</Label>
                  <div className="flex flex-wrap gap-2">
                    {PKG_FEATURES_PRESET.map(f => (
                      <button key={f} type="button"
                        onClick={() => setPkgForm(p => ({ ...p, features: p.features.includes(f) ? p.features.filter(x => x !== f) : [...p.features, f] }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          pkgForm.features.includes(f)
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>{pkgForm.features.includes(f) ? "✓ " : ""}{f}</button>
                    ))}
                  </div>
                </div>
                {/* Capacity + Visibility */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Subscribers</Label>
                    <Input type="number" placeholder="Unlimited" value={pkgForm.max_subscribers}
                      onChange={e => setPkgForm(p => ({ ...p, max_subscribers: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Visibility</Label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPkgForm(p => ({ ...p, is_public: true }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          pkgForm.is_public ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/30 border-border text-muted-foreground"
                        }`}>Public</button>
                      <button type="button" onClick={() => setPkgForm(p => ({ ...p, is_public: false }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          !pkgForm.is_public ? "bg-amber-500/15 border-amber-500/40 text-amber-600" : "bg-secondary/30 border-border text-muted-foreground"
                        }`}>Private</button>
                    </div>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the package..."
                    className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                    data-testid="pkg-description-input" />
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
          {packages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg, idx) => (
                <motion.div key={pkg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card rounded-xl p-5 flex flex-col gap-3" data-testid={`pkg-card-${pkg.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{pkg.name}</h4>
                        <p className="text-xs text-muted-foreground capitalize">{pkg.type || "monthly"} · {pkg.sessions_per_month} sessions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pkg.is_public !== false ? "bg-primary/10 border-primary/20 text-primary" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
                        {pkg.is_public !== false ? "Public" : "Private"}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => handleDeletePackage(pkg.id)} data-testid={`delete-pkg-${pkg.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-lg text-primary">₹{(pkg.price || 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">{PKG_TYPES.find(t => t.value === (pkg.type || "monthly"))?.priceLabel || "/month"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.duration_minutes || 60} min/session</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.subscriber_count || 0}{pkg.max_subscribers ? `/${pkg.max_subscribers}` : ""} subscribers</span>
                  </div>
                  {pkg.features?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.features.map(f => <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary font-medium">✓ {f}</span>)}
                    </div>
                  )}
                  {pkg.sports?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.sports.map(s => <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>)}
                    </div>
                  )}
                  {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass-card rounded-xl text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-bold mb-1">No Packages Yet</p>
              <p className="text-sm">Create a monthly package to offer subscription-based coaching.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Records Sub-tab */}
      {coachingSubTab === "records" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {recordsLoading && orgPlayers.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">Loading records data...</p>
            </div>
          ) : (
            <>
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-display font-bold text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Submit Performance Record
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Lobbian</Label>
                    <Select value={recordForm.player_id} onValueChange={v => setRecordForm(p => ({ ...p, player_id: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border" data-testid="record-player-select"><SelectValue placeholder="Select Lobbian..." /></SelectTrigger>
                      <SelectContent>
                        {orgPlayers.map(p => <SelectItem key={p.user_id || p.id} value={p.user_id || p.id}>{p.name || p.email} {p.org_name ? `(${p.org_name})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Record Type</Label>
                    <Select value={recordForm.record_type} onValueChange={v => setRecordForm(p => ({ ...p, record_type: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border" data-testid="record-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECORD_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sport</Label>
                    <Select value={recordForm.sport} onValueChange={v => setRecordForm(p => ({ ...p, sport: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {coachSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" value={recordForm.date} onChange={e => setRecordForm(p => ({ ...p, date: e.target.value }))} className="mt-1 bg-background border-border" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input value={recordForm.title} onChange={e => setRecordForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Fitness Assessment Q1, 100m Sprint Record" className="mt-1 bg-background border-border" data-testid="record-title-input" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Stats (Key-Value Pairs)</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={addStatRow}><Plus className="h-3 w-3 mr-0.5" /> Add Stat</Button>
                  </div>
                  <div className="space-y-2">
                    {recordForm.stats.map((stat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input value={stat.key} onChange={e => updateStatRow(idx, "key", e.target.value)} placeholder="Key (e.g. speed)" className="flex-1 h-8 text-xs bg-background border-border" />
                        <Input value={stat.value} onChange={e => updateStatRow(idx, "value", e.target.value)} placeholder="Value (e.g. 11.2s)" className="flex-1 h-8 text-xs bg-background border-border" />
                        {recordForm.stats.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeStatRow(idx)}><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <textarea value={recordForm.notes} onChange={e => setRecordForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="Additional notes or observations..." className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
                </div>
                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSubmitRecord} disabled={submittingRecord} data-testid="submit-record-btn">
                  {submittingRecord ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Award className="h-4 w-4 mr-1" />}
                  Submit Record
                </Button>
              </div>
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-display font-bold text-sm flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" /> Log Training Session
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Title</Label>
                    <Input value={trainingForm.title} onChange={e => setTrainingForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Morning Drill Session" className="mt-1 bg-background border-border" data-testid="training-title-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Sport</Label>
                    <Select value={trainingForm.sport} onValueChange={v => setTrainingForm(p => ({ ...p, sport: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{coachSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" value={trainingForm.date} onChange={e => setTrainingForm(p => ({ ...p, date: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  <div><Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
                    <Input type="number" value={trainingForm.duration_minutes} onChange={e => setTrainingForm(p => ({ ...p, duration_minutes: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Drills (comma-separated)</Label>
                  <Input value={trainingForm.drills} onChange={e => setTrainingForm(p => ({ ...p, drills: e.target.value }))}
                    placeholder="e.g. Warm-up, Shuttle runs, Smash practice, Cool-down" className="mt-1 bg-background border-border" data-testid="training-drills-input" /></div>
                {orgPlayers.length > 0 && (
                  <div><Label className="text-xs text-muted-foreground mb-2 block">Select Lobbians</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                      {orgPlayers.map(p => { const pId = p.user_id || p.id; const isSelected = trainingForm.player_ids.includes(pId); return (
                        <label key={pId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${isSelected ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"}`}>
                          <Checkbox checked={isSelected} onCheckedChange={() => togglePlayerForTraining(pId)} className="h-3 w-3" />
                          <span>{p.name || p.email}</span>
                        </label>); })}
                    </div></div>
                )}
                <div><Label className="text-xs text-muted-foreground">Notes</Label>
                  <textarea value={trainingForm.notes} onChange={e => setTrainingForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="Session observations, Lobbian feedback..." className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" /></div>
                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleLogTraining} disabled={submittingTraining} data-testid="submit-training-btn">
                  {submittingTraining ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Dumbbell className="h-4 w-4 mr-1" />}
                  Log Training
                </Button>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Recent Performance Records</h3>
                {recentRecords.length > 0 ? recentRecords.map((r, idx) => (
                  <motion.div key={r.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{r.title}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{r.record_type?.replace("_", " ")}</Badge>
                        {r.sport && <Badge className="bg-primary/15 text-primary text-[10px] capitalize">{r.sport}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{r.date}</span>
                    </div>
                    {r.player_name && <p className="text-xs text-muted-foreground mb-1">Lobbian: <span className="font-medium text-foreground">{r.player_name}</span></p>}
                    {r.stats && Object.keys(r.stats).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(r.stats).map(([k, v]) => <span key={k} className="text-[10px] bg-secondary/30 rounded-full px-2 py-0.5 font-mono">{k}: <span className="font-bold text-primary">{v}</span></span>)}
                      </div>
                    )}
                    {r.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{r.notes}</p>}
                  </motion.div>
                )) : (
                  <div className="text-center py-8 glass-card rounded-xl text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm">No performance records yet. Submit one above.</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Training Log History</h3>
                {trainingLogs.length > 0 ? trainingLogs.map((log, idx) => (
                  <motion.div key={log.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Dumbbell className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-sm">{log.title}</span>
                        {log.sport && <Badge variant="secondary" className="text-[10px] capitalize">{log.sport}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{log.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {log.duration_minutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{log.duration_minutes} min</span>}
                      {log.player_ids?.length > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{log.player_ids.length} Lobbians</span>}
                    </div>
                    {log.drills?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{log.drills.map((d, di) => <span key={di} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-bold">{d}</span>)}</div>}
                    {log.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{log.notes}</p>}
                  </motion.div>
                )) : (
                  <div className="text-center py-8 glass-card rounded-xl text-muted-foreground">
                    <Dumbbell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm">No training logs yet. Log a session above.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

        </>
      )}

      {/* ─── Academy View ─── */}
      {activeView === "academy" && (
        <>
          {academy ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Academy Header Card */}
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

              {/* Academy Sub-Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 border-b border-border/40">
                {[
                  { id: "overview", icon: TrendingUp, label: "Overview" },
                  { id: "students", icon: Users, label: "Students" },
                  { id: "batches", icon: ClipboardList, label: "Batches" },
                  { id: "attendance", icon: UserCheck, label: "Attendance" },
                  { id: "fees", icon: IndianRupee, label: "Fees" },
                  { id: "progress", icon: Activity, label: "Progress" },
                ].map(t => (
                  <button key={t.id} onClick={() => setAcademyTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      academyTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                    }`}>
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {/* ── Overview Sub-Tab ── */}
              {academyTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <AthleticStatCard icon={Users} label="Students" value={dashboardStats?.total_students || academy.current_students || 0} />
                    <AthleticStatCard icon={IndianRupee} label="Monthly Revenue" value={`₹${(dashboardStats?.monthly_revenue || 0).toLocaleString()}`} />
                    <AthleticStatCard icon={UserCheck} label="Attendance Rate" value={`${dashboardStats?.attendance_rate || 0}%`} />
                    <AthleticStatCard icon={ClipboardList} label="Batches" value={dashboardStats?.batch_count || 0} />
                    <AthleticStatCard icon={IndianRupee} label="Total Revenue" value={`₹${(dashboardStats?.total_revenue || 0).toLocaleString()}`} />
                    <AthleticStatCard icon={XCircle} label="Overdue Fees" value={dashboardStats?.overdue_fees || 0} />
                  </div>
                  {dashboardStats?.batch_fill_rates?.length > 0 && (
                    <div className="glass-card rounded-lg p-4">
                      <h4 className="font-bold text-sm mb-3">Batch Fill Rates</h4>
                      <div className="space-y-2">
                        {dashboardStats.batch_fill_rates.map((b, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs w-28 truncate">{b.name}</span>
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${b.percentage}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground">{b.current}/{b.max}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dashboardStats?.recent_enrollments?.length > 0 && (
                    <div className="glass-card rounded-lg p-4">
                      <h4 className="font-bold text-sm mb-3">Recent Enrollments</h4>
                      <div className="space-y-2">
                        {dashboardStats.recent_enrollments.map(e => (
                          <div key={e.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{e.student_name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={e.status === "active" ? "default" : "secondary"} className="text-[10px]">{e.status}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Students Sub-Tab ── */}
              {academyTab === "students" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold">Enrolled Students ({enrollments.filter(e => e.status === "active").length})</h3>
                    <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8">
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Student
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border max-w-sm">
                        <DialogHeader><DialogTitle className="font-display">Add Student Manually</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label className="text-xs text-muted-foreground">Name</Label>
                            <Input value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))}
                              className="mt-1 bg-background border-border" /></div>
                          <div><Label className="text-xs text-muted-foreground">Email</Label>
                            <Input type="email" value={studentForm.email} onChange={e => setStudentForm(p => ({ ...p, email: e.target.value }))}
                              className="mt-1 bg-background border-border" /></div>
                          <div><Label className="text-xs text-muted-foreground">Phone</Label>
                            <div className="flex mt-1">
                              <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs font-bold text-muted-foreground select-none">+91</span>
                              <Input value={studentForm.phone} onChange={e => setStudentForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))}
                                className="bg-background border-border rounded-l-none" placeholder="98765 43210" maxLength={10} />
                            </div></div>
                          <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAddStudent}>Add Student</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {enrollments.length > 0 ? (
                    <div className="glass-card rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-mono text-xs">Name</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs hidden md:table-cell">Email</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs">Status</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs hidden md:table-cell">Fee</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs">Attendance</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrollments.map(e => {
                            const fee = feeStatus.find(f => f.student_id === e.student_id);
                            const att = attendanceStats?.students?.find(s => s.student_id === e.student_id);
                            return (
                              <TableRow key={e.id} className="border-border">
                                <TableCell className="font-medium text-sm">{e.student_name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{e.student_email}</TableCell>
                                <TableCell>
                                  <Badge variant={e.status === "active" ? "default" : e.status === "payment_pending" ? "outline" : "secondary"} className="text-[10px]">
                                    {e.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant={fee?.status === "paid" ? "default" : fee?.status === "overdue" ? "destructive" : "outline"} className="text-[10px]">
                                    {fee?.status || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-mono">{att?.percentage || 0}%</TableCell>
                                <TableCell>
                                  {e.status === "active" && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                      onClick={() => handleCancelEnrollment(e.id)}>
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No enrollments yet. Students can enroll from the Academy Discovery page.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Batches Sub-Tab ── */}
              {academyTab === "batches" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold">Batches ({batches.length})</h3>
                    <div className="flex gap-2">
                      <Dialog open={assignBatchOpen} onOpenChange={setAssignBatchOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="font-bold text-xs h-8">
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign Student
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border max-w-sm">
                          <DialogHeader><DialogTitle className="font-display">Assign Student to Batch</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label className="text-xs text-muted-foreground">Batch</Label>
                              <Select value={assignBatchId} onValueChange={setAssignBatchId}>
                                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select batch" /></SelectTrigger>
                                <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                              </Select></div>
                            <div><Label className="text-xs text-muted-foreground">Student</Label>
                              <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select student" /></SelectTrigger>
                                <SelectContent>{enrollments.filter(e => e.status === "active").map(e => <SelectItem key={e.student_id} value={e.student_id}>{e.student_name}</SelectItem>)}</SelectContent>
                              </Select></div>
                            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAssignBatch}>Assign</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Create Batch
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border max-w-sm">
                          <DialogHeader><DialogTitle className="font-display">Create Batch</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label className="text-xs text-muted-foreground">Batch Name</Label>
                              <Input value={batchForm.name} onChange={e => setBatchForm(p => ({ ...p, name: e.target.value }))}
                                className="mt-1 bg-background border-border" placeholder="Morning Batch" /></div>
                            <div className="grid grid-cols-2 gap-3">
                              <div><Label className="text-xs text-muted-foreground">Start Time</Label>
                                <Input type="time" value={batchForm.start_time} onChange={e => setBatchForm(p => ({ ...p, start_time: e.target.value }))}
                                  className="mt-1 bg-background border-border" /></div>
                              <div><Label className="text-xs text-muted-foreground">End Time</Label>
                                <Input type="time" value={batchForm.end_time} onChange={e => setBatchForm(p => ({ ...p, end_time: e.target.value }))}
                                  className="mt-1 bg-background border-border" /></div>
                            </div>
                            <div><Label className="text-xs text-muted-foreground">Max Students</Label>
                              <Input type="number" value={batchForm.max_students} onChange={e => setBatchForm(p => ({ ...p, max_students: parseInt(e.target.value) || 30 }))}
                                className="mt-1 bg-background border-border" /></div>
                            <div><Label className="text-xs text-muted-foreground">Days</Label>
                              <div className="flex gap-1 mt-1">
                                {DAY_LABELS.map((d, i) => (
                                  <button key={i} onClick={() => setBatchForm(p => ({
                                    ...p, days: p.days.includes(i) ? p.days.filter(x => x !== i) : [...p.days, i]
                                  }))}
                                    className={`w-9 h-9 rounded-lg text-xs font-bold ${
                                      batchForm.days.includes(i) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                                    }`}>{d.slice(0, 2)}</button>
                                ))}
                              </div></div>
                            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreateBatch}>Create Batch</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {batches.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {batches.map(b => (
                        <div key={b.id} className="glass-card rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-sm">{b.name}</h4>
                              <p className="text-xs text-muted-foreground">{b.start_time} - {b.end_time}</p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBatch(b.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">Days:</span>
                            {(b.days || []).map(d => (
                              <span key={d} className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-bold">{DAY_LABELS[d]}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(b.current_students / Math.max(b.max_students, 1)) * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono">{b.current_students}/{b.max_students}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No batches yet. Create one to organize your students.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Attendance Sub-Tab ── */}
              {academyTab === "attendance" && (
                <div className="space-y-4">
                  <div className="glass-card rounded-lg p-4">
                    <h3 className="font-bold text-sm mb-3">Mark Attendance</h3>
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div><Label className="text-xs text-muted-foreground">Date</Label>
                        <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)}
                          className="mt-1 bg-background border-border w-40" /></div>
                      {batches.length > 0 && (
                        <div><Label className="text-xs text-muted-foreground">Batch (optional)</Label>
                          <Select value={selectedBatchForAttendance} onValueChange={setSelectedBatchForAttendance}>
                            <SelectTrigger className="mt-1 bg-background border-border w-40"><SelectValue placeholder="All students" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All students</SelectItem>
                              {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select></div>
                      )}
                    </div>
                    <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                      {enrollments.filter(e => e.status === "active").map(e => (
                        <label key={e.student_id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                          <Checkbox checked={presentStudents.has(e.student_id)}
                            onCheckedChange={(checked) => {
                              setPresentStudents(prev => {
                                const next = new Set(prev);
                                checked ? next.add(e.student_id) : next.delete(e.student_id);
                                return next;
                              });
                            }} />
                          <span className="text-sm font-medium">{e.student_name}</span>
                          {presentStudents.has(e.student_id) ?
                            <CheckCircle className="h-4 w-4 text-primary ml-auto" /> :
                            <XCircle className="h-4 w-4 text-muted-foreground/30 ml-auto" />}
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{presentStudents.size} of {enrollments.filter(e => e.status === "active").length} present</span>
                      <Button size="sm" className="bg-primary text-primary-foreground font-bold" onClick={handleMarkAttendance}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Save Attendance
                      </Button>
                    </div>
                  </div>
                  {/* Attendance Stats */}
                  {attendanceStats?.students?.length > 0 && (
                    <div className="glass-card rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm">Attendance Stats (Last 90 Days)</h4>
                        <Badge variant="outline" className="text-[10px]">Avg: {attendanceStats.academy_average}%</Badge>
                      </div>
                      <div className="space-y-2">
                        {attendanceStats.students.map(s => (
                          <div key={s.student_id} className="flex items-center gap-3">
                            <span className="text-xs w-28 truncate">{s.student_name}</span>
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${s.percentage >= 75 ? "bg-primary" : s.percentage >= 50 ? "bg-amber-500" : "bg-destructive"}`}
                                style={{ width: `${s.percentage}%` }} />
                            </div>
                            <span className="text-xs font-mono w-10 text-right">{s.percentage}%</span>
                            <span className="text-[10px] text-muted-foreground">🔥{s.current_streak}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Fees Sub-Tab ── */}
              {academyTab === "fees" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold">Fee Status</h3>
                    <Dialog open={collectFeeOpen} onOpenChange={setCollectFeeOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8">
                          <IndianRupee className="h-3.5 w-3.5 mr-1" /> Collect Fee
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border max-w-sm">
                        <DialogHeader><DialogTitle className="font-display">Collect Fee</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label className="text-xs text-muted-foreground">Student</Label>
                            <Select value={feeForm.student_id} onValueChange={v => setFeeForm(p => ({ ...p, student_id: v }))}>
                              <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select student" /></SelectTrigger>
                              <SelectContent>{enrollments.filter(e => e.status === "active").map(e => <SelectItem key={e.student_id} value={e.student_id}>{e.student_name}</SelectItem>)}</SelectContent>
                            </Select></div>
                          <div><Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                            <Input type="number" value={feeForm.amount} onChange={e => setFeeForm(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
                              className="mt-1 bg-background border-border" /></div>
                          <div><Label className="text-xs text-muted-foreground">Payment Method</Label>
                            <Select value={feeForm.payment_method} onValueChange={v => setFeeForm(p => ({ ...p, payment_method: v }))}>
                              <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                              </SelectContent>
                            </Select></div>
                          <div><Label className="text-xs text-muted-foreground">Period (Month)</Label>
                            <Input type="month" value={feeForm.period_month} onChange={e => setFeeForm(p => ({ ...p, period_month: e.target.value }))}
                              className="mt-1 bg-background border-border" /></div>
                          <div><Label className="text-xs text-muted-foreground">Notes</Label>
                            <Input value={feeForm.notes} onChange={e => setFeeForm(p => ({ ...p, notes: e.target.value }))}
                              className="mt-1 bg-background border-border" placeholder="Optional notes" /></div>
                          <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCollectFee}>Collect Fee</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card rounded-lg p-3 text-center">
                      <p className="text-lg font-black text-primary">{feeStatus.filter(f => f.status === "paid").length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
                    </div>
                    <div className="glass-card rounded-lg p-3 text-center">
                      <p className="text-lg font-black text-amber-500">{feeStatus.filter(f => f.status === "pending").length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                    </div>
                    <div className="glass-card rounded-lg p-3 text-center">
                      <p className="text-lg font-black text-destructive">{feeStatus.filter(f => f.status === "overdue").length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
                    </div>
                  </div>
                  {feeStatus.length > 0 ? (
                    <div className="glass-card rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-mono text-xs">Student</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs">Amount</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs">Status</TableHead>
                            <TableHead className="text-muted-foreground font-mono text-xs hidden md:table-cell">Paid At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {feeStatus.map(f => (
                            <TableRow key={f.student_id} className="border-border">
                              <TableCell className="font-medium text-sm">{f.student_name}</TableCell>
                              <TableCell className="text-sm font-mono">₹{f.monthly_fee}</TableCell>
                              <TableCell>
                                <Badge variant={f.status === "paid" ? "default" : f.status === "overdue" ? "destructive" : "outline"}
                                  className={`text-[10px] ${f.status === "overdue" ? "animate-pulse" : ""}`}>
                                  {f.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                                {f.paid_at ? new Date(f.paid_at).toLocaleDateString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                      <IndianRupee className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No fee data yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Progress Sub-Tab ── */}
              {academyTab === "progress" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold">Student Progress</h3>
                    <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Assessment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border max-w-md">
                        <DialogHeader><DialogTitle className="font-display">Add Progress Assessment</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label className="text-xs text-muted-foreground">Student</Label>
                            <Select value={progressStudent} onValueChange={setProgressStudent}>
                              <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select student" /></SelectTrigger>
                              <SelectContent>{enrollments.filter(e => e.status === "active").map(e => <SelectItem key={e.student_id} value={e.student_id}>{e.student_name}</SelectItem>)}</SelectContent>
                            </Select></div>
                          <div><Label className="text-xs text-muted-foreground">Assessment Type</Label>
                            <Select value={progressForm.assessment_type} onValueChange={v => setProgressForm(p => ({ ...p, assessment_type: v }))}>
                              <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="adhoc">Ad-hoc</SelectItem>
                              </SelectContent>
                            </Select></div>
                          <div><Label className="text-xs text-muted-foreground">Skill Ratings (1-10)</Label>
                            <div className="space-y-2 mt-1">
                              {["technique", "fitness", "game_sense", "discipline", "improvement"].map(skill => (
                                <div key={skill} className="flex items-center gap-3">
                                  <span className="text-xs w-24 capitalize">{skill.replace("_", " ")}</span>
                                  <input type="range" min="1" max="10" value={progressForm.skill_ratings[skill] || 5}
                                    onChange={e => setProgressForm(p => ({
                                      ...p, skill_ratings: { ...p.skill_ratings, [skill]: parseInt(e.target.value) }
                                    }))} className="flex-1 accent-primary" />
                                  <span className="text-xs font-mono w-6 text-right">{progressForm.skill_ratings[skill] || 5}</span>
                                </div>
                              ))}
                            </div></div>
                          <div><Label className="text-xs text-muted-foreground">Notes</Label>
                            <Input value={progressForm.notes} onChange={e => setProgressForm(p => ({ ...p, notes: e.target.value }))}
                              className="mt-1 bg-background border-border" placeholder="Coach notes..." /></div>
                          <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAddProgress}>Save Assessment</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {/* Student selector for viewing progress */}
                  <div className="glass-card rounded-lg p-4">
                    <Label className="text-xs text-muted-foreground">View Progress For</Label>
                    <Select onValueChange={(v) => { setProgressStudent(v); handleLoadProgress(v); }}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select a student" /></SelectTrigger>
                      <SelectContent>{enrollments.filter(e => e.status === "active").map(e => <SelectItem key={e.student_id} value={e.student_id}>{e.student_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {progressHistory.length > 0 && (
                    <div className="space-y-3">
                      {progressHistory.map(p => (
                        <div key={p.id} className="glass-card rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[10px]">{p.assessment_type}</Badge>
                            <span className="text-xs text-muted-foreground">{p.date}</span>
                          </div>
                          <div className="space-y-1.5">
                            {Object.entries(p.skill_ratings || {}).map(([skill, val]) => (
                              <div key={skill} className="flex items-center gap-2">
                                <span className="text-xs w-24 capitalize text-muted-foreground">{skill.replace("_", " ")}</span>
                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${val * 10}%` }} />
                                </div>
                                <span className="text-xs font-mono">{val}/10</span>
                              </div>
                            ))}
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground mt-2 italic">{p.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-center py-16">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
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
                            <span className="text-xs font-bold">{fmt12h(slot.start_time)} - {fmt12h(slot.end_time)}</span>
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
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
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
                rows={3} placeholder="Tell Lobbians about your coaching experience..."
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
              <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-bold mb-1">No Organizations Yet</p>
              <p className="text-sm">Create an organization to manage Lobbians and staff.</p>
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
                              <Users className="h-3 w-3" />{org.player_count ?? org.players_count ?? 0} Lobbians
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
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Lobbians</div>
                            </div>
                            <div className="bg-secondary/20 rounded-lg p-3 text-center">
                              <div className="text-lg font-black text-primary">{orgDetail?.staff?.length ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase">Staff</div>
                            </div>
                          </div>
                        )}

                        {/* Lobbians Section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Lobbians</h4>
                            <div className="flex items-center gap-2">
                              <Input value={addPlayerEmail}
                                onChange={e => setAddPlayerEmail(e.target.value)}
                                placeholder="Lobbian email..."
                                className="h-7 text-xs bg-background border-border w-48"
                                onKeyDown={e => e.key === "Enter" && handleAddOrgPlayer(org.id)}
                                data-testid="org-add-player-email" />
                              <Button size="sm" className="h-7 text-[10px] bg-primary text-primary-foreground font-bold"
                                onClick={() => handleAddOrgPlayer(org.id)} disabled={orgActionLoading}
                                data-testid="org-add-player-btn">
                                <UserPlus className="h-3 w-3 mr-1" /> Add Lobbian
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
                            <p className="text-xs text-muted-foreground text-center py-4">No Lobbians yet. Add one above.</p>
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
      {/* ═══════════════════════════════════════════════════════════════════════
           INDIVIDUAL COACH VIEWS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* ─── HOME Tab ─── */}
      {activeView === "home" && isIndividualCoach && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Onboarding Progress */}
          {onboardingData && onboardingData.status !== "complete" && (
            <div className="glass-card rounded-xl p-5 border-2 border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-sm">Complete Your Setup</h3>
                <Badge className="bg-amber-500/15 text-amber-500 text-[10px] ml-auto">
                  {Object.values(onboardingData.steps || {}).filter(Boolean).length}/4 Done
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "profile_completed", label: "Complete Profile", action: () => navigate("/profile") },
                  { key: "availability_set", label: "Set Availability", action: () => navigate("/coach/settings") },
                  { key: "first_package_created", label: "Create First Package", action: () => { setActiveView("coach_mgmt"); setMgmtTab("packages"); } },
                  { key: "documents_uploaded", label: "Upload Documents", action: () => navigate("/profile") },
                ].map(step => (
                  <button key={step.key} onClick={step.action}
                    className={`flex items-center gap-2 p-3 rounded-lg text-xs font-bold transition-all ${
                      onboardingData.steps?.[step.key]
                        ? "bg-primary/10 text-primary line-through opacity-60"
                        : "bg-secondary/30 text-foreground hover:bg-secondary/50"
                    }`}>
                    {onboardingData.steps?.[step.key]
                      ? <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                      : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground shrink-0" />}
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AthleticStatCard icon={Users} label="Total Clients" value={sessionStats?.total_clients || clients.length} iconColor="sky" delay={0.1} />
            <AthleticStatCard icon={IndianRupee} label="Revenue" value={`₹${(revenueData?.total_revenue || sessionStats?.total_revenue || 0).toLocaleString()}`} iconColor="amber" delay={0.2} />
            <AthleticStatCard icon={Star} label="Rating" value={sessionStats?.avg_rating || "—"} iconColor="violet" delay={0.3} />
            <AthleticStatCard icon={Calendar} label="Upcoming" value={sessionStats?.upcoming || 0} iconColor="sky" delay={0.4} />
          </div>

          {/* Today's Schedule */}
          <div>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mb-3">Today's Schedule</h3>
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayOnline = sessions.filter(s => s.date === today && s.status === "confirmed");
              const todayOffline = offlineSessions.filter(s => s.date === today);
              const allToday = [...todayOnline.map(s => ({ ...s, _source: "online" })), ...todayOffline.map(s => ({ ...s, _source: "offline" }))];
              if (allToday.length === 0) return (
                <div className="text-center py-8 text-muted-foreground glass-card rounded-xl">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sessions scheduled for today</p>
                </div>
              );
              return (
                <div className="space-y-2">
                  {allToday.map(s => (
                    <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm">{s.player_name || s.client_name}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                          <Badge className={`text-[10px] ${s._source === "online" ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}>
                            {s._source === "online" ? "Online" : "Offline"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} - {s.end_time}</span>
                          <span className="font-bold text-primary">₹{s.price || s.amount}</span>
                        </div>
                      </div>
                      {s._source === "online" && s.status === "confirmed" && (
                        <Button size="sm" className="bg-brand-600 text-white font-bold text-[10px] h-7"
                          onClick={() => handleCompleteSession(s.id)}>
                          <CheckCircle className="h-3 w-3 mr-1" />Done
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Pending Actions */}
          {(() => {
            const pendingPayments = offlineSessions.filter(s => s.payment_status === "pending");
            const unconfirmed = sessions.filter(s => s.status === "pending");
            if (pendingPayments.length === 0 && unconfirmed.length === 0) return null;
            return (
              <div>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mb-3">Pending Actions</h3>
                <div className="space-y-2">
                  {pendingPayments.length > 0 && (
                    <div className="glass-card rounded-xl p-4 flex items-center gap-3 border-l-4 border-amber-500">
                      <IndianRupee className="h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{pendingPayments.length} Unpaid Sessions</p>
                        <p className="text-xs text-muted-foreground">₹{pendingPayments.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString()} pending</p>
                      </div>
                      <Button size="sm" variant="outline" className="ml-auto text-xs h-7" onClick={() => { setActiveView("coach_mgmt"); setMgmtTab("finance"); }}>View</Button>
                    </div>
                  )}
                  {unconfirmed.length > 0 && (
                    <div className="glass-card rounded-xl p-4 flex items-center gap-3 border-l-4 border-sky-500">
                      <Calendar className="h-5 w-5 text-sky-500 shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{unconfirmed.length} Pending Bookings</p>
                        <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
                      </div>
                      <Button size="sm" variant="outline" className="ml-auto text-xs h-7" onClick={() => { setActiveView("coach_mgmt"); setMgmtTab("schedule"); }}>View</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ─── COACH MANAGEMENT ─── */}
      {activeView === "coach_mgmt" && isIndividualCoach && (
        <>
          <div className="flex gap-1 mb-6 bg-secondary/20 p-1 rounded-lg w-fit flex-wrap">
            {MGMT_SUB_TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setMgmtTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mgmtTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

      {/* ─── SCHEDULE Tab ─── */}
      {mgmtTab === "schedule" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-secondary/20 p-1 rounded-lg">
              {[{ id: "upcoming", label: "Sessions" }, { id: "offline", label: "Offline Log" }].map(t => (
                <button key={t.id} onClick={() => setIndScheduleTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${indScheduleTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {indScheduleTab === "offline" && (
              <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
                onClick={() => setLogSessionOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Log Session
              </Button>
            )}
          </div>

          {/* Sessions sub-view */}
          {indScheduleTab === "upcoming" && (() => {
            const today = new Date().toISOString().slice(0, 10);
            const allSessions = sessions.filter(s => {
              const q = sessionSearch.toLowerCase();
              if (q && !(s.player_name || "").toLowerCase().includes(q) && !(s.sport || "").toLowerCase().includes(q)) return false;
              if (sessionStatusFilter === "today") return s.date === today;
              if (sessionStatusFilter === "upcoming") return (s.status === "confirmed" || s.status === "payment_pending") && s.date >= today;
              if (sessionStatusFilter === "completed") return s.status === "completed";
              if (sessionStatusFilter === "cancelled") return s.status === "cancelled";
              return true; // "all"
            });
            const todaySessions = allSessions.filter(s => s.date === today);
            const upcomingFiltered = allSessions.filter(s => (s.status === "confirmed" || s.status === "payment_pending") && s.date > today);
            const completedFiltered = allSessions.filter(s => s.status === "completed");
            const cancelledFiltered = allSessions.filter(s => s.status === "cancelled");
            return (
              <div className="space-y-4">
                {/* Filter bar */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <input value={sessionSearch} onChange={e => setSessionSearch(e.target.value)}
                      placeholder="Search player or sport…"
                      className="w-full h-8 bg-secondary/20 border border-border/50 rounded-lg pl-3 pr-3 text-xs focus:outline-none focus:border-primary/40" />
                  </div>
                  <div className="flex gap-1 bg-secondary/20 p-1 rounded-lg flex-wrap">
                    {[["all","All"], ["today","Today"], ["upcoming","Upcoming"], ["completed","Done"], ["cancelled","Cancelled"]].map(([id, label]) => (
                      <button key={id} onClick={() => setSessionStatusFilter(id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${sessionStatusFilter === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {label}
                        {id !== "all" && sessions.filter(s =>
                          id === "today" ? s.date === today :
                          id === "upcoming" ? (s.status === "confirmed" || s.status === "payment_pending") && s.date > today :
                          id === "completed" ? s.status === "completed" :
                          s.status === "cancelled"
                        ).length > 0 && (
                          <span className="ml-1 opacity-60">
                            {sessions.filter(s =>
                              id === "today" ? s.date === today :
                              id === "upcoming" ? (s.status === "confirmed" || s.status === "payment_pending") && s.date > today :
                              id === "completed" ? s.status === "completed" :
                              s.status === "cancelled"
                            ).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Today's sessions — highlighted */}
                {(sessionStatusFilter === "all" || sessionStatusFilter === "today") && todaySessions.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-primary/20" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-2">Today</span>
                      <div className="h-px flex-1 bg-primary/20" />
                    </div>
                    {todaySessions.map(s => (
                      <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 border-primary/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm">{s.player_name}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                            {s.status === "payment_pending"
                              ? <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Awaiting Payment</Badge>
                              : s.status === "completed"
                              ? <Badge className="bg-green-500/15 text-green-400 text-[10px]">Completed</Badge>
                              : <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>}
                            {s.source === "offline" && <Badge className="bg-amber-500/10 text-amber-500 text-[9px]">Offline</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} – {s.end_time}</span>
                            <span className="font-bold text-primary">₹{s.price}</span>
                            {s.location && <span>{s.location}</span>}
                          </div>
                          {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{s.notes}"</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {s.status === "confirmed" && (
                            <Button size="sm" className="bg-brand-600 text-white font-bold text-[10px] h-7"
                              onClick={() => handleCompleteSession(s.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Done
                            </Button>
                          )}
                          {s.status === "confirmed" && (
                            <Button size="sm" variant="outline" className="text-[10px] h-7 text-destructive border-destructive/30"
                              onClick={() => handleCancelSession(s.id)}>Cancel</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Upcoming sessions */}
                {(sessionStatusFilter === "all" || sessionStatusFilter === "upcoming") && upcomingFiltered.length > 0 && (
                  <>
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Upcoming</h3>
                    {upcomingFiltered.map(s => (
                      <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm">{s.player_name}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                            {s.status === "payment_pending"
                              ? <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">Awaiting Payment</Badge>
                              : <Badge className="bg-sky-500/15 text-sky-400 text-[10px]">Confirmed</Badge>}
                            {s.source === "offline" && <Badge className="bg-amber-500/10 text-amber-500 text-[9px]">Offline</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} – {s.end_time}</span>
                            <span className="font-bold text-primary">₹{s.price}</span>
                            {s.location && <span>{s.location}</span>}
                          </div>
                          {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{s.notes}"</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {s.status === "confirmed" && (
                            <Button size="sm" className="bg-brand-600 text-white font-bold text-[10px] h-7"
                              onClick={() => handleCompleteSession(s.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Done
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-[10px] h-7 text-destructive border-destructive/30"
                            onClick={() => handleCancelSession(s.id)}>Cancel</Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Completed sessions */}
                {(sessionStatusFilter === "all" || sessionStatusFilter === "completed") && completedFiltered.length > 0 && (
                  <>
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mt-2">Completed</h3>
                    {completedFiltered.slice(0, 15).map(s => (
                      <div key={s.id} className="glass-card rounded-xl p-4 flex items-center gap-3 opacity-80">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm">{s.player_name}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                            {s.rating && <Badge className="bg-amber-500/15 text-amber-400 text-[10px]"><Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" />{s.rating}/5</Badge>}
                            {s.source === "offline" && <Badge className="bg-amber-500/10 text-amber-500 text-[9px]">Offline</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{s.date} · {s.start_time} · ₹{s.price}
                            {s.review && <span className="ml-2 italic">"{s.review}"</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Cancelled sessions */}
                {sessionStatusFilter === "cancelled" && cancelledFiltered.length > 0 && (
                  <>
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mt-2">Cancelled</h3>
                    {cancelledFiltered.map(s => (
                      <div key={s.id} className="glass-card rounded-xl p-4 flex items-center gap-3 opacity-60">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm">{s.player_name}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                            <Badge className="bg-destructive/10 text-destructive text-[10px]">Cancelled</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{s.date} · {s.start_time}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {allSessions.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3" />
                    <p className="text-sm">{sessionSearch || sessionStatusFilter !== "all" ? "No sessions match your filter." : "No sessions yet. Set availability to start!"}</p>
                    {!sessionSearch && sessionStatusFilter === "all" && (
                      <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/coach/settings")}>Set Availability</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Offline Log sub-view */}
          {indScheduleTab === "offline" && (() => {
            const filtered = offlineSessions.filter(s => {
              if (offlineLogClientFilter && !(s.client_name || "").toLowerCase().includes(offlineLogClientFilter.toLowerCase())) return false;
              if (offlineLogPaymentFilter !== "all" && s.payment_status !== offlineLogPaymentFilter) return false;
              if (offlineLogDateFrom && s.date < offlineLogDateFrom) return false;
              if (offlineLogDateTo && s.date > offlineLogDateTo) return false;
              return true;
            });
            const totalRevenue = filtered.reduce((sum, s) => sum + (s.amount || 0), 0);
            const pendingRevenue = filtered.filter(s => s.payment_status !== "paid").reduce((sum, s) => sum + (s.amount || 0), 0);
            return (
              <div className="space-y-4">
                {/* Summary stats */}
                {offlineSessions.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Sessions", value: filtered.length },
                      { label: "Collected", value: `₹${(totalRevenue - pendingRevenue).toLocaleString()}` },
                      { label: "Pending", value: `₹${pendingRevenue.toLocaleString()}`, warn: pendingRevenue > 0 },
                    ].map(stat => (
                      <div key={stat.label} className="glass-card rounded-lg p-3 text-center">
                        <p className={`text-sm font-bold ${stat.warn ? "text-amber-400" : "text-foreground"}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Filter bar */}
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={offlineLogClientFilter} onChange={e => setOfflineLogClientFilter(e.target.value)}
                    placeholder="Search client…"
                    className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-3 text-xs focus:outline-none focus:border-primary/40 flex-1 min-w-[140px] max-w-xs" />
                  <select value={offlineLogPaymentFilter} onChange={e => setOfflineLogPaymentFilter(e.target.value)}
                    className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-2 text-xs focus:outline-none cursor-pointer text-foreground">
                    <option value="all">All payments</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="waived">Waived</option>
                  </select>
                  <input type="date" value={offlineLogDateFrom} onChange={e => setOfflineLogDateFrom(e.target.value)}
                    className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-2 text-xs focus:outline-none cursor-pointer" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input type="date" value={offlineLogDateTo} onChange={e => setOfflineLogDateTo(e.target.value)}
                    className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-2 text-xs focus:outline-none cursor-pointer" />
                  {(offlineLogClientFilter || offlineLogPaymentFilter !== "all" || offlineLogDateFrom || offlineLogDateTo) && (
                    <button onClick={() => { setOfflineLogClientFilter(""); setOfflineLogPaymentFilter("all"); setOfflineLogDateFrom(""); setOfflineLogDateTo(""); }}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">✕ Clear</button>
                  )}
                </div>
                {/* Session list */}
                {filtered.length > 0 ? filtered.map(s => (
                  <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm">{s.client_name || "Walk-in"}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                        <Badge className={`text-[10px] ${s.payment_status === "paid" ? "bg-primary/15 text-primary" : s.payment_status === "waived" ? "bg-secondary text-muted-foreground" : "bg-amber-500/15 text-amber-500"}`}>
                          {s.payment_status}
                        </Badge>
                        {s.payment_mode && <Badge variant="outline" className="text-[9px] capitalize">{s.payment_mode}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time} – {s.end_time}</span>
                        <span className="font-bold text-primary">₹{s.amount}</span>
                      </div>
                      {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{s.notes}"</p>}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{offlineLogClientFilter || offlineLogPaymentFilter !== "all" || offlineLogDateFrom || offlineLogDateTo ? "No sessions match your filter." : "No offline sessions logged yet"}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Availability sub-view */}
          {indScheduleTab === "availability" && (
            <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-semibold">Availability has moved to Settings</p>
              <p className="text-xs mt-1 opacity-70">Manage your weekly time slots in Coach Settings</p>
              <Button size="sm" className="mt-4 bg-primary text-primary-foreground font-bold text-xs"
                onClick={() => navigate("/coach/settings")}>
                <Settings className="h-3.5 w-3.5 mr-1.5" /> Open Settings
              </Button>
            </div>
          )}

          {/* Log Offline Session Dialog */}
          <Dialog open={logSessionOpen} onOpenChange={setLogSessionOpen}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="font-display">Log Offline Session</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <Select value={offlineSessionForm.client_id} onValueChange={v => setOfflineSessionForm(p => ({ ...p, client_id: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.filter(c => c.client_source !== "online").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" value={offlineSessionForm.date} onChange={e => setOfflineSessionForm(p => ({ ...p, date: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  <div><Label className="text-xs text-muted-foreground">Start</Label>
                    <Input type="time" value={offlineSessionForm.start_time} onChange={e => setOfflineSessionForm(p => ({ ...p, start_time: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  <div><Label className="text-xs text-muted-foreground">End</Label>
                    <Input type="time" value={offlineSessionForm.end_time} onChange={e => setOfflineSessionForm(p => ({ ...p, end_time: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Sport</Label>
                    <Select value={offlineSessionForm.sport} onValueChange={v => setOfflineSessionForm(p => ({ ...p, sport: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{coachSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                    <Input type="number" value={offlineSessionForm.amount} onChange={e => setOfflineSessionForm(p => ({ ...p, amount: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Payment Status</Label>
                    <Select value={offlineSessionForm.payment_status} onValueChange={v => setOfflineSessionForm(p => ({ ...p, payment_status: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Payment Mode</Label>
                    <Select value={offlineSessionForm.payment_mode} onValueChange={v => setOfflineSessionForm(p => ({ ...p, payment_mode: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Notes</Label>
                  <Input value={offlineSessionForm.notes} onChange={e => setOfflineSessionForm(p => ({ ...p, notes: e.target.value }))} placeholder="Session notes..." className="mt-1 bg-background border-border" /></div>
                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleLogOfflineSession}>Log Session</Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      {/* ─── CLIENTS Tab ─── */}
      {mgmtTab === "clients" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Row 1: Source filter tabs + Add button */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 bg-secondary/20 p-1 rounded-lg">
              {[
                { id: "all",       label: "All",       count: clients.length },
                { id: "offline",   label: "Offline",   count: clients.filter(c => c.client_source === "offline").length },
                { id: "online",    label: "Online",    count: clients.filter(c => c.client_source === "online").length },
                { id: "reminders", label: "Reminders", count: null },
              ].map(f => (
                <button key={f.id} onClick={() => { setClientFilter(f.id); if (f.id === "reminders") loadReminders(); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${clientFilter === f.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {f.label}
                  {f.count !== null && f.count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${clientFilter === f.id ? "bg-primary/15 text-primary" : "bg-secondary/60 text-muted-foreground"}`}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {clientFilter !== "online" && clientFilter !== "reminders" && (
              <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
                onClick={() => setAddClientOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Client
              </Button>
            )}
          </div>

          {/* Row 2: Search + Sport filter + Sort (only for non-reminders view) */}
          {clientFilter !== "reminders" && (
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  placeholder="Search name or phone…"
                  className="w-full h-8 bg-secondary/20 border border-border/50 rounded-lg pl-7 pr-3 text-xs focus:outline-none focus:border-primary/40" />
              </div>
              <select value={clientSportFilter} onChange={e => setClientSportFilter(e.target.value)}
                className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-2 text-xs focus:outline-none cursor-pointer text-foreground">
                <option value="all">All sports</option>
                {coachSports.map(s => <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>)}
              </select>
              <select value={clientSortBy} onChange={e => setClientSortBy(e.target.value)}
                className="h-8 bg-secondary/20 border border-border/50 rounded-lg px-2 text-xs focus:outline-none cursor-pointer text-foreground">
                <option value="name">Sort: Name</option>
                <option value="joined">Sort: Newest</option>
                <option value="fee">Sort: Fee ↓</option>
              </select>
              {(clientSearch || clientSportFilter !== "all") && (
                <button onClick={() => { setClientSearch(""); setClientSportFilter("all"); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">✕ Clear</button>
              )}
            </div>
          )}

          {clientFilter === "reminders" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Monthly payment reminders — {new Date().toISOString().slice(0, 7)}
                </p>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleRunDailyReminders}>
                  Send All Due Today
                </Button>
              </div>
              {remindersLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No reminders sent this month yet.</p>
                  <p className="text-xs mt-1 opacity-60">Add a monthly fee to a client and click "💰 Remind"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reminders.map(r => (
                    <div key={r.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                        {(r.client_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ₹{r.amount?.toLocaleString()} · {r.reminder_count} reminder{r.reminder_count !== 1 ? "s" : ""}
                          {r.last_reminder_at && <span className="ml-1 opacity-60">· {new Date(r.last_reminder_at).toLocaleDateString()}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                          {r.status === "paid" ? "Paid" : "Pending"}
                        </span>
                        {r.status !== "paid" && (
                          <Button size="sm" variant="outline" className="text-[10px] h-6 border-amber-500/30 text-amber-400"
                            onClick={() => handleSendReminder(r.client_id, { stopPropagation: () => {} })}>
                            Resend
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (() => {
            let filtered = clientFilter === "offline" ? clients.filter(c => c.client_source === "offline")
              : clientFilter === "online" ? clients.filter(c => c.client_source === "online")
              : clients;
            if (clientSearch) {
              const q = clientSearch.toLowerCase();
              filtered = filtered.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.phone || "").includes(q) ||
                (c.email || "").toLowerCase().includes(q)
              );
            }
            if (clientSportFilter !== "all") filtered = filtered.filter(c => c.sport === clientSportFilter);
            if (clientSortBy === "name") filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            else if (clientSortBy === "joined") filtered = [...filtered].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
            else if (clientSortBy === "fee") filtered = [...filtered].sort((a, b) => (b.monthly_fee || 0) - (a.monthly_fee || 0));
            if (filtered.length === 0) return (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{clientSearch || clientSportFilter !== "all" ? "No clients match your filter." : "No clients yet. Add your first client!"}</p>
              </div>
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(c => (
                  <div key={c.id} className="glass-card rounded-xl p-4 flex flex-col gap-2 cursor-pointer hover:border-primary/40 transition-colors duration-200"
                    onClick={() => c.client_source === "online" ? (sessionStorage.setItem("coachDashReturnTab", "clients"), navigate(`/player-card/${c.id}`)) : openClientProfile(c.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {c.avatar ? (
                          <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${c.client_source === "online" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-400"}`}>
                            {(c.name || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-sm">{c.name}</h4>
                          {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                        </div>
                      </div>
                      <Badge className={`text-[9px] ${c.client_source === "online" ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {c.client_source || "offline"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.sport && <Badge variant="secondary" className="text-[10px] capitalize">{c.sport}</Badge>}
                      {c.source && c.source !== "online" && <Badge variant="outline" className="text-[10px] capitalize">{c.source.replace("_", " ")}</Badge>}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap" onClick={e => e.stopPropagation()}>
                      {c.client_source === "online" ? (
                        <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1"
                          onClick={() => openClientProfile(c.id)}>
                          <Receipt className="h-3 w-3 mr-1" /> Bookings
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline"
                            className={`text-[10px] h-6 flex-1 ${c.whatsapp_welcome_sent ? "border-green-500/40 text-green-400" : "border-sky-500/30 text-sky-400"}`}
                            title={c.whatsapp_welcome_sent ? `Sent ${c.whatsapp_sent_at ? new Date(c.whatsapp_sent_at).toLocaleDateString() : ""}` : "Send app download link via WhatsApp"}
                            onClick={e => handleSendWelcome(c.id, e)}>
                            {c.whatsapp_welcome_sent ? "✓ App Sent" : "📱 App Link"}
                          </Button>
                          {c.monthly_fee > 0 && (
                            <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1 border-amber-500/30 text-amber-400"
                              title={`Send ₹${c.monthly_fee?.toLocaleString()} payment reminder`}
                              onClick={e => handleSendReminder(c.id, e)}>
                              💰 Remind
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-[10px] h-6 text-destructive border-destructive/30"
                            onClick={() => handleDeactivateClient(c.id)}>✕</Button>
                        </>
                      )}
                    </div>
                    {c.client_source === "offline" && c.monthly_fee > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Fee: <span className="text-primary font-bold">₹{c.monthly_fee?.toLocaleString()}/mo</span>
                        <span className="ml-2 opacity-60">· Day {c.reminder_day}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}


          {/* Add Client Dialog */}
          <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Add Offline Client</DialogTitle></DialogHeader>
              <div className="space-y-4 pb-1">

                {/* ── Basic Info ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Basic Info</p>
                  <div><Label className="text-xs text-muted-foreground">Name *</Label>
                    <Input value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" className="mt-1 bg-background border-border" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))} placeholder="9876543210" className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Age</Label>
                      <Input type="number" min="1" max="100" value={clientForm.age || ""} onChange={e => setClientForm(p => ({ ...p, age: e.target.value }))} placeholder="e.g. 16" className="mt-1 bg-background border-border" /></div>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="mt-1 bg-background border-border" /></div>
                  {/* Show guardian field if age < 18 */}
                  {clientForm.age && Number(clientForm.age) < 18 && (
                    <div><Label className="text-xs text-muted-foreground">Parent / Guardian Name</Label>
                      <Input value={clientForm.guardian_name} onChange={e => setClientForm(p => ({ ...p, guardian_name: e.target.value }))} placeholder="Parent or guardian name" className="mt-1 bg-background border-border" /></div>
                  )}
                </div>

                {/* ── Sport & Level ── */}
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sport & Level</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Sport</Label>
                      <Select value={clientForm.sport} onValueChange={v => setClientForm(p => ({ ...p, sport: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>{coachSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">How did they find you?</Label>
                      <Select value={clientForm.source} onValueChange={v => setClientForm(p => ({ ...p, source: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="walk_in">Walk-in</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Skill Level</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[["beginner","Beginner"],["intermediate","Intermediate"],["advanced","Advanced"],["professional","Professional"]].map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setClientForm(p => ({ ...p, skill_level: p.skill_level === val ? "" : val }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${clientForm.skill_level === val ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Coaching Goal</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[["fitness","Fitness"],["competition","Competition"],["hobby","Hobby"],["school_exam","School / Exam"]].map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setClientForm(p => ({ ...p, coaching_goal: p.coaching_goal === val ? "" : val }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${clientForm.coaching_goal === val ? "bg-sky-500/15 border-sky-500/40 text-sky-400" : "border-border text-muted-foreground hover:text-foreground"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Payment ── */}
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment</p>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Preferred Payment Mode</Label>
                    <div className="flex gap-2">
                      {[["cash","Cash 💵"],["upi","UPI 📲"],["bank_transfer","Bank 🏦"]].map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setClientForm(p => ({ ...p, payment_mode: val }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${clientForm.payment_mode === val ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Monthly Fee (₹)</Label>
                      <Input type="number" min="0" value={clientForm.monthly_fee || ""} onChange={e => setClientForm(p => ({ ...p, monthly_fee: Number(e.target.value) || 0 }))} placeholder="0 = no recurring fee" className="mt-1 bg-background border-border" /></div>
                    {clientForm.monthly_fee > 0 && (
                      <div><Label className="text-xs text-muted-foreground">Reminder Day (1–28)</Label>
                        <Input type="number" min="1" max="28" value={clientForm.reminder_day || 1} onChange={e => setClientForm(p => ({ ...p, reminder_day: Math.max(1, Math.min(28, Number(e.target.value) || 1)) }))} className="mt-1 bg-background border-border" /></div>
                    )}
                  </div>
                  {clientForm.monthly_fee > 0 && (
                    <p className="text-[10px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                      💰 WhatsApp payment reminder — day {clientForm.reminder_day} of each month.
                    </p>
                  )}
                </div>

                {/* ── Notes ── */}
                <div className="pt-1 border-t border-border/40">
                  <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                  <Input value={clientForm.notes} onChange={e => setClientForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Batting focus, plays for local club, Tuesday evenings only..." className="mt-1 bg-background border-border" />
                </div>

                <Button className="w-full bg-primary text-primary-foreground font-bold mt-1" onClick={handleAddClient}>Add Client</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Client Profile Dialog */}
          <Dialog open={!!viewClientId} onOpenChange={(o) => { if (!o) { setViewClientId(null); setViewClientData(null); } }}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[88vh] overflow-y-auto p-0">
              {clientProfileLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : viewClientData ? (
                <div>
                  {/* ── ONLINE CLIENT: Booking & Package Details ── */}
                  {viewClientData.client_source === "online" ? (
                    <div className="px-6 py-6 space-y-5">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg border border-primary/20 shrink-0">
                          {(viewClientData.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base">{viewClientData.name}</h3>
                          <Badge className="bg-sky-500/15 text-sky-400 text-[10px] mt-0.5">Horizon Player</Badge>
                        </div>
                        <Button size="sm" variant="outline" className="text-[10px] h-7 shrink-0"
                          onClick={() => { sessionStorage.setItem("coachDashReturnTab", "clients"); setViewClientId(null); navigate(`/player-card/${viewClientId}`); }}>
                          View Profile
                        </Button>
                      </div>

                      {/* Summary stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="glass-card rounded-lg p-3 text-center">
                          <p className="font-black text-2xl text-foreground">{viewClientData.total_sessions || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Sessions</p>
                        </div>
                        <div className="glass-card rounded-lg p-3 text-center">
                          <p className="font-black text-2xl text-primary">₹{(viewClientData.total_paid || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total Paid</p>
                        </div>
                      </div>

                      {/* Sessions */}
                      {viewClientData.sessions?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sessions</p>
                          {viewClientData.sessions.map(s => (
                            <div key={s.id} className="glass-card rounded-lg p-3 flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold">{s.date}</span>
                                  <Badge variant="secondary" className="text-[9px] capitalize">{s.sport}</Badge>
                                  <Badge className={`text-[9px] ${s.status === "completed" ? "bg-primary/15 text-primary" : s.status === "confirmed" ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-500"}`}>
                                    {s.status}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {s.start_time} – {s.end_time}{s.location && ` · ${s.location}`}
                                </p>
                                {s.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{s.notes}"</p>}
                              </div>
                              <span className="text-xs font-bold text-primary shrink-0">₹{s.price || 0}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Package Subscriptions */}
                      {viewClientData.subscriptions?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Package Subscriptions</p>
                          {viewClientData.subscriptions.map(sub => (
                            <div key={sub.id} className="glass-card rounded-lg p-3">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-bold">{sub.package_name}</span>
                                <Badge className={`text-[9px] ${sub.status === "active" ? "bg-primary/15 text-primary" : "bg-slate-500/15 text-slate-400"}`}>{sub.status}</Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {sub.sessions_used || 0} / {sub.sessions_per_month} sessions used · expires {sub.current_period_end?.slice(0, 10)}
                              </p>
                              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${Math.min(100, ((sub.sessions_used || 0) / sub.sessions_per_month) * 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(!viewClientData.sessions?.length && !viewClientData.subscriptions?.length) && (
                        <p className="text-sm text-muted-foreground text-center py-6">No bookings or packages yet.</p>
                      )}
                    </div>
                  ) : (
                    /* ── OFFLINE CLIENT: Basic Profile ── */
                    <div className="px-6 py-6 space-y-5">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl border shrink-0 ${viewClientData.linked_user_id ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                          {(viewClientData.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{viewClientData.name}</h3>
                            {viewClientData.linked_user_id && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                <BadgeCheck className="h-3 w-3 mr-1" /> Lobbi User
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {viewClientData.phone && <span className="text-xs text-muted-foreground">{viewClientData.phone}</span>}
                            {viewClientData.email && <span className="text-xs text-muted-foreground truncate">{viewClientData.email}</span>}
                          </div>
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {viewClientData.sport && <Badge variant="secondary" className="text-[10px] capitalize">{viewClientData.sport}</Badge>}
                            {viewClientData.source && <Badge className="bg-amber-500/15 text-amber-400 text-[10px] capitalize">{viewClientData.source?.replace("_", " ")}</Badge>}
                            {viewClientData.skill_level && <Badge variant="outline" className="text-[10px] capitalize">{viewClientData.skill_level}</Badge>}
                          </div>
                        </div>
                      </div>

                      {/* View Lobbi Social Profile */}
                      {viewClientData.linked_user_id && (
                        <Button className="w-full bg-primary text-primary-foreground font-bold"
                          onClick={() => { setViewClientId(null); setViewClientData(null); sessionStorage.setItem("coachDashReturnTab", "clients"); navigate(`/player-card/${viewClientData.linked_user_id}`); }}>
                          <Eye className="h-4 w-4 mr-2" /> View Lobbi Social Profile
                        </Button>
                      )}

                      {/* Stats */}
                      <div className={`grid gap-3 ${viewClientData.monthly_fee > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                        <div className="glass-card rounded-lg p-4 text-center">
                          <p className="font-black text-2xl text-foreground">{viewClientData.total_sessions || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Sessions</p>
                        </div>
                        <div className="glass-card rounded-lg p-4 text-center">
                          <p className="font-black text-2xl text-primary">₹{(viewClientData.total_paid || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total Paid</p>
                        </div>
                        {viewClientData.monthly_fee > 0 && (
                          <div className="glass-card rounded-lg p-4 text-center">
                            <p className="font-black text-2xl text-amber-400">₹{viewClientData.monthly_fee.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Monthly Fee</p>
                          </div>
                        )}
                      </div>

                      {/* Extra info */}
                      {(viewClientData.age || viewClientData.coaching_goal || viewClientData.guardian_name || viewClientData.payment_mode) && (
                        <div className="glass-card rounded-lg p-3 space-y-1.5">
                          {viewClientData.age && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Age</span><span className="font-medium">{viewClientData.age}</span></div>}
                          {viewClientData.coaching_goal && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Goal</span><span className="font-medium capitalize">{viewClientData.coaching_goal.replace("_", " ")}</span></div>}
                          {viewClientData.guardian_name && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Guardian</span><span className="font-medium">{viewClientData.guardian_name}</span></div>}
                          {viewClientData.payment_mode && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Payment Mode</span><span className="font-medium capitalize">{viewClientData.payment_mode}</span></div>}
                          {viewClientData.monthly_fee > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reminder Day</span><span className="font-medium">Day {viewClientData.reminder_day} of month</span></div>}
                        </div>
                      )}

                      {/* Session history */}
                      {viewClientData.sessions?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session History ({viewClientData.sessions.length})</p>
                          {viewClientData.sessions.slice(0, 8).map(s => (
                            <div key={s.id} className="glass-card rounded-lg p-3 flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold">{s.date}</span>
                                  {s.sport && <Badge variant="secondary" className="text-[9px] capitalize">{s.sport}</Badge>}
                                  <Badge className={`text-[9px] ${s.payment_status === "paid" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-500"}`}>
                                    {s.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{s.start_time} – {s.end_time}</p>
                              </div>
                              <span className="text-xs font-bold text-primary shrink-0">₹{s.amount || 0}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Payments */}
                      {viewClientData.payments?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payments ({viewClientData.payments.length})</p>
                          {viewClientData.payments.slice(0, 5).map(p => (
                            <div key={p.id} className="glass-card rounded-lg p-3 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-bold">{p.payment_date || p.created_at?.slice(0, 10)}</span>
                                {p.notes && <p className="text-[10px] text-muted-foreground">{p.notes}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] capitalize">{p.mode || p.payment_mode}</Badge>
                                <span className="text-xs font-bold text-primary">₹{p.amount}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {viewClientData.notes && (
                        <div className="glass-card rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Notes</p>
                          <p className="text-sm">{viewClientData.notes}</p>
                        </div>
                      )}

                      {/* WhatsApp actions */}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline"
                          className={`flex-1 text-xs ${viewClientData.whatsapp_welcome_sent ? "border-green-500/40 text-green-400" : "border-sky-500/30 text-sky-400"}`}
                          onClick={e => handleSendWelcome(viewClientData.id, e)}>
                          {viewClientData.whatsapp_welcome_sent ? "✓ App Link Sent" : "📱 Send App Link"}
                        </Button>
                        {viewClientData.monthly_fee > 0 && (
                          <Button size="sm" variant="outline"
                            className="flex-1 text-xs border-amber-500/30 text-amber-400"
                            onClick={e => handleSendReminder(viewClientData.id, e)}>
                            💰 Send Reminder
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Could not load profile.</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      {/* ─── PACKAGES Tab (Individual Coach) ─── */}
      {mgmtTab === "packages" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Monthly Packages</h3>
              <p className="text-xs text-muted-foreground mt-1">{packages.length} package{packages.length !== 1 ? "s" : ""} · offer subscription-based coaching</p>
            </div>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
              onClick={() => { setEditPkgId(null); setPkgForm({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "", type: "monthly", max_subscribers: "", features: [], is_public: true }); setShowCreatePkg(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Package
            </Button>
          </div>

          {/* Create / Edit Package Dialog */}
          <Dialog open={showCreatePkg} onOpenChange={(o) => { setShowCreatePkg(o); if (!o) setEditPkgId(null); }}>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editPkgId ? "Edit Package" : "Create Package"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Package Name *</Label>
                  <Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pro Training Monthly" className="mt-1 bg-background border-border" />
                </div>
                {/* Type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Package Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {PKG_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setPkgForm(p => ({ ...p, type: t.value }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          pkgForm.type === t.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>{t.label}</button>
                    ))}
                  </div>
                </div>
                {/* Sessions / Price / Duration */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{PKG_TYPES.find(t => t.value === pkgForm.type)?.sessionsLabel || "Sessions/Month"}</Label>
                    <Input type="number" value={pkgForm.sessions_per_month}
                      onChange={e => setPkgForm(p => ({ ...p, sessions_per_month: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                    <Input type="number" value={pkgForm.price}
                      onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                    <Input type="number" value={pkgForm.duration_minutes}
                      onChange={e => setPkgForm(p => ({ ...p, duration_minutes: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                </div>
                {/* Sports */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Sports</Label>
                  <div className="flex flex-wrap gap-2">
                    {coachSports.map(sport => (
                      <label key={sport}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border ${
                          pkgForm.sports.includes(sport)
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        <Checkbox checked={pkgForm.sports.includes(sport)} onCheckedChange={() => togglePkgSport(sport)} className="h-3 w-3" />
                        <span className="capitalize">{sport.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Features */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Included Features</Label>
                  <div className="flex flex-wrap gap-2">
                    {PKG_FEATURES_PRESET.map(f => (
                      <button key={f} type="button"
                        onClick={() => setPkgForm(p => ({ ...p, features: p.features.includes(f) ? p.features.filter(x => x !== f) : [...p.features, f] }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          pkgForm.features.includes(f)
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                        }`}>{pkgForm.features.includes(f) ? "✓ " : ""}{f}</button>
                    ))}
                  </div>
                </div>
                {/* Capacity + Visibility */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Subscribers</Label>
                    <Input type="number" placeholder="Unlimited" value={pkgForm.max_subscribers}
                      onChange={e => setPkgForm(p => ({ ...p, max_subscribers: e.target.value }))}
                      className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Visibility</Label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPkgForm(p => ({ ...p, is_public: true }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          pkgForm.is_public ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/30 border-border text-muted-foreground"
                        }`}>Public</button>
                      <button type="button" onClick={() => setPkgForm(p => ({ ...p, is_public: false }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          !pkgForm.is_public ? "bg-amber-500/15 border-amber-500/40 text-amber-600" : "bg-secondary/30 border-border text-muted-foreground"
                        }`}>Private</button>
                    </div>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the package..."
                    className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-primary text-primary-foreground font-bold"
                    onClick={editPkgId ? handleUpdatePackage : handleCreatePackage}
                    disabled={pkgCreating}>
                    {pkgCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editPkgId ? <CheckCircle className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {editPkgId ? "Update Package" : "Create Package"}
                  </Button>
                  <Button variant="outline" className="font-bold" onClick={() => { setShowCreatePkg(false); setEditPkgId(null); }}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Packages Grid */}
          {packages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg, idx) => (
                <motion.div key={pkg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{pkg.name}</h4>
                        <p className="text-xs text-muted-foreground capitalize">{pkg.type || "monthly"} · {pkg.sessions_per_month} sessions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pkg.is_public !== false ? "bg-primary/10 border-primary/20 text-primary" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
                        {pkg.is_public !== false ? "Public" : "Private"}
                      </span>
                      <button onClick={() => openEditPkg(pkg)}
                        className="h-7 w-7 rounded-md bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setConfirmDeletePkgId(pkg.id)}
                        className="h-7 w-7 rounded-md bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Confirm delete inline */}
                  {confirmDeletePkgId === pkg.id && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                      <p className="text-xs text-destructive flex-1">Delete this package?</p>
                      <button onClick={() => handleDeletePackage(pkg.id)}
                        className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded hover:bg-destructive/20">Yes</button>
                      <button onClick={() => setConfirmDeletePkgId(null)}
                        className="text-xs font-bold text-muted-foreground px-2 py-1 rounded hover:bg-muted">No</button>
                    </div>
                  )}

                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-xl text-primary">₹{(pkg.price || 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">{PKG_TYPES.find(t => t.value === (pkg.type || "monthly"))?.priceLabel || "/month"}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{pkg.duration_minutes || 60} min/session
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />{pkg.subscriber_count || 0}{pkg.max_subscribers ? `/${pkg.max_subscribers}` : ""} subscriber{pkg.subscriber_count !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {pkg.features?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.features.map(f => <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary font-medium">✓ {f}</span>)}
                    </div>
                  )}
                  {pkg.sports?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.sports.map(s => <Badge key={s} variant="secondary" className="text-[10px] capitalize">{s.replace("_", " ")}</Badge>)}
                    </div>
                  )}
                  {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass-card rounded-xl text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold mb-1">No Packages Yet</p>
              <p className="text-sm">Create your first package to offer subscription-based coaching.</p>
              <Button size="sm" className="mt-4 bg-primary text-primary-foreground font-bold text-xs"
                onClick={() => { setEditPkgId(null); setPkgForm({ name: "", sessions_per_month: "4", price: "2000", duration_minutes: "60", sports: [], description: "", type: "monthly", max_subscribers: "", features: [], is_public: true }); setShowCreatePkg(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create First Package
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── FINANCE Tab ─── */}
      {mgmtTab === "finance" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* ── P&L Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AthleticStatCard icon={IndianRupee} label="Total Income" value={`₹${(financeSummaryData?.total_income || 0).toLocaleString()}`} iconColor="primary" delay={0.1} />
            <AthleticStatCard icon={TrendingUp} label="Net Profit" value={`₹${(financeSummaryData?.net_profit || 0).toLocaleString()}`} iconColor={financeSummaryData?.net_profit >= 0 ? "primary" : "destructive"} delay={0.2} />
            <AthleticStatCard icon={Receipt} label="Total Expenses" value={`₹${(financeSummaryData?.total_expenses || 0).toLocaleString()}`} iconColor="amber" delay={0.3} />
            <AthleticStatCard icon={Wallet} label="This Month" value={`₹${(financeSummaryData?.current_month?.net || 0).toLocaleString()}`} iconColor="sky" delay={0.4} />
          </div>

          {/* Commission banner */}
          {financeSummaryData?.commission_total > 0 && (
            <div className="glass-card rounded-xl p-3 flex items-center gap-3 border-l-4 border-amber-500/50">
              <Info className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs">
                <span className="font-bold">Platform Commission:</span> {financeSummaryData.commission_pct}% on online = ₹{financeSummaryData.commission_total.toLocaleString()} deducted
              </p>
            </div>
          )}

          {/* ── Sub-tabs ── */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
            {[
              { id: "overview", label: "Overview" },
              { id: "transactions", label: "Ledger" },
              { id: "expenses", label: "Expenses" },
              { id: "outstanding", label: "Outstanding" },
              { id: "invoices", label: `Invoices${invoices.length ? ` (${invoices.length})` : ""}` },
              { id: "payouts", label: "Payouts" },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setFinanceSubTab(id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${financeSubTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW sub-tab ── */}
          {financeSubTab === "overview" && (
            <div className="space-y-6">
              {/* Income vs Expense breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Income Breakdown</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Online Sessions & Packages</span>
                      <span className="font-bold text-sky-400">₹{(financeSummaryData?.online_income || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Offline Payments</span>
                      <span className="font-bold text-violet-400">₹{(financeSummaryData?.offline_income || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-black">
                      <span>Net Income</span>
                      <span className="text-primary">₹{(financeSummaryData?.net_income || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expense Breakdown</p>
                  {Object.keys(financeSummaryData?.expenses_by_category || {}).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(financeSummaryData.expenses_by_category).map(([cat, amt]) => (
                        <div key={cat} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{cat.replace("_", " ")}</span>
                          <span className="font-bold text-amber-400">₹{amt.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between text-sm font-black">
                        <span>Total</span>
                        <span className="text-destructive">₹{(financeSummaryData?.total_expenses || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No expenses recorded</p>
                  )}
                </div>
              </div>

              {/* Monthly Trend Chart */}
              {(financeSummaryData?.monthly_trend || []).length > 0 && (
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">6-Month Trend</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={financeSummaryData.monthly_trend} barSize={18} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                        formatter={(value, name) => [`₹${value.toLocaleString()}`, name === "income" ? "Income" : name === "expenses" ? "Expenses" : "Net"]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
                      <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" name="Net" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Payment Mode Breakdown */}
              {financeSummaryData?.income_by_mode && (
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Income by Payment Mode</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(financeSummaryData.income_by_mode).filter(([, v]) => v > 0).map(([mode, amt]) => (
                      <div key={mode} className="bg-muted/40 rounded-lg p-3 text-center">
                        <p className="font-black text-sm text-foreground">₹{amt.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{mode.replace("_", " ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TRANSACTIONS sub-tab ── */}
          {financeSubTab === "transactions" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="glass-card rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">From</Label>
                  <Input type="date" value={transactionFilters.date_from}
                    onChange={e => setTransactionFilters(f => ({ ...f, date_from: e.target.value }))}
                    className="mt-1 bg-background border-border text-xs h-8" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">To</Label>
                  <Input type="date" value={transactionFilters.date_to}
                    onChange={e => setTransactionFilters(f => ({ ...f, date_to: e.target.value }))}
                    className="mt-1 bg-background border-border text-xs h-8" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</Label>
                  <Select value={transactionFilters.type} onValueChange={v => setTransactionFilters(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button size="sm" className="w-full h-8 text-xs font-bold bg-primary text-primary-foreground"
                    onClick={() => loadTransactions(transactionFilters)}>
                    <Filter className="h-3 w-3 mr-1" /> Apply
                  </Button>
                </div>
              </div>

              {/* Transaction list */}
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map(txn => (
                    <div key={txn.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${txn.type === "income" ? "bg-primary/10" : "bg-destructive/10"}`}>
                        {txn.type === "income"
                          ? <ArrowUpRight className="h-4 w-4 text-primary" />
                          : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-sm truncate">
                            {txn.type === "income" ? (txn.client_name || txn.description) : txn.description || txn.category}
                          </span>
                          <Badge className={`text-[9px] ${txn.type === "income" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                            {txn.type}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] capitalize">{txn.payment_mode?.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{txn.date} · {txn.category?.replace("_", " ")}</p>
                      </div>
                      <span className={`font-black text-sm shrink-0 ${txn.type === "income" ? "text-primary" : "text-destructive"}`}>
                        {txn.type === "income" ? "+" : "-"}₹{(txn.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No transactions found</p>
                </div>
              )}
            </div>
          )}

          {/* ── EXPENSES sub-tab ── */}
          {financeSubTab === "expenses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{expenses.length} expense{expenses.length !== 1 ? "s" : ""} recorded</p>
                <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
                  onClick={() => { setEditExpenseId(null); setExpenseForm({ category: "venue_rent", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_mode: "cash", reference: "" }); setAddExpenseOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense
                </Button>
              </div>

              {expenses.length > 0 ? (
                <div className="space-y-2">
                  {expenses.map(exp => (
                    <div key={exp.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                      <div className="bg-amber-500/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                        <ArrowDownRight className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-sm capitalize">{exp.category?.replace("_", " ")}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">{exp.payment_mode?.replace("_", " ")}</Badge>
                          {exp.recurring && <Badge className="text-[9px] bg-violet-500/10 text-violet-400">Recurring</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{exp.date}{exp.description ? ` · ${exp.description}` : ""}</p>
                      </div>
                      <span className="font-black text-sm text-amber-400 shrink-0">₹{(exp.amount || 0).toLocaleString()}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditExpense(exp)} className="h-7 w-7 rounded-md bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="h-7 w-7 rounded-md bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No expenses yet. Add your first expense.</p>
                </div>
              )}

              {/* Add/Edit Expense Dialog */}
              <Dialog open={addExpenseOpen} onOpenChange={(o) => { setAddExpenseOpen(o); if (!o) setEditExpenseId(null); }}>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">{editExpenseId ? "Edit Expense" : "Add Expense"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger className="mt-1 bg-background border-border text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["venue_rent","equipment","travel","marketing","software","insurance","utilities","professional_fees","other"].map(c => (
                              <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Amount (₹) *</Label>
                        <Input type="number" value={expenseForm.amount}
                          onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                          className="mt-1 bg-background border-border" placeholder="0" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input type="date" value={expenseForm.date}
                          onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                          className="mt-1 bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                        <Select value={expenseForm.payment_mode} onValueChange={v => setExpenseForm(f => ({ ...f, payment_mode: v }))}>
                          <SelectTrigger className="mt-1 bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Input value={expenseForm.description}
                        onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                        className="mt-1 bg-background border-border" placeholder="e.g. Monthly court rent" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Reference / Receipt No.</Label>
                      <Input value={expenseForm.reference}
                        onChange={e => setExpenseForm(f => ({ ...f, reference: e.target.value }))}
                        className="mt-1 bg-background border-border" placeholder="Optional" />
                    </div>
                    <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveExpense}>
                      {editExpenseId ? "Update Expense" : "Add Expense"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── OUTSTANDING sub-tab ── */}
          {financeSubTab === "outstanding" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {["all", "overdue", "pending", "paid"].map(f => (
                  <button key={f} onClick={() => setOutstandingFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${outstandingFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {(() => {
                const filtered = clientOutstanding.filter(c => outstandingFilter === "all" || c.status === outstandingFilter);
                if (filtered.length === 0) return (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No {outstandingFilter !== "all" ? outstandingFilter : ""} outstanding entries</p>
                  </div>
                );
                return (
                  <div className="space-y-2">
                    {filtered.map(c => (
                      <div key={c.client_id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${c.status === "overdue" ? "bg-destructive/10" : c.status === "pending" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                          {c.status === "overdue" ? <AlertTriangle className="h-4 w-4 text-destructive" />
                            : c.status === "pending" ? <Clock className="h-4 w-4 text-amber-400" />
                            : <CheckCircle className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm">{c.client_name}</span>
                            <Badge className={`text-[9px] ${c.status === "overdue" ? "bg-destructive/10 text-destructive" : c.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"}`}>
                              {c.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Billed ₹{c.total_billed.toLocaleString()} · Paid ₹{c.total_paid.toLocaleString()}
                            {c.last_payment_date && <span> · Last paid {c.last_payment_date}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${c.outstanding > 0 ? "text-destructive" : "text-primary"}`}>
                            {c.outstanding > 0 ? `₹${c.outstanding.toLocaleString()} due` : "Settled"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Summary row */}
              {clientOutstanding.length > 0 && (
                <div className="glass-card rounded-xl p-4 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">Total Outstanding</span>
                  <span className="font-black text-lg text-destructive">
                    ₹{clientOutstanding.reduce((s, c) => s + (c.outstanding || 0), 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICES sub-tab ── */}
          {financeSubTab === "invoices" && (
            <div className="space-y-4">
              {/* Header bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {["all", "sent", "paid", "draft"].map(s => (
                    <button key={s} onClick={() => {
                      setInvoiceStatusFilter(s);
                      loadInvoices({ month: invoiceMonth, status: s !== "all" ? s : undefined });
                    }}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${invoiceStatusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                  <input type="month" value={invoiceMonth}
                    onChange={e => { setInvoiceMonth(e.target.value); loadInvoices({ month: e.target.value, status: invoiceStatusFilter !== "all" ? invoiceStatusFilter : undefined }); }}
                    className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowGSTSettings(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-muted/40 hover:bg-muted text-muted-foreground transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">receipt_long</span>
                    GST Settings {gstSettings.gst_enabled && <span className="text-[10px] text-primary">ON</span>}
                  </button>
                  <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8"
                    onClick={() => setShowCreateInvoice(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create Invoice
                  </Button>
                </div>
              </div>

              {/* GST Settings Dialog */}
              <Dialog open={showGSTSettings} onOpenChange={setShowGSTSettings}>
                <DialogContent className="bg-card border-border max-w-sm">
                  <DialogHeader><DialogTitle className="font-display">GST & Invoice Settings</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-bold">Enable GST</Label>
                        <p className="text-xs text-muted-foreground">Apply GST to all invoices by default</p>
                      </div>
                      <button onClick={() => setGstSettings(g => ({ ...g, gst_enabled: !g.gst_enabled }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${gstSettings.gst_enabled ? "bg-primary" : "bg-muted"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${gstSettings.gst_enabled ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    {gstSettings.gst_enabled && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">GSTIN</Label>
                          <Input value={gstSettings.gstin || ""} onChange={e => setGstSettings(g => ({ ...g, gstin: e.target.value.toUpperCase() }))}
                            placeholder="29ABCDE1234F1Z5" className="mt-1 bg-background border-border font-mono text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">GST Rate</Label>
                          <div className="flex gap-2">
                            {[5, 12, 18].map(r => (
                              <button key={r} type="button" onClick={() => setGstSettings(g => ({ ...g, gst_rate: r }))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${gstSettings.gst_rate === r ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                                {r}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Invoice Prefix</Label>
                      <Input value={gstSettings.invoice_prefix || "INV"} onChange={e => setGstSettings(g => ({ ...g, invoice_prefix: e.target.value.toUpperCase() }))}
                        placeholder="INV" className="mt-1 bg-background border-border w-28" />
                      <p className="text-[10px] text-muted-foreground mt-1">e.g. INV → INV-2025-0001</p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={handleSaveGstSettings} disabled={gstSaving}>
                        {gstSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                        Save Settings
                      </Button>
                      <Button variant="outline" onClick={() => setShowGSTSettings(false)}>Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Create Invoice Dialog */}
              <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
                <DialogContent className="bg-card border-border max-w-2xl max-h-[92vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-display">Create Invoice</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {/* Client info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <Label className="text-xs text-muted-foreground">Client Name *</Label>
                        <div className="relative mt-1">
                          <Input value={invoiceForm.client_name}
                            onChange={e => {
                              const val = e.target.value;
                              setInvoiceForm(f => ({ ...f, client_name: val }));
                              const match = clients.find(c => c.name?.toLowerCase().includes(val.toLowerCase()));
                              if (match) setInvoiceForm(f => ({ ...f, client_name: val, client_id: match.id, client_phone: match.phone || f.client_phone, client_email: match.email || f.client_email }));
                            }}
                            list="inv-clients-list" placeholder="Type client name..." className="bg-background border-border" />
                          <datalist id="inv-clients-list">
                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </datalist>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Client Phone</Label>
                        <Input value={invoiceForm.client_phone} onChange={e => setInvoiceForm(f => ({ ...f, client_phone: e.target.value }))}
                          placeholder="+91..." className="mt-1 bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                        <Input type="date" value={invoiceForm.date} onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))}
                          className="mt-1 bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Due Date</Label>
                        <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))}
                          className="mt-1 bg-background border-border" />
                      </div>
                    </div>

                    {/* Line items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">Items</Label>
                        <button type="button" onClick={() => setInvoiceItems(prev => [...prev, { description: "", qty: "1", rate: "" }])}
                          className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                          <Plus className="h-3 w-3" /> Add Row
                        </button>
                      </div>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="grid grid-cols-12 bg-muted/50 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">
                          <span className="col-span-6">Description</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-right">Rate (₹)</span>
                          <span className="col-span-2 text-right">Amount</span>
                        </div>
                        {invoiceItems.map((item, i) => (
                          <div key={i} className="grid grid-cols-12 items-center px-2 py-1.5 border-t border-border gap-1">
                            <input value={item.description} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                              placeholder="e.g. Badminton coaching - 4 sessions"
                              className="col-span-6 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0" />
                            <input type="number" value={item.qty} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                              className="col-span-2 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                            <input type="number" value={item.rate} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))}
                              placeholder="0" className="col-span-2 bg-background border border-border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary/50" />
                            <div className="col-span-1 text-right text-xs font-bold text-foreground">
                              {((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </div>
                            {invoiceItems.length > 1 && (
                              <button type="button" onClick={() => setInvoiceItems(prev => prev.filter((_, j) => j !== i))}
                                className="col-span-1 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GST toggle + totals */}
                    <div className="grid grid-cols-2 gap-4 items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setInvoiceForm(f => ({ ...f, gst_enabled: !f.gst_enabled }))}
                            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${invoiceForm.gst_enabled ? "bg-primary" : "bg-muted"}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${invoiceForm.gst_enabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                          <Label className="text-xs font-bold">Apply GST {gstSettings.gst_enabled ? `(${gstSettings.gst_rate}%)` : ""}</Label>
                        </div>
                        {invoiceForm.gst_enabled && !gstSettings.gstin && (
                          <p className="text-[10px] text-amber-500">Set your GSTIN in GST Settings for it to appear on the PDF.</p>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Mode</Label>
                          <div className="flex gap-1.5 flex-wrap">
                            {["cash", "upi", "bank_transfer"].map(m => (
                              <button key={m} type="button" onClick={() => setInvoiceForm(f => ({ ...f, payment_mode: m }))}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${invoiceForm.payment_mode === m ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                                {m.replace("_", " ")}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>₹{invoiceSubtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        {invoiceForm.gst_enabled && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>GST ({gstSettings.gst_rate}%)</span>
                            <span>₹{invoiceGstAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-sm border-t border-border pt-1.5">
                          <span>Total</span>
                          <span className="text-primary">₹{invoiceTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                      <textarea value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Payment instructions, thank you note..."
                        className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm min-h-[50px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={handleCreateInvoice} disabled={invoiceCreating}>
                        {invoiceCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                        Create & Send Invoice
                      </Button>
                      <Button variant="outline" className="font-bold" onClick={() => setShowCreateInvoice(false)}>Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Invoice list */}
              {invoices.length === 0 ? (
                <div className="text-center py-16 glass-card rounded-xl text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-bold mb-1">No Invoices Yet</p>
                  <p className="text-sm">Create your first invoice to get started.</p>
                  <Button size="sm" className="mt-4 bg-primary text-primary-foreground font-bold text-xs"
                    onClick={() => setShowCreateInvoice(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create Invoice
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    {[
                      { label: "Total", value: `₹${invoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-foreground" },
                      { label: "Collected", value: `₹${invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-primary" },
                      { label: "Pending", value: `₹${invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-amber-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-card rounded-lg p-3 text-center">
                        <p className={`font-black text-sm ${color}`}>{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {invoices.map(inv => (
                    <motion.div key={inv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="glass-card rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm">{inv.invoice_no}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              inv.status === "paid" ? "bg-primary/10 border-primary/20 text-primary"
                              : inv.status === "sent" ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              : "bg-muted border-border text-muted-foreground"
                            }`}>{inv.status.toUpperCase()}</span>
                            {inv.gst_enabled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">GST</span>}
                          </div>
                          <p className="text-sm font-medium">{inv.client_name}</p>
                          <p className="text-xs text-muted-foreground">{inv.date} · Due {inv.due_date}</p>
                          {inv.items?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {inv.items.map(i => i.description).filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-base text-primary">₹{(inv.total || 0).toLocaleString()}</p>
                          {inv.gst_enabled && <p className="text-[10px] text-muted-foreground">incl. GST {inv.gst_rate}%</p>}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        <button onClick={() => handleViewInvoicePdf(inv)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="h-3 w-3" /> View PDF
                        </button>
                        <button onClick={() => handleDownloadInvoicePdf(inv)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <Download className="h-3 w-3" /> Download
                        </button>
                        <button onClick={() => handleSendInvoiceWhatsapp(inv)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-xs font-bold text-green-600 transition-colors">
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </button>
                        {inv.status !== "paid" && (
                          <button onClick={() => handleMarkInvoicePaid(inv.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary transition-colors">
                            <CheckCircle className="h-3 w-3" /> Mark Paid
                          </button>
                        )}
                        <button onClick={() => handleDeleteInvoice(inv.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-xs font-bold text-destructive transition-colors ml-auto">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PAYOUTS sub-tab ── */}
          {financeSubTab === "payouts" && (
            <div className="space-y-6">
              {/* Bank Account Section */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">Bank Account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Link your bank account for payouts</p>
                  </div>
                  {linkedAccount && (
                    <Badge className={`text-xs font-bold rounded-full px-3 ${linkedAccount.status === "active" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"}`}>
                      {linkedAccount.status || "pending"}
                    </Badge>
                  )}
                </div>
                {linkedAccount ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Account</p>
                      <p className="font-semibold">{linkedAccount.bank_account?.account_number || "****"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IFSC</p>
                      <p className="font-semibold">{linkedAccount.bank_account?.ifsc_code || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-semibold">{linkedAccount.bank_account?.beneficiary_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bank</p>
                      <p className="font-semibold">{linkedAccount.bank_account?.bank_name || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Account Number</Label>
                        <Input value={bankForm.account_number} onChange={e => setBankForm(p => ({ ...p, account_number: e.target.value }))} placeholder="Enter account number" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">IFSC Code</Label>
                        <Input value={bankForm.ifsc_code} onChange={e => setBankForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Beneficiary Name</Label>
                        <Input value={bankForm.beneficiary_name} onChange={e => setBankForm(p => ({ ...p, beneficiary_name: e.target.value }))} placeholder="Name as on bank account" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Bank Name</Label>
                        <Input value={bankForm.bank_name} onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. State Bank of India" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input value={bankForm.phone} onChange={e => setBankForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit phone" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input value={bankForm.email} onChange={e => setBankForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" className="mt-1" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={bankSaving || !bankForm.account_number || !bankForm.ifsc_code || !bankForm.beneficiary_name}
                      onClick={async () => {
                        setBankSaving(true);
                        try {
                          await payoutAPI.createLinkedAccount(bankForm);
                          toast.success("Bank account linked successfully");
                          loadPayoutData();
                        } catch (err) { toast.error(err?.response?.data?.detail || "Failed to link account"); }
                        finally { setBankSaving(false); }
                      }}
                      className="gap-2"
                    >
                      {bankSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                      Link Bank Account
                    </Button>
                  </div>
                )}
              </div>

              {/* Payout Summary Cards */}
              {payoutSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <AthleticStatCard icon={IndianRupee} label="Total Earned" value={`₹${(payoutSummary.total_earned || 0).toLocaleString()}`} iconColor="primary" delay={0.1} />
                  <AthleticStatCard icon={CheckCircle2} label="Total Settled" value={`₹${(payoutSummary.total_settled || 0).toLocaleString()}`} iconColor="emerald" delay={0.2} />
                  <AthleticStatCard icon={Clock} label="Pending" value={`₹${(payoutSummary.pending_settlement || 0).toLocaleString()}`} iconColor="amber" delay={0.3} />
                  <AthleticStatCard icon={Banknote} label="Last Payout" value={payoutSummary.last_payout_amount ? `₹${payoutSummary.last_payout_amount.toLocaleString()}` : "—"} iconColor="sky" delay={0.4} />
                </div>
              )}

              {/* Payout History */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payout History</p>
                {myPayouts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No payouts yet. Payouts are processed by the platform admin.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myPayouts.map(p => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setPayoutDetailDialog(p)}
                      >
                        <div>
                          <p className="text-sm font-bold text-foreground">₹{(p.net_amount || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.period_start} → {p.period_end}
                            {p.transfer_utr && <span className="ml-2 font-mono">UTR: {p.transfer_utr}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs font-bold rounded-full px-3 ${
                            p.status === "completed" ? "bg-primary/10 text-primary" :
                            p.status === "processing" ? "bg-blue-500/10 text-blue-500" :
                            p.status === "failed" ? "bg-destructive/10 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {p.status}
                          </Badge>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payout Detail Dialog */}
              {payoutDetailDialog && (
                <Dialog open={!!payoutDetailDialog} onOpenChange={() => setPayoutDetailDialog(null)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Payout Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-xs text-muted-foreground">Period</p><p className="font-semibold">{payoutDetailDialog.period_start} → {payoutDetailDialog.period_end}</p></div>
                        <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{payoutDetailDialog.status}</p></div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">₹{(payoutDetailDialog.gross_amount || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Commission ({payoutDetailDialog.commission_pct || 10}%)</span><span className="font-medium text-destructive">-₹{(payoutDetailDialog.commission_amount || 0).toLocaleString()}</span></div>
                        <div className="border-t border-border/40 pt-2 flex justify-between"><span className="font-bold">Net Payout</span><span className="font-black text-primary">₹{(payoutDetailDialog.net_amount || 0).toLocaleString()}</span></div>
                      </div>
                      {payoutDetailDialog.razorpay_transfer_id && (
                        <p className="text-xs text-muted-foreground">Transfer: <span className="font-mono">{payoutDetailDialog.razorpay_transfer_id}</span></p>
                      )}
                      {payoutDetailDialog.transfer_utr && (
                        <p className="text-xs text-muted-foreground">UTR: <span className="font-mono">{payoutDetailDialog.transfer_utr}</span></p>
                      )}
                      {payoutDetailDialog.line_items?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Items ({payoutDetailDialog.line_items.length})</p>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {payoutDetailDialog.line_items.map((item, i) => (
                              <div key={i} className="flex justify-between py-1.5 px-3 bg-muted/20 rounded-lg text-xs">
                                <span>{item.description || item.type} <span className="text-muted-foreground">{item.date}</span></span>
                                <span className="font-semibold">₹{(item.net || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── REVIEWS Tab ─── */}
      {mgmtTab === "reviews" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="glass-card rounded-xl p-5 text-center min-w-[120px]">
              <p className="font-black text-3xl text-primary">{sessionStats?.avg_rating || "—"}</p>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(sessionStats?.avg_rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Average Rating</p>
            </div>
            <div className="glass-card rounded-xl p-5 text-center min-w-[120px]">
              <p className="font-black text-3xl text-foreground">{completedSessions.filter(s => s.review).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
            </div>
          </div>

          {(() => {
            const reviewed = completedSessions.filter(s => s.review || s.rating);
            if (reviewed.length === 0) return (
              <div className="text-center py-16 text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No reviews yet. Reviews appear after sessions are completed.</p>
              </div>
            );
            return (
              <div className="space-y-3">
                {reviewed.map(s => (
                  <div key={s.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{s.player_name}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.sport}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`h-3 w-3 ${i <= (s.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {s.review && <p className="text-sm text-muted-foreground italic">"{s.review}"</p>}
                    <p className="text-xs text-muted-foreground mt-2">{s.date}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ─── WHATSAPP Tab ─── */}
      {mgmtTab === "whatsapp" && (() => {
        const AUTOMATIONS = [
          { key: "welcome",              icon: "📱", title: "Welcome Message",        desc: "Sent automatically when you add a new offline client with a phone number", config: null },
          { key: "booking_confirmation", icon: "✅", title: "Booking Confirmation",   desc: "Sent when an online session is confirmed (payment or package)", config: null },
          { key: "session_reminder",     icon: "🔔", title: "Session Reminder",       desc: "Sent to the player before an upcoming session",
            config: { field: "hours_before", label: "Remind", options: [{ v: 1, l: "1 hour before" }, { v: 2, l: "2 hours before" }, { v: 12, l: "12 hours before" }, { v: 24, l: "1 day before" }, { v: 48, l: "2 days before" }] } },
          { key: "package_expiry",       icon: "⚠️", title: "Package Expiry Alert",   desc: "Sent when a student's package is about to expire",
            config: { field: "days_before", label: "Alert", options: [{ v: 1, l: "1 day before" }, { v: 2, l: "2 days before" }, { v: 3, l: "3 days before" }, { v: 5, l: "5 days before" }, { v: 7, l: "7 days before" }] } },
          { key: "payment_reminder",     icon: "💰", title: "Payment Reminder",       desc: "Sent daily with Razorpay link when monthly fee is due (until paid)", config: null },
          { key: "no_show_followup",     icon: "😊", title: "No-Show Follow-up",      desc: "Sent at 9 PM when a client misses a confirmed session", config: null },
          { key: "monthly_progress",     icon: "📊", title: "Monthly Progress Report", desc: "Sent to all active subscribers on the last day of each month", config: null },
        ];
        const ICON_MAP = { welcome: "📱", booking_confirmation: "✅", session_reminder: "🔔", package_expiry: "⚠️", payment_reminder: "💰", no_show_followup: "😊", monthly_progress: "📊" };
        if (!Object.keys(waSettings).length && !waLoading) loadWaSettings();
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold font-display">WhatsApp Automations</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Messages sent automatically to your clients. Configure WhatsApp credentials in <span className="text-primary cursor-pointer underline underline-offset-2">Settings</span> first.</p>
            </div>
            {waLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="space-y-3">
                  {AUTOMATIONS.map(a => {
                    const cfg = waSettings[a.key] || {};
                    const enabled = cfg.enabled ?? false;
                    return (
                      <div key={a.key} className={`glass-card rounded-xl p-4 transition-all border ${enabled ? "border-primary/20" : "border-border/40 opacity-60"}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-0.5 shrink-0">{a.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm">{a.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                              </div>
                              {/* Toggle */}
                              <button
                                onClick={() => handleWaToggle(a.key, !enabled)}
                                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                              </button>
                            </div>
                            {a.config && enabled && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{a.config.label}:</span>
                                <Select
                                  value={String(cfg[a.config.field] ?? a.config.options[0].v)}
                                  onValueChange={v => handleWaConfigChange(a.key, a.config.field, Number(v))}
                                >
                                  <SelectTrigger className="h-7 text-xs w-36 bg-background border-border">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {a.config.options.map(o => (
                                      <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Activity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Recent Activity</h4>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={loadWaSettings}>Refresh</Button>
                  </div>
                  {waLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No messages sent yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {waLogs.slice(0, 20).map(log => (
                        <div key={log.id} className="flex items-center gap-2 px-3 py-2 glass-card rounded-lg">
                          <span className="text-base shrink-0">{ICON_MAP[log.automation_type] || "📨"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{log.client_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{log.automation_type?.replace(/_/g, " ")}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${log.status === "sent" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                              {log.status}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{log.sent_at ? new Date(log.sent_at).toLocaleDateString() : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        );
      })()}

        </>
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
              <h3 className="font-display font-bold text-base">Scan Lobbian's QR Code</h3>
              <p className="text-xs text-muted-foreground">
                Point your camera at the Lobbian's phone to verify check-in.
              </p>
            </div>
          </div>

          {!cameraActive ? (
            <div className="text-center">
              <div className="w-full aspect-[4/3] max-w-sm mx-auto rounded-xl bg-secondary/20 flex flex-col items-center justify-center mb-4 border-2 border-dashed border-border">
                <Camera className="h-12 w-12 text-muted-foreground mb-3" />
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
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
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
                Type the check-in code shown below the Lobbian's QR.
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
                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
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
                        {fmt12h(s.start_time)} - {fmt12h(s.end_time)}
                      </div>
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-400 text-[10px] shrink-0">
                      Pending
                    </Badge>
                  </div>
                ))}

                {/* Checked in */}
                {checkedIn.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                    <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                      <UserCheck className="h-4 w-4 text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{s.player_name}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{s.sport}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fmt12h(s.start_time)} - {fmt12h(s.end_time)}
                        {s.checkin_time && (
                          <span className="ml-2 text-brand-400">
                            Checked in at {new Date(s.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                : "border-brand-500/50 bg-brand-500/5"
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
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-brand-400" />
              <p className="font-display font-bold text-lg text-brand-400">Check-in Successful!</p>
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
