import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { teamAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Plus,
  Search,
  X,
  Loader2,
  User,
  Users,
  Crown,
  LogOut,
  Swords,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { TeamsSkeleton } from "@/components/SkeletonLoader";
import { getSportIcon } from "@/lib/venue-constants";

/* ─── URL param utils (zero re-renders, no useSearchParams) ──── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export default function TeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => getInitParam("tab") || "discover");
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => getInitParam("q") || "");
  const [sportFilter, setSportFilter] = useState(() => getInitParam("sport") || "");
  const [sortOrder, setSortOrder] = useState(() => getInitParam("sort") || "newest");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sport: "football",
    description: "",
    max_players: 20,
  });

  const sports = [
    "football",
    "cricket",
    "badminton",
    "tennis",
    "basketball",
    "volleyball",
    "table-tennis",
  ];

  const loadTeams = useCallback(async () => {
    try {
      const res = await teamAPI.list({ search, sport: sportFilter });
      setTeams(res.data?.teams || []);
    } catch {
      toast.error("Failed to load teams");
    }
  }, [search, sportFilter]);

  const loadMyTeams = useCallback(async () => {
    try {
      const res = await teamAPI.myTeams();
      setMyTeams(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadTeams(), loadMyTeams()]).finally(() => setLoading(false));
  }, [loadTeams, loadMyTeams]);

  // Sync filter state to URL — replaceParams uses history.replaceState (no React re-render cascade)
  useEffect(() => {
    replaceParams({
      tab: tab !== "discover" ? tab : null,
      q: search || null,
      sport: sportFilter || null,
      sort: sortOrder !== "newest" ? sortOrder : null,
    });
  }, [tab, search, sportFilter, sortOrder]);

  const sortedTeams = [...teams].sort((a, b) => {
    const aT = new Date(a.created_at || 0).getTime();
    const bT = new Date(b.created_at || 0).getTime();
    return sortOrder === "newest" ? bT - aT : aT - bT;
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    setCreating(true);
    try {
      await teamAPI.create(form);
      toast.success("Team created! You're the captain.");
      setShowCreate(false);
      setForm({
        name: "",
        sport: "football",
        description: "",
        max_players: 20,
      });
      loadTeams();
      loadMyTeams();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (teamId) => {
    try {
      await teamAPI.join(teamId);
      toast.success("Joined team!");
      loadTeams();
      loadMyTeams();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to join");
    }
  };

  const handleLeave = async (teamId) => {
    try {
      await teamAPI.leave(teamId);
      toast.success("Left team");
      loadTeams();
      loadMyTeams();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to leave");
    }
  };

  if (loading) {
    return <TeamsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className=" mx-auto px-4 sm:px-4 py-5 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
        >
          <div>
            <h1 className="admin-page-title [text-wrap:balance]">Teams</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Build your squad, compete together
            </p>
          </div>
          <Button
            className="w-full sm:w-auto h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create Team
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-[28px] p-1 w-full sm:w-fit overflow-x-auto">
          {[
            { id: "discover", label: "Find Teams" },
            { id: "my", label: "My Teams" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 sm:px-4 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}{" "}
              {t.id === "my" && myTeams.length > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({myTeams.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab === "discover" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                name="team-search"
                autoComplete="off"
                className="pl-9 h-11 bg-secondary/20 border-border/40 rounded-xl"
              />
            </div>
            <button
              onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
              className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                sortOrder === "oldest"
                  ? "bg-brand-600/10 border-brand-600/30 text-brand-600"
                  : "bg-card border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
              }`}
              title={sortOrder === "newest" ? "Newest first" : "Oldest first"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
            <div className="flex gap-1 flex-wrap overflow-x-auto pb-1">
              <button
                onClick={() => setSportFilter("")}
                className={`px-3.5 py-2.5 min-h-[40px] rounded-full text-xs admin-btn transition-all focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 ${!sportFilter ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"}`}
              >
                All
              </button>
              {sports.map((s) => {
                const SI = getSportIcon(s);
                return (
                  <button
                    key={s}
                    onClick={() => setSportFilter(sportFilter === s ? "" : s)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-full text-xs admin-btn capitalize transition-all focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 ${sportFilter === s ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    <SI className="h-3.5 w-3.5 shrink-0" />
                    {s.replace("-", " ")}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Team Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {(tab === "discover" ? sortedTeams : myTeams).map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.03 }}
                className="p-4 sm:p-5 rounded-[28px] border border-border/40 bg-card shadow-sm hover:shadow-md hover:border-brand-600/30 transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
                    {t.avatar_url ? (
                      <img
                        src={mediaUrl(t.avatar_url)}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <Shield className="h-7 w-7 text-brand-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="admin-name text-sm sm:text-base truncate">{t.name}</h3>
                    <p className="admin-secondary text-xs sm:text-sm mt-0.5 line-clamp-1">
                      {t.description || `${t.sport} team`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="sport" className="text-xs capitalize">
                        {t.sport}
                      </Badge>
                      <span className="admin-secondary text-xs">
                        {t.player_count || 0}/{t.max_players} Lobbians
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3">
                  {[
                    { label: "W", value: t.wins || 0, color: "text-green-500" },
                    { label: "L", value: t.losses || 0, color: "text-red-500" },
                    {
                      label: "D",
                      value: t.draws || 0,
                      color: "text-amber-500",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="text-center p-2 rounded-xl bg-secondary/30"
                    >
                      <div
                        className={`font-bold text-lg ${s.color}`}
                      >
                        {s.value}
                      </div>
                      <div className="text-xs text-muted-foreground admin-btn">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Captain */}
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-xl bg-secondary/20">
                  <Crown className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-muted-foreground">
                    Captain:{" "}
                    <strong className="text-foreground">
                      {t.captain_name}
                    </strong>
                  </span>
                </div>

                {/* Player avatars */}
                <div className="flex items-center gap-1 mb-3">
                  {(t.players || []).slice(0, 6).map((p, i) => (
                    <div
                      key={p.id}
                      className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center border-2 border-card -ml-1 first:ml-0"
                    >
                      <User className="h-3 w-3 text-brand-600" />
                    </div>
                  ))}
                  {(t.players || []).length > 6 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      +{t.players.length - 6} more
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {t.is_member ? (
                    <>
                      <Button
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-11 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                        size="sm"
                        onClick={() => navigate(`/player-card/${user?.id}`)}
                      >
                        <Swords className="h-3.5 w-3.5 mr-1.5" /> View Stats
                      </Button>
                      {!t.is_captain && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Leave team"
                          className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive"
                          onClick={() => {
                            if (window.confirm("Leave this team?"))
                              handleLeave(t.id);
                          }}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      className="flex-1 bg-transparent border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white admin-btn rounded-xl h-11 text-xs active:scale-[0.98] transition-all"
                      size="sm"
                      onClick={() => handleJoin(t.id)}
                      disabled={t.player_count >= t.max_players}
                    >
                      {t.player_count >= t.max_players ? (
                        "Full"
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Join Team
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {(tab === "discover" ? sortedTeams : myTeams).length === 0 && (
          <div className="text-center py-12 px-4 sm:py-20">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="admin-heading text-muted-foreground">
              {tab === "discover"
                ? "No teams found"
                : "You're not on any teams yet"}
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {tab === "discover"
                ? "Try a different search or create your own team!"
                : "Find a team or create your own!"}
            </p>
          </div>
        )}

        {/* Create Team Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[95vw] sm:max-w-lg bg-card border border-border/40 rounded-[28px] p-4 sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="admin-heading">Create Team</h2>
                  <button
                    onClick={() => setShowCreate(false)}
                    aria-label="Close"
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">
                      Team Name *
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g. Thunder FC"
                      className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">
                      Sport *
                    </Label>
                    <Select
                      value={form.sport}
                      onValueChange={(val) =>
                        setForm((p) => ({ ...p, sport: val }))
                      }
                    >
                      <SelectTrigger className="mt-1 h-11 rounded-xl border-border/40 bg-secondary/20 focus:ring-brand-600/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sports.map((s) => (
                          <SelectItem
                            key={s}
                            value={s}
                            className="capitalize focus:bg-brand-600 focus:text-white"
                          >
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">
                      Description
                    </Label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Tell Lobbians about your team..."
                      rows={3}
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600/50"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">
                      Max Lobbians
                    </Label>
                    <Input
                      type="number"
                      value={form.max_players}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          max_players: parseInt(e.target.value) || 20,
                        }))
                      }
                      min={2}
                      max={50}
                      className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl"
                    />
                  </div>
                  <Button
                    className="w-full h-12 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Create Team
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
