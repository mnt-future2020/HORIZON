import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Trophy, Users, Calendar, MapPin, ArrowLeft, Play,
  Swords, Target, Medal, Crown, UserPlus, UserMinus,
  ChevronRight, Award, Hash, CheckCircle
} from "lucide-react";

const STATUS_COLORS = {
  registration: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  in_progress: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  completed: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABELS = {
  registration: "Registration Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bracket");
  const [resultDialog, setResultDialog] = useState(null);
  const [resultForm, setResultForm] = useState({ winner: "", score_a: "", score_b: "" });
  const [submitting, setSubmitting] = useState(false);
  const [nameMap, setNameMap] = useState({});

  const loadTournament = useCallback(async () => {
    try {
      const res = await tournamentAPI.get(tournamentId);
      setTournament(res.data);
      // Build name lookup
      const map = {};
      (res.data.participants || []).forEach(p => { map[p.user_id] = p.name; });
      setNameMap(map);
      // Auto-select tab based on format
      if (res.data.format === "round_robin" || res.data.format === "league") {
        setActiveTab("standings");
      }
    } catch {
      toast.error("Tournament not found");
      navigate("/tournaments");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, navigate]);

  useEffect(() => { loadTournament(); }, [loadTournament]);

  if (loading || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOrganizer = user?.id === tournament.organizer_id || user?.role === "super_admin";
  const isRegistered = tournament.participants?.some(p => p.user_id === user?.id);
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];
  const standings = tournament.standings || [];

  const handleRegister = async () => {
    try {
      await tournamentAPI.register(tournamentId);
      toast.success("Registered!");
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleWithdraw = async () => {
    try {
      await tournamentAPI.withdraw(tournamentId);
      toast.success("Withdrawn from tournament");
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleStart = async () => {
    if (participants.length < 2) return toast.error("Need at least 2 participants");
    try {
      await tournamentAPI.start(tournamentId);
      toast.success("Tournament started!");
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start");
    }
  };

  const openResultDialog = (match) => {
    setResultForm({ winner: "", score_a: "", score_b: "" });
    setResultDialog(match);
  };

  const handleSubmitResult = async () => {
    if (!resultForm.winner) return toast.error("Select a winner");
    setSubmitting(true);
    try {
      await tournamentAPI.submitResult(tournamentId, resultDialog.id, {
        winner: resultForm.winner,
        score_a: resultForm.score_a ? parseInt(resultForm.score_a, 10) : null,
        score_b: resultForm.score_b ? parseInt(resultForm.score_b, 10) : null,
      });
      toast.success("Result submitted!");
      setResultDialog(null);
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this tournament?")) return;
    try {
      await tournamentAPI.cancel(tournamentId);
      toast.success("Tournament cancelled");
      navigate("/tournaments");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  // Group matches by round for bracket view
  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const totalRounds = Object.keys(roundsMap).length;
  const roundLabels = (round) => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semi-Final";
    if (round === totalRounds - 2) return "Quarter-Final";
    return `Round ${round}`;
  };

  const TABS = tournament.format === "knockout"
    ? [
        { id: "bracket", label: "Bracket", icon: Swords },
        { id: "participants", label: "Players", icon: Users },
        { id: "info", label: "Info", icon: Trophy },
      ]
    : [
        { id: "standings", label: "Standings", icon: Medal },
        { id: "matches", label: "Matches", icon: Swords },
        { id: "participants", label: "Players", icon: Users },
        { id: "info", label: "Info", icon: Trophy },
      ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-8" data-testid="tournament-detail">
      {/* Back */}
      <button onClick={() => navigate("/tournaments")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Tournaments
      </button>

      {/* Header Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={`text-xs font-bold border ${STATUS_COLORS[tournament.status] || ""}`}>
                {STATUS_LABELS[tournament.status] || tournament.status}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">{tournament.sport?.replace("_", " ")}</Badge>
              <Badge variant="secondary" className="text-xs capitalize">{tournament.format?.replace("_", " ")}</Badge>
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {participants.length}/{tournament.max_participants} players
              </span>
              {tournament.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(tournament.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </span>
              )}
              {tournament.venue_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{tournament.venue_name}
                </span>
              )}
              {tournament.entry_fee > 0 && (
                <span className="font-bold text-primary">Entry: ₹{tournament.entry_fee}</span>
              )}
              {tournament.prize_pool && (
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <Award className="h-3.5 w-3.5" />{tournament.prize_pool}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {tournament.status === "registration" && !isRegistered && !isOrganizer && (
              <Button onClick={handleRegister} className="bg-primary text-primary-foreground font-bold text-xs h-9"
                data-testid="detail-register-btn">
                <UserPlus className="h-4 w-4 mr-1" /> Register
              </Button>
            )}
            {tournament.status === "registration" && isRegistered && (
              <Button variant="outline" onClick={handleWithdraw} className="text-xs h-9"
                data-testid="detail-withdraw-btn">
                <UserMinus className="h-4 w-4 mr-1" /> Withdraw
              </Button>
            )}
            {isOrganizer && tournament.status === "registration" && (
              <Button onClick={handleStart} className="bg-emerald-600 text-white font-bold text-xs h-9"
                data-testid="start-tournament-btn">
                <Play className="h-4 w-4 mr-1" /> Start Tournament
              </Button>
            )}
            {isOrganizer && tournament.status !== "completed" && tournament.status !== "cancelled" && (
              <Button variant="outline" onClick={handleCancel}
                className="text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/30 p-1 rounded-lg w-fit">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ─── Knockout Bracket View ─── */}
      {activeTab === "bracket" && tournament.format === "knockout" && (
        <div className="space-y-4">
          {tournament.status === "registration" ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Bracket will be generated when tournament starts</p>
              <p className="text-xs mt-1">{participants.length} players registered so far</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max">
                {Object.entries(roundsMap)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([round, roundMatches]) => (
                    <div key={round} className="flex flex-col gap-3 min-w-[240px]">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-center mb-1">
                        {roundLabels(parseInt(round))}
                      </h3>
                      {roundMatches.sort((a, b) => a.match_number - b.match_number).map(match => (
                        <MatchCard key={match.id} match={match} nameMap={nameMap}
                          isOrganizer={isOrganizer} onSubmitResult={openResultDialog} />
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Standings Table (Round Robin / League) ─── */}
      {activeTab === "standings" && (
        <div className="space-y-3">
          {standings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Medal className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {tournament.status === "registration" ? "Standings appear after tournament starts" : "No standings yet"}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3 font-mono uppercase">#</th>
                    <th className="text-left p-3 font-mono uppercase">Player</th>
                    <th className="text-center p-3 font-mono uppercase">P</th>
                    <th className="text-center p-3 font-mono uppercase">W</th>
                    <th className="text-center p-3 font-mono uppercase">D</th>
                    <th className="text-center p-3 font-mono uppercase">L</th>
                    <th className="text-center p-3 font-mono uppercase">GF</th>
                    <th className="text-center p-3 font-mono uppercase">GA</th>
                    <th className="text-center p-3 font-mono uppercase">GD</th>
                    <th className="text-center p-3 font-mono uppercase font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, idx) => (
                    <tr key={s.user_id}
                      className={`border-b border-border/50 ${idx === 0 ? "bg-primary/5" : ""}`}>
                      <td className="p-3 font-bold">
                        {idx === 0 && tournament.status === "completed" ? (
                          <Crown className="h-4 w-4 text-amber-400 inline" />
                        ) : idx + 1}
                      </td>
                      <td className="p-3 font-bold">{s.name}</td>
                      <td className="p-3 text-center">{s.played}</td>
                      <td className="p-3 text-center text-emerald-400">{s.won}</td>
                      <td className="p-3 text-center text-muted-foreground">{s.drawn}</td>
                      <td className="p-3 text-center text-destructive">{s.lost}</td>
                      <td className="p-3 text-center">{s.goals_for}</td>
                      <td className="p-3 text-center">{s.goals_against}</td>
                      <td className="p-3 text-center font-medium">{s.goals_for - s.goals_against}</td>
                      <td className="p-3 text-center font-display font-black text-primary text-lg">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Matches List (for round-robin/league) ─── */}
      {activeTab === "matches" && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Matches appear after tournament starts</p>
            </div>
          ) : (
            matches.sort((a, b) => a.match_number - b.match_number).map(match => (
              <MatchCard key={match.id} match={match} nameMap={nameMap}
                isOrganizer={isOrganizer} onSubmitResult={openResultDialog} horizontal />
            ))
          )}
        </div>
      )}

      {/* ─── Participants ─── */}
      {activeTab === "participants" && (
        <div className="space-y-2">
          {participants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No participants yet</p>
            </div>
          ) : (
            participants.map((p, idx) => (
              <motion.div key={p.user_id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass-card rounded-lg p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Rating: {p.rating || 1500} · Joined {new Date(p.registered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                {p.user_id === tournament.organizer_id && (
                  <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">
                    <Crown className="h-2.5 w-2.5 mr-0.5" /> Organizer
                  </Badge>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ─── Info Tab ─── */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-sm">Tournament Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Organizer</span>
                <span className="font-bold">{tournament.organizer_name}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Format</span>
                <span className="font-bold capitalize">{tournament.format?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Sport</span>
                <span className="font-bold capitalize">{tournament.sport?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Max Players</span>
                <span className="font-bold">{tournament.max_participants}</span>
              </div>
              {tournament.entry_fee > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block">Entry Fee</span>
                  <span className="font-bold text-primary">₹{tournament.entry_fee}</span>
                </div>
              )}
              {tournament.prize_pool && (
                <div>
                  <span className="text-xs text-muted-foreground block">Prize Pool</span>
                  <span className="font-bold text-amber-400">{tournament.prize_pool}</span>
                </div>
              )}
              {tournament.registration_deadline && (
                <div>
                  <span className="text-xs text-muted-foreground block">Reg Deadline</span>
                  <span className="font-bold">{new Date(tournament.registration_deadline).toLocaleDateString("en-IN")}</span>
                </div>
              )}
            </div>
            {tournament.rules && (
              <div className="border-t border-border pt-3 mt-3">
                <span className="text-xs text-muted-foreground block mb-1">Rules</span>
                <p className="text-sm whitespace-pre-wrap">{tournament.rules}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Result Submission Dialog ─── */}
      <Dialog open={!!resultDialog} onOpenChange={() => setResultDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> Submit Result
            </DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4 pt-2">
              <div className="text-center text-sm text-muted-foreground mb-2">
                Match #{resultDialog.match_number}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {nameMap[resultDialog.player_a] || "TBD"} Score
                  </Label>
                  <Input type="number" value={resultForm.score_a}
                    onChange={e => setResultForm(p => ({ ...p, score_a: e.target.value }))}
                    className="mt-1 bg-background border-border text-center text-lg font-bold" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {nameMap[resultDialog.player_b] || "TBD"} Score
                  </Label>
                  <Input type="number" value={resultForm.score_b}
                    onChange={e => setResultForm(p => ({ ...p, score_b: e.target.value }))}
                    className="mt-1 bg-background border-border text-center text-lg font-bold" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Winner</Label>
                <div className="space-y-2">
                  {resultDialog.player_a && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: resultDialog.player_a }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_a ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50"}`}>
                      {nameMap[resultDialog.player_a] || "Player A"}
                    </button>
                  )}
                  {resultDialog.player_b && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: resultDialog.player_b }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_b ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50"}`}>
                      {nameMap[resultDialog.player_b] || "Player B"}
                    </button>
                  )}
                  {tournament.format !== "knockout" && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: "draw" }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === "draw" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground hover:border-amber-500/50"}`}>
                      Draw
                    </button>
                  )}
                </div>
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold h-10"
                onClick={handleSubmitResult} disabled={submitting} data-testid="submit-result-btn">
                {submitting ? "Submitting..." : "Submit Result"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Match Card Component ────────────────────────────────────────────────────

function MatchCard({ match, nameMap, isOrganizer, onSubmitResult, horizontal }) {
  const playerA = nameMap[match.player_a] || (match.player_a ? "Unknown" : "TBD");
  const playerB = nameMap[match.player_b] || (match.player_b ? "Unknown" : "TBD");
  const isBye = match.status === "bye";
  const isDone = match.status === "completed";
  const canSubmit = isOrganizer && match.status === "pending" && match.player_a && match.player_b;

  return (
    <div className={`glass-card rounded-lg p-3 ${horizontal ? "" : ""} ${isDone ? "border-primary/20" : ""}`}
      data-testid={`match-${match.id}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Hash className="h-2.5 w-2.5" />{match.match_number}
        </span>
        {isDone && <CheckCircle className="h-3 w-3 text-emerald-400" />}
        {isBye && <Badge className="text-[9px] bg-secondary text-muted-foreground">BYE</Badge>}
      </div>
      {/* Player A */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-md mb-1 text-sm ${match.winner === match.player_a ? "bg-primary/10 font-bold" : ""}`}>
        <span className={`truncate ${!match.player_a ? "text-muted-foreground italic" : ""}`}>
          {playerA}
        </span>
        {isDone && match.score_a !== null && (
          <span className="font-display font-black text-base ml-2">{match.score_a}</span>
        )}
      </div>
      {/* vs divider */}
      <div className="text-[10px] text-center text-muted-foreground font-mono">vs</div>
      {/* Player B */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-md mt-1 text-sm ${match.winner === match.player_b ? "bg-primary/10 font-bold" : ""}`}>
        <span className={`truncate ${!match.player_b ? "text-muted-foreground italic" : ""}`}>
          {playerB}
        </span>
        {isDone && match.score_b !== null && (
          <span className="font-display font-black text-base ml-2">{match.score_b}</span>
        )}
      </div>
      {/* Submit button for organizer */}
      {canSubmit && (
        <button onClick={() => onSubmitResult(match)}
          className="w-full mt-2 py-1.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
          data-testid={`result-btn-${match.id}`}>
          Enter Result
        </button>
      )}
    </div>
  );
}
