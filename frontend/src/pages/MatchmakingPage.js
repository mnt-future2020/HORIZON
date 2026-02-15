import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { matchAPI, mercenaryAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Swords, Users, Plus, MapPin, Clock, Trophy, Target } from "lucide-react";

function MatchCard({ match, onJoin, userId }) {
  const isCreator = match.creator_id === userId;
  const hasJoined = match.players_joined?.includes(userId);
  const spotsLeft = match.players_needed - (match.players_joined?.length || 0);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-5" data-testid={`match-card-${match.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground">{match.sport?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
            <Badge variant="secondary" className="text-[10px]">{match.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{match.description || "No description"}</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">{spotsLeft} spots</Badge>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{match.date} at {match.time}</span>
        {match.venue_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue_name}</span>}
        <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />SR {match.min_skill}-{match.max_skill}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          by <span className="text-foreground font-medium">{match.creator_name}</span>
          {match.player_names?.length > 0 && ` + ${match.player_names.length} joined`}
        </div>
        {!isCreator && !hasJoined && match.status === "open" && (
          <Button size="sm" onClick={() => onJoin(match.id)} data-testid={`join-match-${match.id}`}
            className="bg-primary text-primary-foreground font-bold text-xs h-8">
            Join Game
          </Button>
        )}
        {hasJoined && <Badge className="bg-primary/20 text-primary">Joined</Badge>}
      </div>
    </motion.div>
  );
}

function MercenaryCard({ post, onApply, userId }) {
  const isHost = post.host_id === userId;
  const hasApplied = post.applicants?.some(a => a.id === userId);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-5" data-testid={`mercenary-card-${post.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {post.position_needed}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{post.sport} at {post.venue_name}</p>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-primary">{"\u20B9"}{post.amount_per_player}</div>
          <div className="text-[10px] text-muted-foreground">{post.spots_available} spot(s)</div>
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.date} at {post.time}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">by <span className="text-foreground font-medium">{post.host_name}</span></span>
        {!isHost && !hasApplied && post.status === "open" && (
          <Button size="sm" onClick={() => onApply(post.id)} data-testid={`apply-mercenary-${post.id}`}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-8">
            Apply
          </Button>
        )}
        {hasApplied && <Badge className="bg-violet-500/20 text-violet-400">Applied</Badge>}
      </div>
    </motion.div>
  );
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [mercenaries, setMercenaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [formType, setFormType] = useState("match");
  const [form, setForm] = useState({
    sport: "football", date: "", time: "18:00", venue_name: "",
    players_needed: 10, min_skill: 0, max_skill: 3000, description: "",
    position_needed: "", amount_per_player: 200, spots_available: 1,
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      matchAPI.list().catch(() => ({ data: [] })),
      mercenaryAPI.list().catch(() => ({ data: [] })),
    ]).then(([m, mer]) => {
      setMatches(m.data || []);
      setMercenaries(mer.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const handleJoin = async (id) => {
    try {
      await matchAPI.join(id);
      toast.success("Joined match!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to join");
    }
  };

  const handleApply = async (id) => {
    try {
      await mercenaryAPI.apply(id);
      toast.success("Applied successfully!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to apply");
    }
  };

  const handleCreate = async () => {
    try {
      if (formType === "match") {
        await matchAPI.create({
          sport: form.sport, date: form.date, time: form.time,
          venue_name: form.venue_name, players_needed: Number(form.players_needed),
          min_skill: Number(form.min_skill), max_skill: Number(form.max_skill),
          description: form.description,
        });
        toast.success("Match created!");
      } else {
        await mercenaryAPI.create({
          sport: form.sport, date: form.date, time: form.time,
          venue_name: form.venue_name, position_needed: form.position_needed,
          amount_per_player: Number(form.amount_per_player),
          spots_available: Number(form.spots_available),
        });
        toast.success("Mercenary post created!");
      }
      setCreateOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Creation failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="matchmaking-page">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Matchmaking</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Find Your <span className="text-primary">Game</span></h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold text-xs h-9" data-testid="create-match-btn">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Create {formType === "match" ? "Match" : "Mercenary Post"}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant={formType === "match" ? "default" : "outline"} onClick={() => setFormType("match")} data-testid="form-type-match">Match</Button>
              <Button size="sm" variant={formType === "mercenary" ? "default" : "outline"} onClick={() => setFormType("mercenary")} data-testid="form-type-mercenary">Mercenary</Button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sport</Label>
                  <Select value={form.sport} onValueChange={v => setForm(p => ({ ...p, sport: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border text-sm" data-testid="create-sport-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["football", "cricket", "badminton", "tennis", "basketball"].map(s => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Input value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="mt-1 bg-background border-border text-sm" data-testid="create-time-input" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date (YYYY-MM-DD)</Label>
                <Input value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  placeholder="2026-02-20" className="mt-1 bg-background border-border text-sm" data-testid="create-date-input" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Venue Name</Label>
                <Input value={form.venue_name} onChange={e => setForm(p => ({ ...p, venue_name: e.target.value }))}
                  className="mt-1 bg-background border-border text-sm" data-testid="create-venue-input" />
              </div>
              {formType === "match" ? (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Players Needed</Label>
                    <Input type="number" value={form.players_needed} onChange={e => setForm(p => ({ ...p, players_needed: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-players-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-description-input" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Position Needed</Label>
                    <Input value={form.position_needed} onChange={e => setForm(p => ({ ...p, position_needed: e.target.value }))}
                      placeholder="Goalkeeper, Defender..." className="mt-1 bg-background border-border text-sm" data-testid="create-position-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Amount Per Player</Label>
                    <Input type="number" value={form.amount_per_player} onChange={e => setForm(p => ({ ...p, amount_per_player: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-amount-input" />
                  </div>
                </>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreate} data-testid="submit-create-btn">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="matches" data-testid="matchmaking-tabs">
        <TabsList className="bg-secondary/50 mb-6">
          <TabsTrigger value="matches" className="font-bold gap-1"><Swords className="h-3.5 w-3.5" /> Find Games</TabsTrigger>
          <TabsTrigger value="mercenary" className="font-bold gap-1"><Users className="h-3.5 w-3.5" /> Mercenary</TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No open matches</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map(m => <MatchCard key={m.id} match={m} onJoin={handleJoin} userId={user?.id} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mercenary">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : mercenaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No mercenary posts</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mercenaries.map(m => <MercenaryCard key={m.id} post={m} onApply={handleApply} userId={user?.id} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
