import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { matchAPI, mercenaryAPI, bookingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Users, Plus, Clock, Trophy, Target, MapPin,
  IndianRupee, CheckCircle, XCircle, CreditCard, Loader2, Star, UserCheck,
  Sparkles, Zap, FileCheck, BarChart3, ThumbsUp, ThumbsDown
} from "lucide-react";

const SPORT_EMOJI = { football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾", basketball: "🏀" };
const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball"];

const STATUS_STYLE = {
  open:           "bg-brand-600/10 text-brand-600",
  filled:         "bg-amber-500/10 text-amber-500",
  completed:      "bg-emerald-500/10 text-emerald-500",
  pending_result: "bg-sky-500/10 text-sky-500",
};


function CompatBadge({ score }) {
  const cls = score >= 80
    ? "bg-brand-600/10 text-brand-600 border-brand-600/20"
    : score >= 50
    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
    : "bg-red-500/10 text-red-500 border-red-500/20";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`} data-testid="compat-badge">
      <Zap className="h-2.5 w-2.5" />{score}% match
    </span>
  );
}

function MatchCard({ match, onJoin, userId, showCompat, index = 0 }) {
  const isCreator = match.creator_id === userId;
  const hasJoined = match.players_joined?.includes(userId);
  const spotsLeft = match.players_needed - (match.players_joined?.length || 0);
  const hasResult = !!match.result;
  const resultConfirmed = match.result?.confirmed;
  const sportLabel = match.sport?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  const sportEmoji = SPORT_EMOJI[match.sport] || "🏅";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="rounded-[28px] bg-card border border-border/40 shadow-sm p-5 hover:shadow-md hover:border-brand-600/20 transition-all duration-300"
      data-testid={`match-card-${match.id}`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-brand-600/10 flex items-center justify-center text-xl shrink-0">
            {sportEmoji}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm text-foreground">{sportLabel}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[match.status] || "bg-secondary text-muted-foreground"}`}>
                {match.status}
              </span>
              {showCompat && match.compatibility_score != null && (
                <CompatBadge score={match.compatibility_score} />
              )}
            </div>
            {match.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{match.description}</p>}
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
          spotsLeft > 0 ? "bg-brand-600/10 text-brand-600" : "bg-secondary text-muted-foreground"
        }`}>
          {spotsLeft > 0 ? `${spotsLeft} spots` : "Full"}
        </span>
      </div>

      {/* Meta info row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground mb-3 pl-[52px]">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{match.date} · {match.time}</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue_name || "TBD"}</span>
        <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{match.min_skill}–{match.max_skill} skill</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{match.players_joined?.length || 0}/{match.players_needed}</span>
      </div>

      {/* Result banner */}
      {hasResult && (
        <div className={`rounded-2xl px-4 py-2.5 mb-3 text-xs flex items-center gap-2 ${
          resultConfirmed
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
            : "bg-amber-500/10 border border-amber-500/20 text-amber-500"
        }`}>
          <FileCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">
            {resultConfirmed ? "Result Confirmed" : "Result Pending"}
          </span>
          <span className="text-muted-foreground">
            · {match.result.winner === "draw" ? "Draw"
              : match.result.winner === "team_a" ? "Team A won" : "Team B won"}
            {match.result.score_a != null && ` (${match.result.score_a}–${match.result.score_b})`}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/20">
        <span className="text-xs text-muted-foreground">
          by <span className="text-foreground font-medium">{match.creator_name}</span>
        </span>
        <div className="flex gap-2 items-center">
          {hasJoined && !hasResult && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-600/10 text-brand-600 font-medium">Joined</span>
          )}
          {!isCreator && !hasJoined && spotsLeft > 0 && match.status === "open" && (
            <Button size="sm" onClick={() => onJoin(match.id)} data-testid={`join-match-${match.id}`}
              className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 px-4 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all">
              Join
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MercenaryCard({ post, userId, onApply, onAccept, onReject, onPay, paying, index = 0 }) {
  const isHost = post.host_id === userId;
  const hasApplied = post.applicants?.some(a => a.id === userId);
  const isAccepted = post.accepted?.some(a => a.id === userId);
  const hasPaid = post.paid_players?.some(p => p.id === userId);
  const spotsLeft = post.spots_available - (post.spots_filled || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="rounded-[28px] bg-card border border-border/40 shadow-sm p-5 hover:shadow-md hover:border-brand-600/20 transition-all duration-300"
      data-testid={`mercenary-card-${post.id}`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground truncate">{post.position_needed}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{post.venue_name}</span>
              <span className="capitalize">{SPORT_EMOJI[post.sport]} {post.sport}</span>
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="font-medium text-sm text-brand-600 flex items-center gap-0.5 justify-end">
            <IndianRupee className="h-3.5 w-3.5" />{post.amount_per_player}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{spotsLeft}/{post.spots_available} open</div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex gap-3 text-[11px] text-muted-foreground mb-3 pl-[52px]">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.date} · {post.time}</span>
        <span>by <span className="text-foreground font-medium">{post.host_name}</span></span>
      </div>
      {post.description && (
        <p className="text-xs text-muted-foreground/70 mb-3 pl-[52px] line-clamp-2">{post.description}</p>
      )}

      {/* Host: Applicants list */}
      {isHost && post.applicants?.length > 0 && (
        <div className="border-t border-border/30 pt-3 mt-3 space-y-2">
          <span className="admin-section-label">Applicants</span>
          {post.applicants.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-secondary/20 rounded-xl p-3" data-testid={`applicant-${a.id}`}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-brand-600/10 flex items-center justify-center text-xs font-medium text-brand-600">{a.name?.[0]}</div>
                <div>
                  <div className="text-xs font-medium">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Star className="h-2.5 w-2.5" />{a.skill_rating}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => onAccept(post.id, a.id)} data-testid={`accept-${a.id}`}
                  className="h-7 px-2.5 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-600/10 transition-all flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Accept
                </button>
                <button onClick={() => onReject(post.id, a.id)} data-testid={`reject-${a.id}`}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Host: Accepted list */}
      {isHost && post.accepted?.length > 0 && (
        <div className="border-t border-border/30 pt-3 mt-3 space-y-1.5">
          <span className="admin-section-label">Accepted</span>
          {post.accepted.map(a => {
            const paid = post.paid_players?.some(p => p.id === a.id);
            return (
              <div key={a.id} className="flex items-center justify-between bg-secondary/20 rounded-xl p-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-medium">{a.name}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  paid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                }`}>
                  {paid ? "Paid" : "Awaiting"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-end gap-2">
        {!isHost && !hasApplied && !isAccepted && !hasPaid && post.status === "open" && (
          <Button size="sm" onClick={() => onApply(post.id)} data-testid={`apply-mercenary-${post.id}`}
            className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 px-4 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all">
            <Target className="h-3.5 w-3.5 mr-1" /> Apply
          </Button>
        )}
        {hasApplied && !isAccepted && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-medium">Applied · Waiting</span>
        )}
        {isAccepted && !hasPaid && (
          <Button size="sm" onClick={() => onPay(post.id)} disabled={paying === post.id}
            data-testid={`pay-mercenary-${post.id}`}
            className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 px-4 text-xs shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all">
            {paying === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
            Pay ₹{post.amount_per_player}
          </Button>
        )}
        {hasPaid && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Confirmed · You're In!
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ResultDialog({ match, onSubmit, userId }) {
  const [open, setOpen] = useState(false);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [winner, setWinner] = useState("team_a");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [suggestedTeams, setSuggestedTeams] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const players = (match.players_joined || []).map((id, i) => ({
    id, name: match.player_names?.[i] || "Lobbian " + (i + 1),
    rating: match.player_ratings?.[id] || 1500
  }));

  const loadSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const res = await matchAPI.suggestTeams(match.id);
      const data = res.data;
      setSuggestedTeams(data);
      setTeamA(data.team_a.map(p => p.id));
      setTeamB(data.team_b.map(p => p.id));
    } catch { toast.error("Failed to get team suggestion"); }
    finally { setLoadingSuggestion(false); }
  };

  const togglePlayer = (playerId, team) => {
    if (team === "a") {
      if (teamA.includes(playerId)) { setTeamA(prev => prev.filter(id => id !== playerId)); }
      else { setTeamB(prev => prev.filter(id => id !== playerId)); setTeamA(prev => [...prev, playerId]); }
    } else {
      if (teamB.includes(playerId)) { setTeamB(prev => prev.filter(id => id !== playerId)); }
      else { setTeamA(prev => prev.filter(id => id !== playerId)); setTeamB(prev => [...prev, playerId]); }
    }
  };

  const handleSubmit = () => {
    if (teamA.length === 0 || teamB.length === 0) { toast.error("Both teams need at least 1 Lobbian"); return; }
    onSubmit(match.id, { team_a: teamA, team_b: teamB, winner, score_a: scoreA ? Number(scoreA) : null, score_b: scoreB ? Number(scoreB) : null });
    setOpen(false);
  };

  if (!match.players_joined?.includes(userId) || !!match.result) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all border border-border/40"
          data-testid={`submit-result-${match.id}`}>
          <FileCheck className="h-3.5 w-3.5" /> Report Result
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border border-border/40 rounded-[28px] max-w-[95vw] sm:max-w-lg p-7">
        <DialogHeader>
          <DialogTitle className="admin-heading text-xl mb-1">Report Match Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Button variant="outline" onClick={loadSuggestion} disabled={loadingSuggestion}
            className="w-full h-10 rounded-xl border-brand-600/30 text-brand-600 hover:bg-brand-600/5 text-xs admin-btn gap-1.5"
            data-testid="suggest-teams-btn">
            {loadingSuggestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Suggest Balanced Teams
          </Button>

          {suggestedTeams && (
            <div className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-2 bg-secondary/20 rounded-xl py-2">
              <BarChart3 className="h-3 w-3" />
              Balance: {suggestedTeams.balance_quality}% · Avg {suggestedTeams.avg_rating_a} vs {suggestedTeams.avg_rating_b}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Team A", team: "a", list: teamA, activeClass: "bg-brand-600/10 border border-brand-600/30 text-brand-600" },
              { label: "Team B", team: "b", list: teamB, activeClass: "bg-sky-500/10 border border-sky-500/30 text-sky-500" }
            ].map(({ label, team, list, activeClass }) => (
              <div key={team}>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block admin-section-label">{label}</Label>
                <div className="space-y-1.5">
                  {players.map(p => (
                    <button key={p.id} onClick={() => togglePlayer(p.id, team)}
                      data-testid={`team-${team}-${p.id}`}
                      className={`w-full text-left rounded-xl p-2.5 text-xs transition-all ${
                        list.includes(p.id) ? activeClass : "bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                      }`}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-[10px] ml-1 opacity-60">({p.rating})</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label className="admin-section-label mb-1.5 block">Winner</Label>
            <Select value={winner} onValueChange={setWinner}>
              <SelectTrigger className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="winner-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team_a">Team A Won</SelectItem>
                <SelectItem value="team_b">Team B Won</SelectItem>
                <SelectItem value="draw">Draw</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="admin-section-label mb-1.5 block">Score A</Label>
              <Input type="number" value={scoreA} onChange={e => setScoreA(e.target.value)}
                className="bg-secondary/20 border-border/40 rounded-xl text-sm" placeholder="0" data-testid="score-a-input" />
            </div>
            <div>
              <Label className="admin-section-label mb-1.5 block">Score B</Label>
              <Input type="number" value={scoreB} onChange={e => setScoreB(e.target.value)}
                className="bg-secondary/20 border-border/40 rounded-xl text-sm" placeholder="0" data-testid="score-b-input" />
            </div>
          </div>

          <Button className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleSubmit} data-testid="submit-result-btn">
            <FileCheck className="h-4 w-4 mr-1.5" /> Submit Result
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmResultBar({ match, userId, onConfirm }) {
  const result = match.result;
  if (!result || result.confirmed) return null;
  const alreadyResponded = result.confirmations?.some(c => c.user_id === userId);
  const isInMatch = match.players_joined?.includes(userId);
  if (!isInMatch || alreadyResponded || result.submitted_by === userId) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mt-3 flex items-center justify-between" data-testid="confirm-result-bar">
      <div className="text-xs">
        <span className="font-medium text-amber-500">Confirm result?</span>
        <span className="text-muted-foreground ml-1.5">
          {result.winner === "draw" ? "Draw" : result.winner === "team_a" ? "Team A won" : "Team B won"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => onConfirm(match.id, true)} data-testid={`confirm-yes-${match.id}`}
          className="h-7 px-2.5 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-600/10 transition-all flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" /> Confirm
        </button>
        <button onClick={() => onConfirm(match.id, false)} data-testid={`confirm-no-${match.id}`}
          className="h-7 px-2.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-1">
          <ThumbsDown className="h-3.5 w-3.5" /> Dispute
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/40 rounded-[28px] p-16 text-center flex flex-col items-center justify-center min-h-[240px]">
      <div className="p-5 rounded-3xl bg-secondary/30 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/30" />
      </div>
      <p className="font-medium text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </motion.div>
  );
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("recommended");
  const [matches, setMatches] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [mercenaries, setMercenaries] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [formType, setFormType] = useState("match");
  const [paying, setPaying] = useState(null);
  const [autoMatchResult, setAutoMatchResult] = useState(null);
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoSport, setAutoSport] = useState("football");
  const [form, setForm] = useState({
    sport: "football", date: "", time: "18:00", venue_name: "",
    players_needed: 10, min_skill: 0, max_skill: 3000, description: "",
    booking_id: "", position_needed: "", amount_per_player: 200, spots_available: 1,
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      matchAPI.list().catch(() => ({ data: [] })),
      matchAPI.recommended().catch(() => ({ data: [] })),
      mercenaryAPI.list().catch(() => ({ data: [] })),
      mercenaryAPI.myPosts().catch(() => ({ data: [] })),
      bookingAPI.list().catch(() => ({ data: [] })),
    ]).then(([m, rec, mer, mp, bk]) => {
      setMatches(m.data || []);
      setRecommended(rec.data || []);
      setMercenaries(mer.data || []);
      setMyPosts(mp.data || []);
      setMyBookings((bk.data || []).filter(b => b.status === "confirmed" && b.host_id === user?.id));
    }).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleJoin = async (id) => {
    try { await matchAPI.join(id); toast.success("Joined match!"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await matchAPI.autoMatch({ sport: autoSport });
      setAutoMatchResult(res.data);
      if (res.data.found) toast.success(`Found a ${res.data.match.compatibility_score}% compatible match!`);
      else toast.info(res.data.message);
    } catch { toast.error("Auto-match failed"); }
    finally { setAutoMatching(false); }
  };

  const handleSubmitResult = async (matchId, data) => {
    try { const res = await matchAPI.submitResult(matchId, data); toast.success(res.data.message); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to submit result"); }
  };

  const handleConfirmResult = async (matchId, confirmed) => {
    try { const res = await matchAPI.confirmResult(matchId, { confirmed }); toast.success(res.data.message); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleApply = async (id) => {
    try { await mercenaryAPI.apply(id); toast.success("Applied! Host will review."); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to apply"); }
  };
  const handleAccept = async (postId, applicantId) => {
    try { await mercenaryAPI.accept(postId, applicantId); toast.success("Lobbian accepted!"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleReject = async (postId, applicantId) => {
    try { await mercenaryAPI.reject(postId, applicantId); toast.success("Applicant removed"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePay = async (postId) => {
    setPaying(postId);
    try {
      const res = await mercenaryAPI.pay(postId);
      const result = res.data;
      if (result.payment_gateway === "razorpay" && result.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setPaying(null); return; }
        const options = {
          key: result.razorpay_key_id, amount: result.amount * 100, currency: "INR",
          order_id: result.razorpay_order_id, name: "Horizon Sports", description: "Mercenary Fee",
          handler: async (response) => {
            try {
              await mercenaryAPI.verifyPayment(postId, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment confirmed!"); loadData();
            } catch { toast.error("Payment verification failed"); }
            setPaying(null);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setPaying(null); } },
          theme: { color: "#7C3AED" }
        };
        new window.Razorpay(options).open();
        return;
      }
      toast.success("Payment confirmed!"); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Payment failed"); }
    finally { setPaying(null); }
  };

  const handleCreate = async () => {
    try {
      if (formType === "match") {
        await matchAPI.create({
          sport: form.sport, date: form.date, time: form.time,
          venue_name: form.venue_name, players_needed: Number(form.players_needed),
          min_skill: Number(form.min_skill), max_skill: Number(form.max_skill), description: form.description,
        });
        toast.success("Match created!");
      } else {
        if (!form.booking_id) { toast.error("Select a booking"); return; }
        await mercenaryAPI.create({
          booking_id: form.booking_id, position_needed: form.position_needed,
          amount_per_player: Number(form.amount_per_player), spots_available: Number(form.spots_available),
          description: form.description,
        });
        toast.success("Mercenary post created!");
      }
      setCreateOpen(false); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Creation failed"); }
  };

  const allMercenaryPosts = [...myPosts.filter(p => !mercenaries.some(m => m.id === p.id)), ...mercenaries];

  const [allMatches, setAllMatches] = useState([]);
  useEffect(() => {
    matchAPI.list({ status: "filled" }).then(res => {
      const filled = res.data || [];
      matchAPI.list({ status: "pending_result" }).then(res2 => {
        const pending = res2.data || [];
        matchAPI.list({ status: "completed" }).then(res3 => {
          const completed = res3.data || [];
          setAllMatches([...matches, ...filled, ...pending, ...completed].filter(
            (m, i, arr) => arr.findIndex(x => x.id === m.id) === i
          ));
        }).catch(() => setAllMatches(matches));
      }).catch(() => setAllMatches(matches));
    }).catch(() => setAllMatches(matches));
  }, [matches]);

  const myActiveMatches = allMatches.filter(m =>
    m.players_joined?.includes(user?.id) &&
    (m.status === "filled" || m.status === "pending_result" || m.status === "completed")
  );

  const TABS = [
    { id: "recommended", label: "For You", icon: Sparkles },
    { id: "matches", label: "All Games", icon: Swords },
    { id: "my-matches", label: "My Games", icon: Trophy, count: myActiveMatches.length },
    { id: "mercenary", label: "Mercenary", icon: Target },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-20 md:pb-8" data-testid="matchmaking-page">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
          <div>
            <h1 className="admin-page-title mb-1">Matchmaking</h1>
            <p className="text-sm text-muted-foreground">Find games, fill spots, report results</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all h-10 px-4 flex items-center gap-1.5 shrink-0"
                data-testid="create-match-btn">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border border-border/40 rounded-[28px] max-w-[95vw] sm:max-w-md overflow-hidden p-0">
              {/* Modal Header */}
              <div className="border-b border-border/40 px-7 pt-7 pb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-brand-600/10">
                    <Swords className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <DialogTitle className="admin-heading">Create {formType === "match" ? "Match" : "Mercenary Post"}</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{formType === "match" ? "Set up a game" : "Find players for your slot"}</p>
                  </div>
                </div>
              </div>

              {/* Type toggle */}
              <div className="px-7 pt-5 pb-0 flex gap-2">
                {["match", "mercenary"].map(t => (
                  <button key={t} onClick={() => setFormType(t)}
                    className={`px-4 py-1.5 rounded-full admin-btn capitalize text-sm transition-all active:scale-95 ${
                      formType === t ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`form-type-${t}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="px-7 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {formType === "match" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Sport</Label>
                        <Select value={form.sport} onValueChange={v => setForm(p => ({ ...p, sport: v }))}>
                          <SelectTrigger className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-sport-select"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SPORTS.map(s => <SelectItem key={s} value={s}>{SPORT_EMOJI[s]} {s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Time</Label>
                        <Input value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                          className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-time-input" />
                      </div>
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Date</Label>
                      <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                        className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-date-input" />
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Venue Name</Label>
                      <Input value={form.venue_name} onChange={e => setForm(p => ({ ...p, venue_name: e.target.value }))}
                        className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-venue-input" />
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Lobbians Needed</Label>
                      <Input type="number" value={form.players_needed} onChange={e => setForm(p => ({ ...p, players_needed: e.target.value }))}
                        className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-players-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Min Skill</Label>
                        <Input type="number" value={form.min_skill} onChange={e => setForm(p => ({ ...p, min_skill: e.target.value }))}
                          className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-min-skill" />
                      </div>
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Max Skill</Label>
                        <Input type="number" value={form.max_skill} onChange={e => setForm(p => ({ ...p, max_skill: e.target.value }))}
                          className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-max-skill" />
                      </div>
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Description</Label>
                      <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Friendly match, bring water..." className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-description-input" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Select Your Booking</Label>
                      {myBookings.length === 0 ? (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-500">
                          You need a confirmed booking first.
                        </div>
                      ) : (
                        <Select value={form.booking_id} onValueChange={v => setForm(p => ({ ...p, booking_id: v }))}>
                          <SelectTrigger className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="select-booking">
                            <SelectValue placeholder="Choose a booking..." />
                          </SelectTrigger>
                          <SelectContent>
                            {myBookings.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.venue_name} — {b.date} at {b.start_time} ({b.sport})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Position Needed</Label>
                      <Input value={form.position_needed} onChange={e => setForm(p => ({ ...p, position_needed: e.target.value }))}
                        placeholder="Goalkeeper, Defender..." className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-position-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Fee Per Lobbian</Label>
                        <Input type="number" value={form.amount_per_player} onChange={e => setForm(p => ({ ...p, amount_per_player: e.target.value }))}
                          className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-amount-input" />
                      </div>
                      <div>
                        <Label className="admin-section-label mb-1.5 block">Spots</Label>
                        <Input type="number" min={1} max={20} value={form.spots_available} onChange={e => setForm(p => ({ ...p, spots_available: e.target.value }))}
                          className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-spots-input" />
                      </div>
                    </div>
                    <div>
                      <Label className="admin-section-label mb-1.5 block">Description (optional)</Label>
                      <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Details..." className="bg-secondary/20 border-border/40 rounded-xl text-sm" data-testid="create-merc-description" />
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border/40 px-7 py-4 flex gap-3">
                <Button variant="outline" className="flex-1 admin-btn rounded-xl h-11 border-border/40" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-11 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                  onClick={handleCreate} data-testid="submit-create-btn">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* ── Tab Navigation ── */}
        <div className="flex items-center border-b border-border/40 mb-6 overflow-x-auto hide-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative pb-3 px-1 mr-6 admin-btn text-sm whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
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

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {/* FOR YOU */}
          {tab === "recommended" && (
            <motion.div key="recommended" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Auto-Match card */}
              <div className="rounded-[28px] bg-card border border-border/40 shadow-sm p-5 mb-6" data-testid="auto-match-section">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-2xl bg-brand-600/10">
                    <Zap className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Auto-Match</h3>
                    <p className="text-xs text-muted-foreground">Instantly find the best game for your skill level</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {SPORTS.map(s => (
                    <button key={s} onClick={() => setAutoSport(s)}
                      className={`px-3.5 py-1.5 rounded-full admin-btn text-xs transition-all active:scale-95 ${
                        autoSport === s ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "bg-secondary/30 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                      }`}>
                      {SPORT_EMOJI[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <Button onClick={handleAutoMatch} disabled={autoMatching}
                  className="w-full h-10 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                  data-testid="auto-match-btn">
                  {autoMatching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Finding...</> : <><Zap className="h-4 w-4 mr-2" />Find Best Match</>}
                </Button>
                {autoMatchResult && (
                  <div className="mt-4 pt-4 border-t border-border/30">
                    {autoMatchResult.found ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CompatBadge score={autoMatchResult.match.compatibility_score} />
                          <span className="text-xs text-muted-foreground">Best match found for you!</span>
                        </div>
                        <MatchCard match={autoMatchResult.match} onJoin={handleJoin} userId={user?.id} showCompat />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">{autoMatchResult.message}</p>
                    )}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : recommended.length === 0 ? (
                <EmptyState icon={Sparkles} title="No recommendations yet" sub="Create a match or check back later!" />
              ) : (
                <div className="space-y-4">
                  <span className="admin-section-label">Recommended for you</span>
                  {recommended.map((m, i) => <MatchCard key={m.id} match={m} onJoin={handleJoin} userId={user?.id} showCompat index={i} />)}
                </div>
              )}
            </motion.div>
          )}

          {/* ALL GAMES */}
          {tab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : matches.length === 0 ? (
                <EmptyState icon={Swords} title="No open games" sub="Be the first to create one!" />
              ) : (
                <div className="space-y-4">
                  <span className="admin-section-label">{matches.length} open game{matches.length !== 1 ? "s" : ""}</span>
                  {matches.map((m, i) => <MatchCard key={m.id} match={m} onJoin={handleJoin} userId={user?.id} index={i} />)}
                </div>
              )}
            </motion.div>
          )}

          {/* MY GAMES */}
          {tab === "my-matches" && (
            <motion.div key="my-matches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {myActiveMatches.length === 0 ? (
                <EmptyState icon={Trophy} title="No active games" sub="Join a match and play to submit results!" />
              ) : (
                <div className="space-y-4">
                  <span className="admin-section-label">Report & confirm results</span>
                  {myActiveMatches.map((m, i) => (
                    <div key={m.id}>
                      <MatchCard match={m} onJoin={handleJoin} userId={user?.id} index={i} />
                      <div className="mt-2 flex gap-2 justify-end">
                        <ResultDialog match={m} onSubmit={handleSubmitResult} userId={user?.id} />
                      </div>
                      <ConfirmResultBar match={m} userId={user?.id} onConfirm={handleConfirmResult} />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* MERCENARY */}
          {tab === "mercenary" && (
            <motion.div key="mercenary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : allMercenaryPosts.length === 0 ? (
                <EmptyState icon={Users} title="No mercenary posts" sub="Book a slot and create a post to find Lobbians!" />
              ) : (
                <div className="space-y-4">
                  <span className="admin-section-label">{allMercenaryPosts.length} open post{allMercenaryPosts.length !== 1 ? "s" : ""}</span>
                  {allMercenaryPosts.map((m, i) => (
                    <MercenaryCard key={m.id} post={m} userId={user?.id}
                      onApply={handleApply} onAccept={handleAccept} onReject={handleReject}
                      onPay={handlePay} paying={paying} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
