import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentAPI, venueAPI, liveAPI } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Plus,
  Users,
  Calendar,
  MapPin,
  Search,
  Filter,
  ChevronRight,
  Swords,
  Target,
  Medal,
  Crown,
  Eye,
  Radio,
  X,
  Zap,
} from "lucide-react";
import { TournamentsSkeleton } from "@/components/SkeletonLoader";

/* ─── Constants ─────────────────────────────────────────────────────── */
const SPORTS = [
  "football",
  "cricket",
  "badminton",
  "tennis",
  "basketball",
  "volleyball",
  "table_tennis",
];
const FORMATS = [
  { id: "knockout", label: "Knockout", desc: "Single elimination" },
  { id: "round_robin", label: "Round Robin", desc: "Everyone plays everyone" },
  { id: "league", label: "League", desc: "Points-based table" },
];
const STATUS_CONFIG = {
  registration: {
    label: "Open",
    cls: "bg-green-500/10 text-green-600 border border-green-500/20",
  },
  in_progress: {
    label: "Live",
    cls: "bg-red-500/10 text-red-500 border border-red-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-secondary/50 text-muted-foreground border border-border/40",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-destructive/10 text-destructive border border-destructive/20",
  },
};
const FORMAT_ICONS = { knockout: Swords, round_robin: Target, league: Medal };

/* ─── Bottom Sheet wrapper ───────────────────────────────────────────── */
function AppSheet({ open, onClose, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="
          !fixed !bottom-0 !top-auto !translate-y-0 !translate-x-0 !left-0 !right-0
          w-full max-w-full rounded-t-[24px] rounded-b-none bg-card p-0 shadow-2xl border-border/40
          max-h-[92vh] overflow-y-auto
          sm:!top-[50%] sm:!bottom-auto sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]
          sm:!w-full sm:!max-w-[520px] sm:!rounded-[24px]
        "
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <DialogTitle className="text-base font-bold text-foreground">
            {title}
          </DialogTitle>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">{children}</div>
        <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </DialogContent>
    </Dialog>
  );
}

/* ─── Form field wrapper ─────────────────────────────────────────────── */
function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

const inCls =
  "h-12 rounded-xl bg-secondary/20 border-border/40 px-4 text-sm font-medium focus-visible:ring-brand-600/30";
const selCls =
  "h-12 rounded-xl bg-secondary/20 border-border/40 px-4 text-sm font-medium";

/* ─── Tournament Card ────────────────────────────────────────────────── */
function TournamentCard({ t, user, onRegister, onClick, index }) {
  const FormatIcon = FORMAT_ICONS[t.format] || Swords;
  const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.completed;
  const isRegistered = t.participants?.some((p) => p.user_id === user?.id);
  const isOrganizer = t.organizer_id === user?.id;
  const isOpen = t.status === "registration";
  const isLive = t.status === "in_progress";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={onClick}
      className="bg-card rounded-[24px] border border-border/40 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-brand-600/30 active:scale-[0.99] transition-all duration-300 group"
      data-testid={`tournament-card-${t.id}`}
    >
      {/* Live pulse bar */}
      {isLive && (
        <div className="h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-transparent" />
      )}

      <div className="p-4">
        {/* Top: badges + chevron */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}
            >
              {isLive && <Radio className="w-2.5 h-2.5 inline mr-0.5" />}
              {statusCfg.label}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground capitalize flex items-center gap-1">
              <FormatIcon className="w-2.5 h-2.5" />
              {t.format?.replace("_", " ")}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground capitalize">
              {t.sport?.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOrganizer && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                <Crown className="w-3 h-3" /> Organizer
              </span>
            )}
            {isRegistered && !isOrganizer && (
              <span className="text-[10px] font-bold text-brand-600 bg-brand-600/10 px-2 py-0.5 rounded-full">
                Joined
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-brand-600 transition-colors" />
          </div>
        </div>

        {/* Tournament name */}
        <h3 className="text-base font-bold text-foreground leading-snug truncate">
          {t.name}
        </h3>
        {t.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {t.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 mt-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t.participant_count || 0}/{t.max_participants}
            </span>
            {t.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(t.start_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {t.venue_name && (
              <span className="flex items-center gap-1 truncate max-w-[140px]">
                <MapPin className="w-3 h-3 shrink-0" />
                {t.venue_name}
              </span>
            )}
          </div>
          {t.entry_fee > 0 ? (
            <span className="font-bold text-brand-600 shrink-0">
              ₹{t.entry_fee} entry
            </span>
          ) : (
            <span className="font-bold text-green-600 shrink-0">Free</span>
          )}
        </div>

        {t.prize_pool && (
          <div className="mt-3 py-2 px-3 bg-amber-500/10 rounded-lg flex items-center gap-2 text-xs text-amber-600 font-semibold border border-amber-500/20">
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{t.prize_pool}</span>
          </div>
        )}
      </div>

      {/* Register CTA — bottom bar */}
      {isOpen && !isRegistered && !isOrganizer && (
        <div className="border-t border-border/40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegister(t.id);
            }}
            data-testid={`register-btn-${t.id}`}
            className="w-full py-3 text-sm font-bold text-brand-600 hover:bg-brand-600/5 active:bg-brand-600/10 transition-colors"
          >
            Register Now →
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function TournamentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  useScrollRestoration("tournaments", !loading);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [filterSport, setFilterSport] = useState(
    searchParams.get("sport") || "",
  );
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "",
  );
  const [showMyOnly, setShowMyOnly] = useState(
    searchParams.get("mine") === "1",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [venues, setVenues] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sport: "football",
    format: "knockout",
    venue_id: "",
    max_participants: "16",
    entry_fee: "0",
    prize_pool: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    rules: "",
  });

  /* Data loading */
  useEffect(() => {
    loadTournaments();
  }, [filterSport, filterStatus, showMyOnly]); // eslint-disable-line
  useEffect(() => {
    const p = new URLSearchParams();
    if (searchQuery) p.set("q", searchQuery);
    if (filterSport) p.set("sport", filterSport);
    if (filterStatus) p.set("status", filterStatus);
    if (showMyOnly) p.set("mine", "1");
    setSearchParams(p, { replace: true });
  }, [searchQuery, filterSport, filterStatus, showMyOnly, setSearchParams]);

  useEffect(() => {
    const loadLive = async () => {
      try {
        const r = await liveAPI.getActive();
        setLiveMatches(r.data || []);
      } catch {}
    };
    loadLive();
    const iv = setInterval(loadLive, 10000);
    return () => clearInterval(iv);
  }, []);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterSport) params.sport = filterSport;
      if (filterStatus) params.status = filterStatus;
      if (showMyOnly) params.my_tournaments = true;
      const res = await tournamentAPI.list(params);
      setTournaments(res.data || []);
    } catch {
      toast.error("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = async () => {
    if (user?.role === "venue_owner") {
      try {
        const r = await venueAPI.getOwnerVenues();
        setVenues(r.data || []);
      } catch {}
    }
    setForm({
      name: "",
      description: "",
      sport: "football",
      format: "knockout",
      venue_id: "",
      max_participants: "16",
      entry_fee: "0",
      prize_pool: "",
      start_date: "",
      end_date: "",
      registration_deadline: "",
      rules: "",
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Tournament name is required");
    setCreating(true);
    try {
      const res = await tournamentAPI.create({
        ...form,
        max_participants: parseInt(form.max_participants, 10),
        entry_fee: parseInt(form.entry_fee, 10),
      });
      toast.success("Tournament created!");
      setCreateOpen(false);
      navigate(`/tournaments/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleRegister = async (id) => {
    try {
      await tournamentAPI.register(id);
      toast.success("Registered!");
      loadTournaments();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to register");
    }
  };

  const canCreate = ["venue_owner", "super_admin", "coach"].includes(
    user?.role,
  );
  const filtered = tournaments.filter(
    (t) =>
      !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const activeFilterCount = [
    filterSport,
    filterStatus,
    showMyOnly ? "1" : "",
  ].filter(Boolean).length;

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-8"
      data-testid="tournaments-page"
    >
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between pt-4 md:pt-8 pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Compete
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" aria-hidden />
            Tournaments
          </h1>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            data-testid="create-tournament-btn"
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-sm shadow-brand-600/20 active:scale-95 hover:bg-brand-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <Input
            placeholder="Search tournaments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            name="tournament-search"
            autoComplete="off"
            className="pl-10 h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
            data-testid="tournament-search"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
            activeFilterCount > 0
              ? "bg-brand-600/10 border-brand-600/30 text-brand-600"
              : "bg-card border-border/40 text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Filters"
        >
          <Filter className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Collapsible filter panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row gap-2 mb-4 pb-1">
              <Select
                value={filterSport}
                onValueChange={(v) => setFilterSport(v === "all" ? "" : v)}
              >
                <SelectTrigger
                  className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm flex-1 sm:max-w-[160px]"
                  data-testid="sport-filter"
                >
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-card">
                  <SelectItem value="all">All Sports</SelectItem>
                  {SPORTS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm flex-1 sm:max-w-[160px]">
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-card">
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="registration">Open</SelectItem>
                  <SelectItem value="in_progress">Live</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setShowMyOnly((v) => !v)}
                className={`h-11 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  showMyOnly
                    ? "bg-brand-600/10 border-brand-600/30 text-brand-600"
                    : "bg-card border-border/40 text-muted-foreground"
                }`}
              >
                My Tournaments
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Now strip ── */}
      {liveMatches.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
              Live Now
            </p>
          </div>
          <div
            className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {liveMatches.map((lm) => (
              <div
                key={lm.id}
                onClick={() => navigate(`/tournaments/${lm.tournament_id}`)}
                className="shrink-0 w-[260px] bg-red-500/5 border border-red-500/20 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-muted-foreground truncate flex-1">
                    {lm.tournament_name}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    {lm.spectator_count || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate flex-1">
                    {lm.home?.name}
                  </p>
                  <p className="text-xl font-black text-red-500 tabular-nums shrink-0 px-2">
                    {lm.home?.score} — {lm.away?.score}
                  </p>
                  <p className="text-sm font-semibold truncate flex-1 text-right">
                    {lm.away?.name}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-muted-foreground/70">
                    {lm.match_label}
                  </p>
                  <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5" />
                    {lm.period_label || lm.sport}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tournament list ── */}
      {loading ? (
        <TournamentsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border/40 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-muted-foreground/20" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground/70">
            No tournaments found
          </p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Try changing your filters
          </p>
          {canCreate && (
            <button
              onClick={openCreate}
              className="mt-5 flex items-center gap-1.5 h-10 px-5 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Tournament
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((t, idx) => (
              <TournamentCard
                key={t.id}
                t={t}
                user={user}
                index={idx}
                onRegister={handleRegister}
                onClick={() => navigate(`/tournaments/${t.id}`)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create Tournament Sheet ── */}
      <AppSheet
        open={createOpen}
        onClose={setCreateOpen}
        title="Create Tournament"
      >
        <FormField label="Tournament Name *">
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Weekend Knockout Cup"
            className={inCls}
            data-testid="tournament-name-input"
          />
        </FormField>

        <FormField label="Description">
          <Input
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Brief description"
            className={inCls}
          />
        </FormField>

        {/* Format picker — native segmented style */}
        <FormField label="Format">
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATS.map((f) => {
              const FIcon = FORMAT_ICONS[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setForm((p) => ({ ...p, format: f.id }))}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all ${
                    form.format === f.id
                      ? "bg-brand-600/10 border-brand-600/40 text-brand-600"
                      : "bg-secondary/20 border-border/40 text-muted-foreground"
                  }`}
                >
                  <FIcon className="w-4 h-4" />
                  <span className="text-[11px] font-bold">{f.label}</span>
                </button>
              );
            })}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Sport">
            <Select
              value={form.sport}
              onValueChange={(v) => setForm((p) => ({ ...p, sport: v }))}
            >
              <SelectTrigger
                className={selCls}
                data-testid="tournament-sport-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 bg-card">
                {SPORTS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Max Players">
            <Input
              type="number"
              value={form.max_participants}
              onChange={(e) =>
                setForm((p) => ({ ...p, max_participants: e.target.value }))
              }
              className={inCls}
              data-testid="tournament-max-input"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Entry Fee (₹)">
            <Input
              type="number"
              value={form.entry_fee}
              onChange={(e) =>
                setForm((p) => ({ ...p, entry_fee: e.target.value }))
              }
              placeholder="0 = Free"
              className={inCls}
            />
          </FormField>
          <FormField label="Prize Pool">
            <Input
              value={form.prize_pool}
              onChange={(e) =>
                setForm((p) => ({ ...p, prize_pool: e.target.value }))
              }
              placeholder="₹10,000 + Trophy"
              className={inCls}
            />
          </FormField>
        </div>

        {venues.length > 0 && (
          <FormField label="Venue (optional)">
            <Select
              value={form.venue_id}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, venue_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger className={selCls}>
                <SelectValue placeholder="No venue" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 bg-card">
                <SelectItem value="none">No venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Date">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, start_date: e.target.value }))
              }
              className={inCls}
            />
          </FormField>
          <FormField label="End Date">
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, end_date: e.target.value }))
              }
              className={inCls}
            />
          </FormField>
        </div>

        <FormField label="Registration Deadline">
          <Input
            type="date"
            value={form.registration_deadline}
            onChange={(e) =>
              setForm((p) => ({ ...p, registration_deadline: e.target.value }))
            }
            className={inCls}
          />
        </FormField>

        <FormField label="Rules">
          <textarea
            value={form.rules}
            onChange={(e) => setForm((p) => ({ ...p, rules: e.target.value }))}
            placeholder="Tournament rules..."
            rows={3}
            className="w-full rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600/30 font-medium"
          />
        </FormField>

        <button
          onClick={handleCreate}
          disabled={creating}
          data-testid="submit-tournament-btn"
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create Tournament"}
        </button>
      </AppSheet>
    </div>
  );
}
