import { useState, useEffect, useCallback } from "react";
import { groupAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Lock, Globe, X, Loader2,
  Sparkles, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

const SPORT_EMOJI = {
  football: "\u26bd", cricket: "\ud83c\udfcf", badminton: "\ud83c\udff8", tennis: "\ud83c\udfbe",
  basketball: "\ud83c\udfc0", volleyball: "\ud83c\udfd0", "table-tennis": "\ud83c\udfd3", swimming: "\ud83c\udfca",
};

export default function GroupDiscoveryView({ onOpenGroup, onBack }) {
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState([]);
  const [recGroups, setRecGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create group modal state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", group_type: "community", sport: "", is_private: false, max_members: 500,
  });

  const loadGroups = useCallback(async () => {
    try {
      const res = await groupAPI.list({ search });
      setGroups(res.data?.groups || []);
    } catch { toast.error("Failed to load groups"); }
  }, [search]);

  const loadRecGroups = useCallback(async () => {
    try {
      const res = await recommendationAPI.groups(6);
      setRecGroups(res.data?.groups || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadGroups(), loadRecGroups()]).finally(() => setLoading(false));
  }, [loadGroups, loadRecGroups]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Group name is required"); return; }
    setCreating(true);
    try {
      const res = await groupAPI.create(form);
      toast.success("Group created!");
      setShowCreate(false);
      setForm({ name: "", description: "", group_type: "community", sport: "", is_private: false, max_members: 500 });
      onOpenGroup({ id: res.data.id, type: "group" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create group");
    } finally { setCreating(false); }
  };

  const handleJoin = async (groupId, e) => {
    e?.stopPropagation();
    try {
      await groupAPI.join(groupId);
      toast.success("Joined group!");
      loadGroups();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-secondary/50 transition-colors lg:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="admin-page-title">Discover Groups</h1>
                <p className="text-muted-foreground text-sm mt-1">Find communities, connect with players</p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4 mr-1.5" /> Create Group
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search groups..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary/20 border-border/40 rounded-xl" />
          </div>

          {/* AI Recommendations — hidden when searching */}
          {!search && recGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-600/20 to-purple-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-foreground/70">Recommended for you</span>
                <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono tracking-wider">AI-powered</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recGroups.map((g, i) => (
                  <motion.div key={g.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="relative rounded-[22px] bg-card border border-border/40 hover:border-brand-600/30 shadow-sm hover:shadow-lg hover:shadow-brand-600/5 transition-all duration-300 cursor-pointer overflow-hidden group/card"
                    onClick={() => onOpenGroup({ id: g.id, type: "group" })}>
                    {/* Gradient accent top bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-400 opacity-60 group-hover/card:opacity-100 transition-opacity" />
                    <div className="p-4">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-600/15 to-brand-600/5 border border-border/40 flex items-center justify-center overflow-hidden shrink-0 group-hover/card:border-brand-600/30 transition-colors">
                          {g.avatar_url
                            ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-12 w-12 object-cover" />
                            : <Users className="h-6 w-6 text-brand-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[13px] truncate group-hover/card:text-brand-600 transition-colors">{g.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {g.member_count || 0} members
                            {g.friends_count > 0 && <span className="text-brand-600 font-medium"> · {g.friends_count} friends</span>}
                          </p>
                        </div>
                      </div>
                      {/* Tags */}
                      <div className="flex gap-1.5 mb-3 flex-wrap">
                        {g.sport && (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-600/10 text-brand-600 font-semibold capitalize">
                            {SPORT_EMOJI[g.sport]} {g.sport}
                          </span>
                        )}
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/60 text-muted-foreground font-medium">
                          {g.rec_reason === "friends_are_in" ? "Friends here" :
                           g.rec_reason === "matches_sport" ? "Your sport" : "Popular"}
                        </span>
                      </div>
                      {/* Join button */}
                      <Button className="w-full h-9 text-[11px] font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl active:scale-[0.97] transition-all shadow-md shadow-brand-600/20 border-t border-white/10"
                        onClick={(e) => { e.stopPropagation(); handleJoin(g.id, e); }}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Join Group
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {search && groups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="admin-section-label">Results ({groups.length})</span>
              </div>
              <div className="space-y-2">
                {groups.map((g, idx) => (
                  <motion.div key={g.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-border/30 bg-card hover:border-brand-600/25 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => onOpenGroup({ id: g.id, type: "group" })}>
                    <div className="h-11 w-11 rounded-xl bg-brand-600/10 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                      {g.avatar_url
                        ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-11 w-11 object-cover" />
                        : <Users className="h-5 w-5 text-brand-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm truncate">{g.name}</h3>
                        {g.is_private ? <Lock className="h-3 w-3 text-muted-foreground shrink-0" /> : <Globe className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" />{g.member_count || 0}</span>
                        {g.sport && <span className="text-[10px] text-muted-foreground capitalize">{SPORT_EMOJI[g.sport]} {g.sport}</span>}
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      {g.is_member ? (
                        <Button size="sm" className="h-8 px-3 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-lg text-[10px]"
                          onClick={() => onOpenGroup({ id: g.id, type: "group" })}>
                          Open
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 px-3 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-lg text-[10px]"
                          onClick={(e) => handleJoin(g.id, e)}>
                          {g.is_private ? "Request" : "Join"}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* No results when searching */}
          {search && groups.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="admin-heading text-muted-foreground">No groups found</h3>
              <p className="text-sm text-muted-foreground/70 mt-2">Try a different search or create your own group!</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-[2px] p-4"
            onClick={() => setShowCreate(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-card border border-border/40 rounded-[28px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="border-b border-border/40 px-7 pt-7 pb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-brand-600/10">
                    <Users className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="admin-heading">Create Group</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Build your community</p>
                  </div>
                </div>
                <button onClick={() => setShowCreate(false)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-7 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="admin-section-label">Group Name *</label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Chennai Football Club"
                    className="h-11 rounded-xl bg-secondary/20 border-border/40 px-4" />
                </div>
                <div className="space-y-1.5">
                  <label className="admin-section-label">Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="What's this group about?" rows={3}
                    className="w-full rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="admin-section-label">Group Type</label>
                    <div className="flex gap-2">
                      {["community", "club"].map(t => (
                        <button key={t} onClick={() => setForm(p => ({ ...p, group_type: t }))}
                          className={`flex-1 py-2 rounded-full admin-btn capitalize transition-all active:scale-95 text-xs ${
                            form.group_type === t
                              ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                              : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="admin-section-label">Sport</label>
                    <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                      className="w-full h-11 rounded-xl border border-border/40 bg-secondary/20 px-3 text-sm">
                      <option value="">Any Sport</option>
                      {Object.keys(SPORT_EMOJI).map(s => <option key={s} value={s} className="capitalize">{SPORT_EMOJI[s]} {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-border/20">
                  <div>
                    <p className="text-sm font-medium">Private Group</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Members must request to join</p>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, is_private: !p.is_private }))}
                    className={`relative w-11 h-6 rounded-full transition-all ${form.is_private ? "bg-brand-600" : "bg-secondary"}`}>
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${form.is_private ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="admin-section-label">Max Members</label>
                  <Input type="number" min={2} max={5000} value={form.max_members}
                    onChange={e => setForm(p => ({ ...p, max_members: parseInt(e.target.value) || 500 }))}
                    className="h-11 rounded-xl bg-secondary/20 border-border/40 px-4" />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/40 px-7 py-4 flex gap-3">
                <Button variant="outline" className="flex-1 admin-btn rounded-xl h-11 border-border/40"
                  onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-11 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                  onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Group
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
