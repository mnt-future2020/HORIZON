import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { teamAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Search, X, Loader2, Trophy,
  User, Users, Crown, LogOut, ChevronRight, Swords
} from "lucide-react";
import { toast } from "sonner";

export default function TeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("discover");
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", sport: "football", description: "", max_players: 20
  });

  const sports = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table-tennis"];

  const loadTeams = useCallback(async () => {
    try {
      const res = await teamAPI.list({ search, sport: sportFilter });
      setTeams(res.data?.teams || []);
    } catch { toast.error("Failed to load teams"); }
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

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Team name is required"); return; }
    setCreating(true);
    try {
      const res = await teamAPI.create(form);
      toast.success("Team created! You're the captain.");
      setShowCreate(false);
      setForm({ name: "", sport: "football", description: "", max_players: 20 });
      loadTeams(); loadMyTeams();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create team");
    } finally { setCreating(false); }
  };

  const handleJoin = async (teamId) => {
    try {
      await teamAPI.join(teamId);
      toast.success("Joined team!");
      loadTeams(); loadMyTeams();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleLeave = async (teamId) => {
    try {
      await teamAPI.leave(teamId);
      toast.success("Left team");
      loadTeams(); loadMyTeams();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to leave"); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-display-sm font-black tracking-athletic">Teams</h1>
            <p className="text-muted-foreground text-sm mt-1">Build your squad, compete together</p>
          </div>
          <Button variant="athletic" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Team
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-lg p-1 w-fit">
          {[{ id: "discover", label: "Find Teams" }, { id: "my", label: "My Teams" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label} {t.id === "my" && myTeams.length > 0 && <span className="ml-1 text-xs opacity-70">({myTeams.length})</span>}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab === "discover" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/30 border-border/50" />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setSportFilter("")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!sportFilter ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                All
              </button>
              {sports.map(s => (
                <button key={s} onClick={() => setSportFilter(sportFilter === s ? "" : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${sportFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Team Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {(tab === "discover" ? teams : myTeams).map((t, idx) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.03 }}
                className="p-5 rounded-2xl border-2 border-border/50 bg-card hover:border-primary/30 transition-all">
                {/* Header */}
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {t.avatar_url ? (
                      <img src={mediaUrl(t.avatar_url)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <Shield className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm truncate">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description || `${t.sport} team`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="sport" className="text-[10px] capitalize">{t.sport}</Badge>
                      <span className="text-[10px] text-muted-foreground">{t.player_count || 0}/{t.max_players} players</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "W", value: t.wins || 0, color: "text-green-500" },
                    { label: "L", value: t.losses || 0, color: "text-red-500" },
                    { label: "D", value: t.draws || 0, color: "text-amber-500" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-secondary/30">
                      <div className={`font-display font-black text-lg ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground font-bold">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Captain */}
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-secondary/20">
                  <Crown className="h-3 w-3 text-amber-500" />
                  <span className="text-[11px] text-muted-foreground">Captain: <strong className="text-foreground">{t.captain_name}</strong></span>
                </div>

                {/* Player avatars */}
                <div className="flex items-center gap-1 mb-3">
                  {(t.players || []).slice(0, 6).map((p, i) => (
                    <div key={p.id} className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center border-2 border-card -ml-1 first:ml-0">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                  ))}
                  {(t.players || []).length > 6 && (
                    <span className="text-[10px] text-muted-foreground ml-1">+{t.players.length - 6} more</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {t.is_member ? (
                    <>
                      <Button variant="athletic" size="sm" className="flex-1" onClick={() => navigate(`/player-card/${user?.id}`)}>
                        <Swords className="h-3.5 w-3.5 mr-1.5" /> View Stats
                      </Button>
                      {!t.is_captain && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleLeave(t.id)}>
                          <LogOut className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="athletic-outline" size="sm" className="flex-1"
                      onClick={() => handleJoin(t.id)}
                      disabled={t.player_count >= t.max_players}>
                      {t.player_count >= t.max_players ? "Full" : <><Plus className="h-3.5 w-3.5 mr-1.5" /> Join Team</>}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {(tab === "discover" ? teams : myTeams).length === 0 && (
          <div className="text-center py-20">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-xl font-bold text-muted-foreground">
              {tab === "discover" ? "No teams found" : "You're not on any teams yet"}
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {tab === "discover" ? "Try a different search or create your own team!" : "Find a team or create your own!"}
            </p>
          </div>
        )}

        {/* Create Team Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-card border-2 border-border rounded-2xl p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-lg">Create Team</h2>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Team Name *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Thunder FC" className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sport *</Label>
                    <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                      {sports.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Tell players about your team..." rows={3}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Players</Label>
                    <Input type="number" value={form.max_players} onChange={e => setForm(p => ({ ...p, max_players: parseInt(e.target.value) || 20 }))}
                      min={2} max={50} className="mt-1 bg-background border-border" />
                  </div>
                  <Button variant="athletic" className="w-full" onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
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
