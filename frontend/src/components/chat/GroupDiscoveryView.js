import { useState, useEffect, useCallback } from "react";
import { groupAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
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
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-card/95 backdrop-blur-xl border-b border-border/15">
        <div className="h-[56px] sm:h-[60px] max-w-5xl mx-auto px-3 sm:px-4 flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/40 active:scale-90 transition-all lg:hidden flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-bold truncate">Discover Groups</h1>
            <p className="text-[11px] text-muted-foreground/50 truncate">Find communities, connect with players</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-3.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create Group</span>
          </button>
        </div>

        {/* Search */}
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
            <input
              type="search"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-secondary/40 border-none rounded-lg text-[13px] placeholder:text-muted-foreground/40 outline-none focus:bg-secondary/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-5">

          {/* AI Recommendations */}
          {!search && recGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-600/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-brand-600" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/60">Recommended for you</span>
                <span className="ml-auto text-[9px] text-muted-foreground/30 font-medium tracking-wider">AI-powered</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recGroups.map((g, i) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="rounded-xl bg-card border border-border/20 hover:border-brand-600/20 transition-all cursor-pointer overflow-hidden active:scale-[0.98]"
                    onClick={() => onOpenGroup({ id: g.id, type: "group" })}
                  >
                    <div className="p-3.5">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-11 w-11 rounded-full bg-brand-600/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {g.avatar_url ? (
                            <img src={mediaUrl(g.avatar_url)} alt="" className="h-11 w-11 rounded-full object-cover" />
                          ) : (
                            <Users className="h-5 w-5 text-brand-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[13px] truncate">{g.name}</h4>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            {g.member_count || 0} members
                            {g.friends_count > 0 && (
                              <span className="text-brand-600 font-medium"> · {g.friends_count} friends</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Tags */}
                      <div className="flex gap-1.5 mb-3 flex-wrap">
                        {g.sport && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/8 text-brand-600 font-medium capitalize">
                            {SPORT_EMOJI[g.sport]} {g.sport}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground/60 font-medium">
                          {g.rec_reason === "friends_are_in" ? "Friends here" :
                           g.rec_reason === "matches_sport" ? "Your sport" : "Popular"}
                        </span>
                      </div>
                      {/* Join button */}
                      <button
                        className="w-full h-8 text-[12px] font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-full active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
                        onClick={(e) => { e.stopPropagation(); handleJoin(g.id, e); }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Join Group
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {search && groups.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/50 mb-2.5">
                Results ({groups.length})
              </p>
              <div className="space-y-1.5">
                {groups.map((g, idx) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 active:bg-secondary/50 transition-all cursor-pointer"
                    onClick={() => onOpenGroup({ id: g.id, type: "group" })}
                  >
                    <div className="h-11 w-11 rounded-full bg-brand-600/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {g.avatar_url ? (
                        <img src={mediaUrl(g.avatar_url)} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-brand-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-[14px] truncate">{g.name}</h3>
                        {g.is_private ? (
                          <Lock className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/50">
                          {g.member_count || 0} members
                        </span>
                        {g.sport && (
                          <span className="text-[11px] text-muted-foreground/50 capitalize">
                            {SPORT_EMOJI[g.sport]} {g.sport}
                          </span>
                        )}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                      {g.is_member ? (
                        <button
                          className="h-8 px-3.5 rounded-full text-[12px] font-medium border border-border/30 text-muted-foreground hover:bg-secondary/40 active:scale-95 transition-all"
                          onClick={() => onOpenGroup({ id: g.id, type: "group" })}
                        >
                          Open
                        </button>
                      ) : (
                        <button
                          className="h-8 px-3.5 rounded-full text-[12px] font-semibold bg-brand-600 hover:bg-brand-500 text-white active:scale-95 transition-all"
                          onClick={(e) => handleJoin(g.id, e)}
                        >
                          {g.is_private ? "Request" : "Join"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* No results when searching */}
          {search && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-16 w-16 rounded-full bg-secondary/30 flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-foreground/70">No groups found</p>
                <p className="text-[12px] text-muted-foreground/40 mt-1">Try a different search or create your own group</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="w-full max-w-lg bg-card border border-border/20 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar (mobile) */}
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <div className="w-8 h-1 rounded-full bg-border/50" />
              </div>

              {/* Modal Header */}
              <div className="border-b border-border/15 px-5 pt-3 sm:pt-5 pb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-brand-600/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold">Create Group</h2>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Build your community</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40 transition-all active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Group Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Chennai Football Club"
                    className="w-full h-10 rounded-lg bg-secondary/30 border-none px-3 text-[14px] outline-none focus:ring-1 focus:ring-brand-600/20 placeholder:text-muted-foreground/35 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What's this group about?"
                    rows={3}
                    className="w-full rounded-lg bg-secondary/30 border-none px-3 py-2.5 text-[14px] resize-none outline-none focus:ring-1 focus:ring-brand-600/20 placeholder:text-muted-foreground/35 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Type</label>
                    <div className="flex gap-1.5">
                      {["community", "club"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setForm((p) => ({ ...p, group_type: t }))}
                          className={`flex-1 py-2 rounded-full capitalize text-[12px] font-medium transition-all active:scale-95 ${
                            form.group_type === t
                              ? "bg-brand-600 text-white shadow-sm"
                              : "bg-secondary/30 text-muted-foreground/70 hover:bg-secondary/50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Sport</label>
                    <select
                      value={form.sport}
                      onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value }))}
                      className="w-full h-10 rounded-lg bg-secondary/30 border-none px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand-600/20 transition-all"
                    >
                      <option value="">Any Sport</option>
                      {Object.keys(SPORT_EMOJI).map((s) => (
                        <option key={s} value={s} className="capitalize">{SPORT_EMOJI[s]} {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/20 border border-border/10">
                  <div>
                    <p className="text-[13px] font-medium">Private Group</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Members must request to join</p>
                  </div>
                  <button
                    onClick={() => setForm((p) => ({ ...p, is_private: !p.is_private }))}
                    className={`relative w-11 h-6 rounded-full transition-all ${form.is_private ? "bg-brand-600" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${form.is_private ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Max Members</label>
                  <input
                    type="number"
                    min={2}
                    max={5000}
                    value={form.max_members}
                    onChange={(e) => setForm((p) => ({ ...p, max_members: parseInt(e.target.value) || 500 }))}
                    className="w-full h-10 rounded-lg bg-secondary/30 border-none px-3 text-[14px] outline-none focus:ring-1 focus:ring-brand-600/20 transition-all"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/15 px-5 py-3 flex gap-2.5 flex-shrink-0">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-xl font-medium text-[13px] border border-border/40 hover:bg-secondary/40 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 h-10 rounded-xl font-semibold text-[13px] bg-brand-600 hover:bg-brand-500 text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
