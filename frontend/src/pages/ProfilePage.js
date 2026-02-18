import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, analyticsAPI, bookingAPI, uploadAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { User, Trophy, Star, TrendingUp, Calendar, Shield, LogOut, Save, Camera, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", preferred_position: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="font-display font-black text-2xl text-primary">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">{user?.name}</h1>
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
        </div>

        <Tabs defaultValue="info" data-testid="profile-tabs">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="info" className="font-bold">Info</TabsTrigger>
            <TabsTrigger value="history" className="font-bold">History</TabsTrigger>
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
        </Tabs>
      </motion.div>
    </div>
  );
}
