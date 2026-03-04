import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentAPI, venueAPI, liveAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";

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
  { id: "knockout", label: "Knockout", desc: "Single elimination bracket" },
  { id: "round_robin", label: "Round Robin", desc: "Everyone plays everyone" },
  { id: "league", label: "League", desc: "Points-based league table" },
];
const STATUS_COLORS = {
  registration: "bg-brand-500/15 text-brand-400",
  in_progress: "bg-sky-500/15 text-sky-400",
  completed: "bg-brand-500/15 text-brand-400",
  cancelled: "bg-destructive/15 text-destructive",
};
const STATUS_LABELS = {
  registration: "Open",
  in_progress: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};
const FORMAT_ICONS = { knockout: Swords, round_robin: Target, league: Medal };

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

  useEffect(() => {
    loadTournaments();
  }, [filterSport, filterStatus, showMyOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filter state to URL so browser back/forward restores filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (filterSport) params.set("sport", filterSport);
    if (filterStatus) params.set("status", filterStatus);
    if (showMyOnly) params.set("mine", "1");
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterSport, filterStatus, showMyOnly, setSearchParams]);

  useEffect(() => {
    const loadLive = async () => {
      try {
        const res = await liveAPI.getActive();
        setLiveMatches(res.data || []);
      } catch {}
    };
    loadLive();
    const interval = setInterval(loadLive, 10000);
    return () => clearInterval(interval);
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
        const res = await venueAPI.getOwnerVenues();
        setVenues(res.data || []);
      } catch {
        /* ignore */
      }
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
    if (!form.name.trim()) return toast.error("Tournament name required");
    setCreating(true);
    try {
      const payload = {
        ...form,
        max_participants: parseInt(form.max_participants, 10),
        entry_fee: parseInt(form.entry_fee, 10),
      };
      const res = await tournamentAPI.create(payload);
      toast.success("Tournament created!");
      setCreateOpen(false);
      navigate(`/tournaments/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleRegister = async (e, tournamentId) => {
    e.stopPropagation();
    try {
      await tournamentAPI.register(tournamentId);
      toast.success("Registered!");
      loadTournaments();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to register");
    }
  };

  const filtered = tournaments.filter(
    (t) =>
      !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const canCreate =
    user?.role === "venue_owner" ||
    user?.role === "super_admin" ||
    user?.role === "coach";

  return (
    <div
      className=" mx-auto px-4 sm:px-4 md:px-6 py-5 sm:py-6 pb-16 md:pb-8"
      data-testid="tournaments-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Compete
          </span>
          <h1 className="admin-page-title flex items-center gap-2 [text-wrap:balance]">
            <Trophy className="h-6 w-6 text-amber-400" aria-hidden="true" />{" "}
            Tournaments
          </h1>
        </div>
        {canCreate && (
          <Button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-11 px-4 w-full sm:w-auto"
            data-testid="create-tournament-btn"
          >
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-2 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tournaments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            name="tournament-search"
            autoComplete="off"
            className="pl-9 bg-secondary/20 border-border/40 rounded-xl h-11 text-sm"
            data-testid="tournament-search"
          />
        </div>
        <Select
          value={filterSport}
          onValueChange={(v) => setFilterSport(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[130px] h-11 bg-secondary/20 border-border/40 rounded-xl text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger className="w-full sm:w-[130px] h-11 bg-secondary/20 border-border/40 rounded-xl text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="registration">Open</SelectItem>
            <SelectItem value="in_progress">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setShowMyOnly(!showMyOnly)}
          className={`px-3 h-11 rounded-full text-xs admin-btn transition-all border focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 ${showMyOnly ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
        >
          My Tournaments
        </button>
      </div>

      {/* Live Now */}
      {liveMatches.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              Live Now
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map((lm) => (
              <div
                key={lm.id}
                onClick={() => navigate(`/tournaments/${lm.tournament_id}`)}
                className="p-4 rounded-[28px] border border-red-500/20 bg-red-500/5 shadow-sm cursor-pointer hover:border-red-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {lm.tournament_name}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" /> {lm.spectator_count || 0}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1">
                    {lm.home?.name}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-brand-600 mx-1.5 sm:mx-3 tabular-nums">
                    {lm.home?.score} — {lm.away?.score}
                  </span>
                  <span className="text-sm font-medium truncate flex-1 text-right">
                    {lm.away?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {lm.match_label}
                  </span>
                  <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">
                    <Radio className="w-2.5 h-2.5 mr-1" />{" "}
                    {lm.period_label || lm.sport}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tournament Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No tournaments found</p>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs h-10"
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Tournament
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((t, idx) => {
              const FormatIcon = FORMAT_ICONS[t.format] || Swords;
              const isRegistered = t.participants?.some(
                (p) => p.user_id === user?.id,
              );
              const isOrganizer = t.organizer_id === user?.id;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/tournaments/${t.id}`)}
                  className="rounded-[28px] bg-card border border-border/40 shadow-sm p-4 sm:p-5 cursor-pointer hover:border-brand-600/40 transition-all group"
                  data-testid={`tournament-card-${t.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge
                          className={`text-[10px] font-bold ${STATUS_COLORS[t.status] || ""}`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize gap-1"
                        >
                          <FormatIcon className="h-2.5 w-2.5" />
                          {t.format?.replace("_", " ")}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize"
                        >
                          {t.sport?.replace("_", " ")}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-base sm:text-lg leading-tight truncate">
                        {t.name}
                      </h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {t.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs sm:text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {t.participant_count || 0}/{t.max_participants}
                        </span>
                        {t.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(t.start_date).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        )}
                        {t.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {t.venue_name}
                          </span>
                        )}
                        {t.entry_fee > 0 && (
                          <span className="font-bold text-brand-600">
                            Entry: ₹{t.entry_fee}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {t.status === "registration" &&
                        !isRegistered &&
                        !isOrganizer && (
                          <Button
                            size="sm"
                            className="bg-brand-600 hover:bg-brand-500 text-white admin-btn h-10 px-4 rounded-lg shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                            onClick={(e) => handleRegister(e, t.id)}
                            data-testid={`register-btn-${t.id}`}
                          >
                            Register
                          </Button>
                        )}
                      {isRegistered && (
                        <Badge className="bg-brand-600/15 text-brand-600 text-[10px]">
                          Registered
                        </Badge>
                      )}
                      {isOrganizer && (
                        <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">
                          <Crown className="h-2.5 w-2.5 mr-0.5" /> Organizer
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Tournament Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border/40 max-w-[95vw] sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="admin-heading flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" /> Create Tournament
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Tournament Name *
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Weekend Knockout Cup"
                className="mt-1 bg-background border-border h-11"
                data-testid="tournament-name-input"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Description
              </Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Brief description"
                className="mt-1 bg-background border-border h-11"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Sport</Label>
                <Select
                  value={form.sport}
                  onValueChange={(v) => setForm((p) => ({ ...p, sport: v }))}
                >
                  <SelectTrigger
                    className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
                    data-testid="tournament-sport-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm((p) => ({ ...p, format: v }))}
                >
                  <SelectTrigger
                    className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
                    data-testid="tournament-format-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Max Participants
                </Label>
                <Input
                  type="number"
                  value={form.max_participants}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, max_participants: e.target.value }))
                  }
                  className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
                  data-testid="tournament-max-input"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Entry Fee (₹)
                </Label>
                <Input
                  type="number"
                  value={form.entry_fee}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, entry_fee: e.target.value }))
                  }
                  placeholder="0 = Free"
                  className="mt-1 bg-background border-border h-11"
                />
              </div>
            </div>
            {venues.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Venue (optional)
                </Label>
                <Select
                  value={form.venue_id}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, venue_id: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No venue</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">
                Prize Pool
              </Label>
              <Input
                value={form.prize_pool}
                onChange={(e) =>
                  setForm((p) => ({ ...p, prize_pool: e.target.value }))
                }
                placeholder="e.g. ₹10,000 + Trophy"
                className="mt-1 bg-background border-border h-11"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, start_date: e.target.value }))
                  }
                  className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  End Date
                </Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, end_date: e.target.value }))
                  }
                  className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Registration Deadline
              </Label>
              <Input
                type="date"
                value={form.registration_deadline}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    registration_deadline: e.target.value,
                  }))
                }
                className="mt-1 bg-secondary/20 border-border/40 rounded-xl h-11"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rules</Label>
              <textarea
                value={form.rules}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rules: e.target.value }))
                }
                placeholder="Tournament rules..."
                rows={3}
                className="mt-1 w-full rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600/50"
              />
            </div>
            <Button
              className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-12"
              onClick={handleCreate}
              disabled={creating}
              data-testid="submit-tournament-btn"
            >
              {creating ? "Creating..." : "Create Tournament"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
