import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { groupAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Lock, Globe, X, Loader2,
  MessageCircle, ChevronRight, Crown, LogOut, Trash2, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function CommunitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("discover");
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", group_type: "community", sport: "", is_private: false, max_members: 500
  });
  const [recGroups, setRecGroups] = useState([]);

  const sports = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table-tennis", "swimming"];

  const loadGroups = useCallback(async () => {
    try {
      const res = await groupAPI.list({ search, sport: sportFilter });
      setGroups(res.data?.groups || []);
    } catch { toast.error("Failed to load groups"); }
  }, [search, sportFilter]);

  const loadMyGroups = useCallback(async () => {
    try {
      const res = await groupAPI.myGroups();
      setMyGroups(res.data || []);
    } catch {}
  }, []);

  const loadRecGroups = useCallback(async () => {
    try {
      const res = await recommendationAPI.groups(6);
      setRecGroups(res.data?.groups || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadGroups(), loadMyGroups(), loadRecGroups()]).finally(() => setLoading(false));
  }, [loadGroups, loadMyGroups, loadRecGroups]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Group name is required"); return; }
    setCreating(true);
    try {
      const res = await groupAPI.create(form);
      toast.success("Group created!");
      setShowCreate(false);
      setForm({ name: "", description: "", group_type: "community", sport: "", is_private: false, max_members: 500 });
      navigate(`/communities/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create group");
    } finally { setCreating(false); }
  };

  const handleJoin = async (groupId) => {
    try {
      await groupAPI.join(groupId);
      toast.success("Joined group!");
      loadGroups(); loadMyGroups();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleLeave = async (groupId) => {
    try {
      await groupAPI.leave(groupId);
      toast.success("Left group");
      loadGroups(); loadMyGroups();
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
            <h1 className="font-display text-display-sm font-black tracking-athletic">Communities</h1>
            <p className="text-muted-foreground text-sm mt-1">Join sports groups, clubs, and communities</p>
          </div>
          <Button variant="athletic" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Group
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-lg p-1 w-fit">
          {[{ id: "discover", label: "Discover" }, { id: "my", label: "My Groups" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label} {t.id === "my" && myGroups.length > 0 && <span className="ml-1 text-xs opacity-70">({myGroups.length})</span>}
            </button>
          ))}
        </div>

        {/* Search + Filters (Discover tab) */}
        {tab === "discover" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)}
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

        {/* Recommended Groups (Algorithm-Powered) */}
        {tab === "discover" && recGroups.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Recommended for You</span>
              </div>
              <span className="text-[9px] text-muted-foreground/60 font-mono">AI-powered</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {recGroups.map((g) => (
                <div key={g.id} className="flex-shrink-0 w-56 p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/communities/${g.id}`)}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {g.avatar_url ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        : <Users className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs truncate">{g.name}</h4>
                      <span className="text-[10px] text-muted-foreground">{g.member_count || 0} members</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {g.sport && <Badge variant="sport" className="text-[9px]">{g.sport}</Badge>}
                    <Badge variant="outline" className="text-[9px] capitalize">
                      {g.rec_reason === "friends_are_in" ? "Friends here" :
                       g.rec_reason === "matches_sport" ? "Your sport" : "Popular"}
                    </Badge>
                  </div>
                  {g.friends_count > 0 && (
                    <div className="text-[10px] text-primary font-bold">{g.friends_count} friend{g.friends_count > 1 ? "s" : ""} in this group</div>
                  )}
                  <Button variant="athletic" size="sm" className="w-full h-7 text-[10px] mt-2" onClick={(e) => { e.stopPropagation(); handleJoin(g.id); }}>
                    <Plus className="h-3 w-3 mr-1" /> Join
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Group Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {(tab === "discover" ? groups : myGroups).map((g, idx) => (
              <motion.div key={g.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.03 }}
                className="p-5 rounded-2xl border-2 border-border/50 bg-card hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate(`/communities/${g.id}`)}>
                {/* Cover / Avatar */}
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {g.avatar_url ? (
                      <img src={mediaUrl(g.avatar_url)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <Users className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm truncate group-hover:text-primary transition-colors">{g.name}</h3>
                      {g.is_private ? <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description || "No description"}</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="sport" className="text-[10px]">{g.group_type}</Badge>
                  {g.sport && <Badge variant="outline" className="text-[10px] capitalize">{g.sport}</Badge>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{g.member_count || 0} members</span>
                </div>

                {/* Last message preview */}
                {g.last_message && (
                  <div className="text-[11px] text-muted-foreground truncate mb-3 px-2 py-1.5 rounded-lg bg-secondary/30">
                    <span className="font-semibold">{g.last_message_by}:</span> {g.last_message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {g.is_member ? (
                    <>
                      <Button variant="athletic" size="sm" className="flex-1" onClick={() => navigate(`/communities/${g.id}`)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Open Chat
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleLeave(g.id)}>
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="athletic-outline" size="sm" className="flex-1" onClick={() => handleJoin(g.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Join
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {(tab === "discover" ? groups : myGroups).length === 0 && (
          <div className="text-center py-20">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-xl font-bold text-muted-foreground">
              {tab === "discover" ? "No groups found" : "You haven't joined any groups yet"}
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {tab === "discover" ? "Try a different search or create your own!" : "Discover and join communities above!"}
            </p>
          </div>
        )}

        {/* Create Group Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-card border-2 border-border rounded-2xl p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-lg">Create Group</h2>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Group Name *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Chennai Football Club" className="mt-1 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="What's this group about?" rows={3}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <div className="flex gap-1 mt-1">
                        {["community", "club"].map(t => (
                          <button key={t} onClick={() => setForm(p => ({ ...p, group_type: t }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${form.group_type === t ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Sport</Label>
                      <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                        <option value="">Any Sport</option>
                        {sports.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_private} onChange={e => setForm(p => ({ ...p, is_private: e.target.checked }))}
                        className="rounded border-border" />
                      <span className="text-sm">Private group (invite only)</span>
                    </label>
                  </div>
                  <Button variant="athletic" className="w-full" onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Group
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
