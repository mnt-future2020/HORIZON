import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { highlightAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, Clock, Zap, Trophy, Target, AlertTriangle, Flag, ChevronRight, Loader2, Video, ArrowLeft } from "lucide-react";

const SIGNIFICANCE_ICONS = {
  goal: Trophy, save: Target, rally: Zap, foul: AlertTriangle,
  celebration: Sparkles, turning_point: Flag, skill_move: Zap, other: ChevronRight,
};

const SIGNIFICANCE_COLORS = {
  goal: "text-amber-400 bg-amber-500/15", save: "text-sky-400 bg-sky-500/15",
  rally: "text-violet-400 bg-violet-500/15", foul: "text-red-400 bg-red-500/15",
  celebration: "text-emerald-400 bg-emerald-500/15", turning_point: "text-orange-400 bg-orange-500/15",
  skill_move: "text-cyan-400 bg-cyan-500/15", other: "text-muted-foreground bg-secondary/50",
};

export default function SharedHighlightPage() {
  const { shareId } = useParams();
  const [highlight, setHighlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    highlightAPI.getShared(shareId)
      .then(res => setHighlight(res.data))
      .catch(() => setError("Highlight not found or no longer shared"))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (error || !highlight) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center" data-testid="shared-error">
      <Video className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{error || "Not found"}</p>
      <Link to="/"><Button variant="outline" size="sm" className="mt-4 text-xs"><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Go Home</Button></Link>
    </div>
  );

  const a = highlight.analysis || {};
  return (
    <div className="min-h-screen bg-background" data-testid="shared-highlight-page">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="text-center mb-8">
          <Badge className="bg-primary/15 text-primary border border-primary/20 text-xs mb-3">Shared Highlight</Badge>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{highlight.title}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            By {highlight.user_name} &bull; {new Date(highlight.created_at).toLocaleDateString()}
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {a.sport_detected && <Badge className="bg-primary/15 text-primary border border-primary/20 text-xs">{a.sport_detected}</Badge>}
            {a.duration_estimate && <Badge className="bg-secondary/50 text-muted-foreground text-xs flex items-center gap-1"><Clock className="h-3 w-3" />{a.duration_estimate}</Badge>}
            {a.match_intensity && <Badge className={`text-xs ${a.match_intensity === "intense" || a.match_intensity === "high" ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-400"}`}>{a.match_intensity}</Badge>}
          </div>
        </div>

        {a.summary && (
          <div className="glass-card rounded-xl p-5 mb-6" data-testid="shared-summary">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Match Summary</span>
            <p className="text-sm mt-2 leading-relaxed">{a.summary}</p>
            {a.players_observed && <p className="text-xs text-muted-foreground mt-2">Lobbians: {a.players_observed}</p>}
          </div>
        )}

        {a.key_moments?.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Key Moments
            </h3>
            <div className="space-y-2">
              {a.key_moments.map((m, i) => {
                const IconComp = SIGNIFICANCE_ICONS[m.significance] || ChevronRight;
                const color = SIGNIFICANCE_COLORS[m.significance] || SIGNIFICANCE_COLORS.other;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }} className="glass-card rounded-lg p-3 flex items-start gap-3">
                    <div className="shrink-0 h-9 w-16 rounded-md bg-background flex items-center justify-center">
                      <span className="text-xs font-mono font-bold text-primary">{m.timestamp}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{m.description}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${color}`}>
                        <IconComp className="h-3 w-3" /> {m.significance?.replace("_", " ")}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">Powered by <span className="text-primary font-bold">Horizon</span> AI Match Analysis</p>
          <Link to="/"><Button variant="outline" size="sm" className="mt-3 text-xs"><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Go to Horizon</Button></Link>
        </div>
      </div>
    </div>
  );
}
