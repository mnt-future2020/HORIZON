import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export function OverallScoreCard({ playerCard, userId }) {
  const navigate = useNavigate();

  if (!playerCard?.overall_score) return null;

  const getScoreColor = (score) => {
    if (score >= 86) return "text-amber-400";
    if (score >= 71) return "text-violet-400";
    if (score >= 51) return "text-brand-400";
    if (score >= 31) return "text-blue-400";
    return "text-muted-foreground";
  };

  const getBadgeColor = (score) => {
    if (score >= 86) return "bg-amber-400/20 text-amber-400";
    if (score >= 71) return "bg-violet-400/20 text-violet-400";
    if (score >= 51) return "bg-brand-400/20 text-brand-400";
    if (score >= 31) return "bg-blue-400/20 text-blue-400";
    return "bg-muted text-muted-foreground";
  };

  const getHelpText = (score) => {
    if (score < 20) return "Play matches to start leveling up";
    if (score < 35) return "Keep playing to improve your stats";
    return "Almost Intermediate! Keep it up";
  };

  return (
    <div className="flex items-center gap-4 mt-4 p-4 rounded-xl bg-background/50">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className="text-muted-foreground/20"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="7"
            strokeDasharray={`${playerCard.overall_score * 2.64} 264`}
            strokeLinecap="round"
            className={getScoreColor(playerCard.overall_score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-black">{playerCard.overall_score}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="font-display text-sm font-black">Overall Score</div>
          <button
            onClick={() => navigate(`/lobbian/${userId}`)}
            className="p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
            title="View full breakdown & how to level up"
            aria-label="View score breakdown"
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </button>
        </div>
        <Badge className={`text-[10px] mt-1 ${getBadgeColor(playerCard.overall_score)}`}>
          {playerCard.overall_tier}
        </Badge>
        {playerCard.overall_score < 50 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {getHelpText(playerCard.overall_score)}
          </p>
        )}
      </div>
    </div>
  );
}
