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
    <div className="flex items-center gap-5 mt-6 p-5 sm:p-6 rounded-2xl bg-background border border-border hover:border-brand-400 dark:hover:border-brand-600 transition-colors">
      <div className="relative w-20 h-20 shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted-foreground/10"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="6"
            strokeDasharray={`${playerCard.overall_score * 2.64} 264`}
            strokeLinecap="round"
            className={`${getScoreColor(playerCard.overall_score)} transition-all duration-500`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-2xl font-bold ${getScoreColor(playerCard.overall_score)}`}>
            {playerCard.overall_score}
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="font-display text-base sm:text-lg font-bold">Overall Score</div>
          <button
            onClick={() => navigate(`/lobbian/${userId}`)}
            className="p-1.5 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 touch-manipulation"
            title="View full breakdown & how to level up"
            aria-label="View score breakdown"
          >
            <Info className="h-4 w-4 text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors" aria-hidden="true" />
          </button>
        </div>
        <Badge className={`text-[11px] font-semibold uppercase tracking-wider px-3 py-1 ${getBadgeColor(playerCard.overall_score)}`}>
          {playerCard.overall_tier}
        </Badge>
        {playerCard.overall_score < 50 && (
          <p className="text-xs text-muted-foreground mt-2">
            {getHelpText(playerCard.overall_score)}
          </p>
        )}
      </div>
    </div>
  );
}
