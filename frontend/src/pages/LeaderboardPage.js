import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { matchAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Shield, Flame, Medal, Minus } from "lucide-react";

const SPORTS = [
  { value: "all", label: "All Sports" },
  { value: "football", label: "Football" },
  { value: "cricket", label: "Cricket" },
  { value: "badminton", label: "Badminton" },
  { value: "tennis", label: "Tennis" },
  { value: "basketball", label: "Basketball" },
];

function getTier(rating) {
  if (rating >= 2500) return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" };
  if (rating >= 2000) return { label: "Gold", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
  if (rating >= 1500) return { label: "Silver", color: "text-slate-300", bg: "bg-slate-400/10 border-slate-400/20" };
  return { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
}

function getRankIcon(rank) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-400" />;
  return <span className="text-sm font-mono text-muted-foreground w-5 text-center">{rank}</span>;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [sport, setSport] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (sport !== "all") params.sport = sport;
      const res = await matchAPI.leaderboard(params);
      setPlayers(res.data || []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => { loadData(); }, [loadData]);

  const myRank = players.findIndex(p => p.id === user?.id) + 1;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="leaderboard-page">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Rankings</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Leader<span className="text-primary">board</span>
          </h1>
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger className="w-[140px] bg-secondary/50 border-border text-sm" data-testid="sport-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {myRank > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-lg p-4 mb-6 border-primary/30" data-testid="my-rank-card">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-black text-lg">
              #{myRank}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Your Ranking</div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-[10px] ${getTier(user?.skill_rating || 1500).bg} ${getTier(user?.skill_rating || 1500).color} border`}>
                  {getTier(user?.skill_rating || 1500).label}
                </Badge>
                <span className="text-xs text-muted-foreground">{user?.skill_rating || 1500} SR</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {user?.wins || 0}W / {user?.losses || 0}L / {user?.draws || 0}D
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : players.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No ranked players yet</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="leaderboard-list">
          {/* Header */}
          <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="w-8">#</span>
            <span className="flex-1">Player</span>
            <span className="w-16 text-center">Rating</span>
            <span className="w-20 text-center hidden sm:block">Record</span>
            <span className="w-16 text-center hidden sm:block">Games</span>
          </div>

          {players.map((p, i) => {
            const tier = getTier(p.skill_rating);
            const isMe = p.id === user?.id;
            const totalGames = p.wins + p.losses + p.draws;
            const winRate = totalGames > 0 ? Math.round((p.wins / totalGames) * 100) : 0;

            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                data-testid={`leaderboard-row-${p.id}`}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                  isMe ? "glass-card border-primary/30" : "hover:bg-secondary/30"
                } ${i < 3 ? "glass-card" : ""}`}>
                <div className="w-8 flex items-center justify-center">{getRankIcon(p.rank)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-slate-400/20 text-slate-300" : i === 2 ? "bg-orange-500/20 text-orange-400" : "bg-secondary text-muted-foreground"
                    }`}>
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                        {p.name}
                        {isMe && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/30 text-primary">You</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={`text-[9px] h-4 px-1.5 border ${tier.bg} ${tier.color}`}>
                          {tier.label}
                        </Badge>
                        {p.sports?.slice(0, 2).map(s => (
                          <span key={s} className="text-[9px] text-muted-foreground capitalize">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-16 text-center">
                  <div className={`font-display font-bold text-sm ${tier.color}`}>{p.skill_rating}</div>
                </div>
                <div className="w-20 text-center hidden sm:flex items-center justify-center gap-1 text-xs">
                  <span className="text-emerald-400">{p.wins}</span>
                  <Minus className="h-2 w-2 text-muted-foreground" />
                  <span className="text-red-400">{p.losses}</span>
                  <Minus className="h-2 w-2 text-muted-foreground" />
                  <span className="text-muted-foreground">{p.draws}</span>
                </div>
                <div className="w-16 text-center hidden sm:block">
                  <div className="text-xs text-muted-foreground">{totalGames} games</div>
                  {totalGames > 0 && <div className="text-[10px] text-muted-foreground/60">{winRate}% win</div>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
