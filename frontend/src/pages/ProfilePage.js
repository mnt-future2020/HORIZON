import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, analyticsAPI, bookingAPI, uploadAPI, careerAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { User, Trophy, Star, TrendingUp, Calendar, Shield, LogOut, Save, Camera, Loader2, BarChart3, Clock, Award, Building2, BadgeCheck } from "lucide-react";
import { playerCardAPI } from "@/lib/api";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", preferred_position: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [career, setCareer] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const [playerCard, setPlayerCard] = useState(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || "", phone: user.phone || "", preferred_position: user.preferred_position || "" });
    }
    Promise.all([
      analyticsAPI.player().catch(() => ({ data: null })),
      bookingAPI.list().catch(() => ({ data: [] })),
    ]).then(([sRes, bRes]) => {
      setStats(sRes.data);
      setBookings(bRes.data || []);
    });
    if (user?.id) {
      setCareerLoading(true);
      careerAPI.getCareer(user.id)
        .then((res) => setCareer(res.data))
        .catch(() => setCareer(null))
        .finally(() => setCareerLoading(false));
      playerCardAPI.get(user.id)
        .then((res) => setPlayerCard(res.data))
        .catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(form);
      updateUser(res.data);
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadAPI.image(file);
      const url = res.data.url;
      const profileRes = await authAPI.updateProfile({ avatar: url });
      updateUser(profileRes.data);
      toast.success("Profile photo updated!");
    } catch (err) {
      if (err?.response?.status === 503) {
        toast.error("S3 not configured. Ask the admin to set up S3 in Admin → Settings.");
      } else {
        toast.error("Failed to upload photo");
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const getRatingTier = (r) => {
    if (r >= 2500) return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-500/10" };
    if (r >= 2000) return { label: "Gold", color: "text-amber-400", bg: "bg-amber-500/10" };
    if (r >= 1500) return { label: "Silver", color: "text-slate-300", bg: "bg-slate-500/10" };
    return { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10" };
  };

  const tier = getRatingTier(user?.skill_rating || 1500);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="profile-page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <div className="glass-card rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Clickable avatar with camera overlay */}
            <div className="relative group">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-16 h-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center relative focus:outline-none focus:ring-2 focus:ring-primary"
                title="Change profile photo"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-black text-2xl text-primary">{user?.name?.[0]?.toUpperCase()}</span>
                )}
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  {uploadingAvatar
                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                    : <Camera className="h-5 w-5 text-white" />}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-xl font-bold text-foreground">{user?.name}</h1>
                {(user?.is_verified || playerCard?.is_verified) && (
                  <BadgeCheck className="h-5 w-5 text-blue-400 shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">{user?.role?.replace("_", " ").toUpperCase()}</Badge>
            </div>
          </div>

          {user?.role === "player" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Trophy className={`h-5 w-5 mx-auto mb-1 ${tier.color}`} />
                <div className={`text-lg font-display font-black ${tier.color}`}>{user?.skill_rating || 1500}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">{tier.label}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-lg font-display font-black">{stats?.total_games || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Games</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Star className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <div className="text-lg font-display font-black">
                  {stats?.total_games ? `${Math.round((stats.wins / stats.total_games) * 100)}%` : "0%"}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Win Rate</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Shield className="h-5 w-5 mx-auto mb-1 text-sky-400" />
                <div className="text-lg font-display font-black">{user?.reliability_score || 100}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Reliability</div>
              </div>
            </div>
          )}

          {playerCard?.overall_score !== undefined && (
            <div className="flex items-center gap-4 mt-4 p-4 rounded-xl bg-background/50">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-border/30" />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7"
                    strokeDasharray={`${playerCard.overall_score * 2.64} 264`} strokeLinecap="round"
                    className={playerCard.overall_score >= 86 ? "text-amber-400" : playerCard.overall_score >= 71 ? "text-violet-400" : playerCard.overall_score >= 51 ? "text-emerald-400" : playerCard.overall_score >= 31 ? "text-blue-400" : "text-muted-foreground"} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-xl font-black">{playerCard.overall_score}</span>
                </div>
              </div>
              <div>
                <div className="font-display text-sm font-black">Overall Score</div>
                <Badge className={`text-[10px] mt-1 ${playerCard.overall_score >= 86 ? "bg-amber-400/20 text-amber-400" : playerCard.overall_score >= 71 ? "bg-violet-400/20 text-violet-400" : playerCard.overall_score >= 51 ? "bg-emerald-400/20 text-emerald-400" : playerCard.overall_score >= 31 ? "bg-blue-400/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
                  {playerCard.overall_tier}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="info" data-testid="profile-tabs">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="info" className="font-bold">Info</TabsTrigger>
            <TabsTrigger value="history" className="font-bold">History</TabsTrigger>
            <TabsTrigger value="performance" className="font-bold">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="glass-card rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">Personal Info</h3>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="edit-profile-btn">Edit</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} data-testid="save-profile-btn"
                      className="bg-primary text-primary-foreground">
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div><Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="profile-name-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="profile-phone-input" /></div>
                  {user?.role === "player" && (
                    <div><Label className="text-xs text-muted-foreground">Preferred Position</Label>
                      <Input value={form.preferred_position} onChange={e => setForm(p => ({ ...p, preferred_position: e.target.value }))}
                        placeholder="Midfielder, Goalkeeper..." className="mt-1 bg-background border-border"
                        data-testid="profile-position-input" /></div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground">{user?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <span className="text-sm font-medium text-foreground">{user?.phone || "Not set"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <Badge variant="secondary" className="text-[10px]">{user?.role?.replace("_", " ").toUpperCase()}</Badge>
                  </div>
                  {user?.preferred_position && (
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-muted-foreground">Position</span>
                      <span className="text-sm font-medium text-foreground">{user.preferred_position}</span>
                    </div>
                  )}
                </div>
              )}

              <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 mt-4"
                onClick={logout} data-testid="profile-logout-btn">
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {bookings.length === 0 ? (
              <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No booking history</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 15).map(b => (
                  <div key={b.id} className="glass-card rounded-lg p-4 flex items-center justify-between" data-testid={`history-card-${b.id}`}>
                    <div>
                      <div className="font-bold text-sm text-foreground">{b.venue_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{b.date} | {b.start_time}-{b.end_time} | {b.sport}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-foreground">{"\u20B9"}{b.total_amount}</div>
                      <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                        className="text-[10px]">{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance">
            {careerLoading ? (
              <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                <p className="text-sm">Loading performance data...</p>
              </div>
            ) : !career ? (
              <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-3" />
                <p className="text-sm">No performance data available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Career Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                    <BarChart3 className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-display font-black text-foreground">{career.total_records || 0}</div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Total Records</div>
                  </div>
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-2 text-blue-400" />
                    <div className="text-2xl font-display font-black text-foreground">{career.training_hours || 0}</div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Training Hours</div>
                  </div>
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                    <Award className="h-5 w-5 mx-auto mb-2 text-amber-400" />
                    <div className="text-2xl font-display font-black text-foreground">{career.tournaments_played || 0}</div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Tournaments</div>
                  </div>
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                    <Building2 className="h-5 w-5 mx-auto mb-2 text-emerald-400" />
                    <div className="text-2xl font-display font-black text-foreground">
                      {career.organizations ? (Array.isArray(career.organizations) ? career.organizations.length : career.organizations) : 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Organizations</div>
                  </div>
                </div>

                {/* Records Timeline */}
                <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                  <h3 className="font-display font-bold text-foreground mb-4">Records Timeline</h3>
                  {career.recent_records && career.recent_records.length > 0 ? (
                    <div className="space-y-3">
                      {career.recent_records.map((record, idx) => {
                        const typeColors = {
                          training: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                          match_result: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                          assessment: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                          tournament_result: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                          achievement: "bg-rose-500/15 text-rose-400 border-rose-500/30",
                        };
                        const badgeClass = typeColors[record.type] || "bg-secondary text-muted-foreground border-border";
                        const statsObj = record.stats || record.data || {};
                        const statEntries = Object.entries(statsObj).slice(0, 4);

                        return (
                          <div
                            key={record.id || idx}
                            className="flex flex-col gap-2 p-3 rounded-lg bg-background/50 border border-border/50"
                            data-testid={`perf-record-${record.id || idx}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {record.date ? new Date(record.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                                </span>
                                <Badge className={`text-[10px] border ${badgeClass}`}>
                                  {(record.type || "unknown").replace("_", " ")}
                                </Badge>
                              </div>
                              {record.sport && (
                                <Badge variant="outline" className="text-[10px]">{record.sport}</Badge>
                              )}
                            </div>
                            <div className="font-semibold text-sm text-foreground">{record.title || record.type || "Untitled"}</div>
                            {record.source_name && (
                              <div className="text-xs text-muted-foreground">
                                Source: <span className="text-foreground/80">{record.source_name}</span>
                              </div>
                            )}
                            {statEntries.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {statEntries.map(([key, value]) => (
                                  <span key={key} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground">
                                    <span className="font-medium text-foreground/70">{key.replace(/_/g, " ")}:</span> {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No records yet</p>
                  )}
                </div>

                {/* Sport Breakdown */}
                {career.records_by_sport && Object.keys(career.records_by_sport).length > 0 && (
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                    <h3 className="font-display font-bold text-foreground mb-4">Sport Breakdown</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(career.records_by_sport).map(([sport, count]) => (
                        <Badge key={sport} variant="secondary" className="text-xs px-3 py-1.5 font-mono">
                          {sport} <span className="ml-1.5 font-black text-primary">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Breakdown */}
                {career.records_by_source && Object.keys(career.records_by_source).length > 0 && (
                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                    <h3 className="font-display font-bold text-foreground mb-4">Source Breakdown</h3>
                    <div className="space-y-2">
                      {Object.entries(career.records_by_source).map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-sm text-foreground">{source}</span>
                          <span className="text-sm font-display font-bold text-muted-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
