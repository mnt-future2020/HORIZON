import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { groupAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Lock, Globe, X, Loader2,
  MessageCircle, Crown, LogOut, Zap, Sparkles,
  ChevronRight, Bell, TrendingUp, Hash
} from "lucide-react";
import { toast } from "sonner";

const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table-tennis", "swimming"];

const SPORT_EMOJI = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  basketball: "🏀", volleyball: "🏐", "table-tennis": "🏓", swimming: "🏊",
};

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

  const handleJoin = async (groupId, e) => {
    e?.stopPropagation();
    try {
      await groupAPI.join(groupId);
      toast.success("Joined group!");
      loadGroups(); loadMyGroups();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleLeave = async (groupId, e) => {
    e?.stopPropagation();
    try {
      await groupAPI.leave(groupId);
      toast.success("Left group");
      loadGroups(); loadMyGroups();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to leave"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayGroups = tab === "discover" ? groups : myGroups;

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
          <div>
            <h1 className="admin-page-title mb-1">Communities</h1>
            <p className="text-sm text-muted-foreground">Discover groups, connect with players</p>
          </div>
          <Button onClick={() => setShowCreate(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-10 px-4 flex items-center gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </motion.div>

        {/* ── Tab Navigation ── */}
        <div className="flex items-center border-b border-border/40 mb-6 overflow-x-auto hide-scrollbar">
          {[
            { id: "discover", label: "Discover", icon: TrendingUp },
            { id: "my", label: "My Groups", icon: Users, count: myGroups.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative pb-3 px-1 mr-8 admin-btn text-sm whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                tab === t.id ? "text-brand-600" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  tab === t.id ? "bg-brand-600/15 text-brand-600" : "bg-secondary text-muted-foreground"
                }`}>{t.count}</span>
              )}
              {tab === t.id && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* ── Search + Sport Filters ── */}
        {tab === "discover" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search groups by name or sport..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-secondary/20 border-border/40 text-sm" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSportFilter("")}
                className={`px-4 py-1.5 rounded-full admin-btn transition-all active:scale-95 ${
                  !sportFilter ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                }`}>All</button>
              {SPORTS.map(s => (
                <button key={s} onClick={() => setSportFilter(sportFilter === s ? "" : s)}
                  className={`px-4 py-1.5 rounded-full admin-btn capitalize transition-all active:scale-95 ${
                    sportFilter === s ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}>
                  {SPORT_EMOJI[s]} {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recommended (AI-powered) ── */}
        {tab === "discover" && recGroups.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-brand-600/10">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <span className="admin-section-label">Recommended for you</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">AI-powered</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {recGroups.map((g, i) => (
                <motion.div key={g.id}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className="flex-shrink-0 w-52 rounded-[28px] bg-card border border-brand-600/20 shadow-sm hover:shadow-md hover:border-brand-600/40 transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/communities/${g.id}`)}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-brand-600/10 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                        {g.avatar_url
                          ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-10 w-10 object-cover" />
                          : <Users className="h-5 w-5 text-brand-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-xs truncate">{g.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {g.member_count || 0} members
                          {g.friends_count > 0 && <span className="text-brand-600"> · {g.friends_count} friends</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {g.sport && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-600 font-medium capitalize">
                          {SPORT_EMOJI[g.sport]} {g.sport}
                        </span>
                      )}
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground font-medium capitalize">
                        {g.rec_reason === "friends_are_in" ? "Friends here" :
                         g.rec_reason === "matches_sport" ? "Your sport" : "Popular"}
                      </span>
                    </div>
                    <Button className="w-full h-7 text-[10px] bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-lg active:scale-95 transition-all shadow-sm shadow-brand-600/20"
                      onClick={(e) => handleJoin(g.id, e)}>
                      <Plus className="h-3 w-3 mr-1" /> Join Group
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Section Label for Main Grid ── */}
        {displayGroups.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <span className="admin-section-label">
              {tab === "discover" ? `All Groups (${groups.length})` : `Your Groups (${myGroups.length})`}
            </span>
          </div>
        )}

        {/* ── Group Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {displayGroups.map((g, idx) => (
              <motion.div key={g.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04, duration: 0.3, ease: "easeOut" }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="rounded-[28px] border border-border/40 bg-card shadow-sm hover:shadow-md hover:border-brand-600/25 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/communities/${g.id}`)}>

                <div className="p-5">
                  {/* Avatar + Name row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-12 w-12 rounded-2xl bg-brand-600/10 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                      {g.avatar_url
                        ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-12 w-12 object-cover" />
                        : <Users className="h-6 w-6 text-brand-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm truncate group-hover:text-brand-600 transition-colors">{g.name}</h3>
                        {g.is_private
                          ? <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                          : <Globe className="h-3 w-3 text-muted-foreground shrink-0" />}
                        {g.is_admin && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                        {g.unread_count > 0 && (
                          <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-brand-600 text-white text-[10px] font-medium flex items-center justify-center shrink-0">
                            {g.unread_count > 99 ? "99+" : g.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{g.description || "No description"}</p>
                    </div>
                  </div>

                  {/* Tags + member count */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-600/10 text-brand-600 font-medium capitalize">
                      {g.group_type}
                    </span>
                    {g.sport && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground font-medium capitalize">
                        {SPORT_EMOJI[g.sport]} {g.sport}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {g.member_count || 0}
                    </span>
                  </div>

                  {/* Last message preview */}
                  {g.last_message && (
                    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-2xl bg-secondary/20 border border-border/20">
                      <MessageCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground truncate">
                        <span className="font-medium text-foreground/70">{g.last_message_by}:</span> {g.last_message}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {g.is_member ? (
                      <>
                        <Button
                          className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-9 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                          onClick={() => navigate(`/communities/${g.id}`)}>
                          <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Open Chat
                        </Button>
                        <button
                          onClick={(e) => handleLeave(g.id, e)}
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-border/40">
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <Button
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-9 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                        onClick={(e) => handleJoin(g.id, e)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {g.is_private ? "Request to Join" : "Join Group"}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── Empty State ── */}
        {displayGroups.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/40 rounded-[28px] p-16 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="p-6 rounded-3xl bg-secondary/30 mb-4">
              <Users className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="font-medium text-foreground mb-1">
              {tab === "discover" ? "No groups found" : "You haven't joined any groups yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              {tab === "discover" ? "Try a different search or sport filter" : "Discover and join communities above!"}
            </p>
            {tab === "discover" && (
              <Button onClick={() => setShowCreate(true)}
                className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-10 px-5 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all">
                <Plus className="h-4 w-4 mr-1.5" /> Create a Group
              </Button>
            )}
          </motion.div>
        )}

        {/* ── Create Group Modal ── */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                <div className="px-7 py-5 space-y-4">
                  {/* Group name */}
                  <div className="space-y-1.5">
                    <label className="admin-section-label">Group Name *</label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Chennai Football Club"
                      className="h-11 rounded-xl bg-secondary/20 border-border/40 px-4" />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="admin-section-label">Description</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="What's this group about?" rows={3}
                      className="w-full rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
                  </div>

                  {/* Type + Sport */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="admin-section-label">Group Type</label>
                      <div className="flex gap-2">
                        {["community", "club"].map(t => (
                          <button key={t} onClick={() => setForm(p => ({ ...p, group_type: t }))}
                            className={`flex-1 py-2 rounded-full admin-btn capitalize transition-all active:scale-95 ${
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
                        {SPORTS.map(s => <option key={s} value={s} className="capitalize">{SPORT_EMOJI[s]} {s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Privacy + Max members */}
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
    </div>
  );
}
