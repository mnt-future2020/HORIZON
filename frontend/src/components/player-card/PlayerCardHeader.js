import { motion } from "framer-motion";
import {
  User,
  BadgeCheck,
  MapPin,
  ChevronDown,
  Award,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function PlayerCardHeader({
  card,
  coachData,
  currentUser,
  isFollowing,
  handleFollow,
  navigate,
  tier,
  onShowFollowers,
  onShowFollowing,
  onTabChange,
}) {
  return (
    <div className="bg-background pt-4 sm:pt-5 pb-6 border-b border-border/10 relative overflow-hidden">
      {/* Branded Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[100px] -z-10 pointer-events-none" />

      {/* Header Content */}
      <div className="px-4">
        <div className="flex items-center gap-4 sm:gap-12 py-4 sm:py-6">
          {/* Enhanced Avatar with Branded Ring */}
          <div className="relative shrink-0">
            <div
              className={`h-20 w-20 sm:h-28 sm:w-28 rounded-full p-[2px] ${card.is_verified ? "bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600" : "border-2 border-border/40"}`}
            >
              <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center p-[2px] bg-background">
                {/* Use shared Avatar component for consistent fallbacks */}
                <Avatar className="h-full w-full">
                  {card.avatar && (
                    <AvatarImage src={mediaUrl(card.avatar)} alt={card.name} />
                  )}
                  <AvatarFallback>
                    <User className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            {card.is_verified && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                <BadgeCheck className="h-5 w-5 text-brand-500 fill-brand-500/10" />
              </div>
            )}
          </div>

          {/* Stats — 3 items on mobile (streak moves to name row), 4 on desktop */}
          <div className="flex-1 flex justify-around sm:justify-start sm:gap-12 items-center">
            <button onClick={() => onTabChange?.("posts")} className="flex flex-col items-center sm:items-start group cursor-pointer touch-manipulation">
              <span className="font-bold text-lg sm:text-2xl tracking-tighter tabular-nums text-foreground group-hover:text-brand-500 transition-colors">
                {card.post_count || 0}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-muted-foreground/60 mt-0.5">
                Posts
              </span>
            </button>
            <button onClick={onShowFollowers} className="flex flex-col items-center sm:items-start group cursor-pointer touch-manipulation">
              <span className="font-bold text-lg sm:text-2xl tracking-tighter tabular-nums text-foreground group-hover:text-brand-500 transition-colors">
                {card.followers_count || 0}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-muted-foreground/60 mt-0.5">
                Followers
              </span>
            </button>
            <button onClick={onShowFollowing} className="flex flex-col items-center sm:items-start group cursor-pointer touch-manipulation">
              <span className="font-bold text-lg sm:text-2xl tracking-tighter tabular-nums text-foreground group-hover:text-brand-500 transition-colors">
                {card.following_count || 0}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-muted-foreground/60 mt-0.5">
                Following
              </span>
            </button>

            {/* Streak — hidden on mobile (shown inline with name below), visible on sm+ */}
            {card.current_streak > 0 && (
              <button onClick={() => onTabChange?.("stats")} className="hidden sm:flex flex-col items-start group cursor-pointer touch-manipulation">
                <div className="flex items-center gap-1 font-black text-2xl tracking-tighter tabular-nums text-[#FF6B00] group-hover:scale-110 transition-transform drop-shadow-[0_0_12px_rgba(255,107,0,0.3)]">
                  <Flame className="h-5 w-5 fill-[#FF6B00]/20" />
                  {card.current_streak}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6B00]/70">
                  Streak
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Name & Bio - Optimized for Impact */}
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="font-bold text-lg sm:text-xl tracking-tight leading-none text-foreground">
              {card.name}
            </h1>
            {/* Streak pill — mobile only, inline with name */}
            {card.current_streak > 0 && (
              <button onClick={() => onTabChange?.("stats")} className="sm:hidden flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/20 cursor-pointer touch-manipulation">
                <Flame className="h-3 w-3 text-[#FF6B00] fill-[#FF6B00]/20" />
                <span className="text-[10px] font-black text-[#FF6B00]">
                  {card.current_streak}
                </span>
              </button>
            )}
            {tier && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
                <Award className="h-3 w-3 text-brand-500" />
                <span className="text-[9px] font-black uppercase tracking-tighter text-brand-500">
                  {tier.name}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
            <span className="text-xs font-semibold text-muted-foreground/80">
              {card.role === "coach"
                ? "Athletic Coach"
                : "Professional Athlete"}
            </span>
            {card.primary_sport && card.primary_sport !== "none" && (
              <>
                <span className="h-3 w-px bg-border/40" />
                <span className="text-xs font-bold text-brand-500 uppercase tracking-wide">
                  {card.primary_sport}
                </span>
              </>
            )}
          </div>

          <div className="text-[13px] leading-relaxed text-muted-foreground/90 whitespace-pre-wrap max-w-lg mb-2">
            {card.bio ||
              (card.role === "coach"
                ? "Certified Athletic Performance Specialist. Elevating professional athletes through strategic data-driven coaching."
                : `High-octane ${card.primary_sport || "multi-sport"} athlete currently ranked ${card.skill_rating || "N/A"}. Focused on peak performance and competitive excellence.`)}
          </div>

          {card.role === "coach" && coachData?.city && (
            <div className="flex items-center gap-1.5 mb-6 text-[11px] font-bold text-brand-500 uppercase tracking-tight">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {coachData.city}
                {coachData.coaching_venue
                  ? ` · ${coachData.coaching_venue}`
                  : ""}
              </span>
            </div>
          )}

          {/* Premium Actions */}
          <div className="flex gap-2 sm:max-w-sm mt-1">
            {card.user_id !== currentUser?.id ? (
              <>
                <Button
                  onClick={handleFollow}
                  className={`flex-1 h-9 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300
                    ${
                      !isFollowing
                        ? "bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/25"
                        : "bg-secondary/40 text-foreground hover:bg-secondary/60"
                    }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                <Button
                  onClick={() => navigate(`/chat?user=${card.user_id}`)}
                  variant="secondary"
                  className="flex-1 h-9 rounded-lg font-bold text-xs uppercase tracking-widest bg-secondary/40 hover:bg-secondary/60"
                >
                  Message
                </Button>
                {card.role === "coach" && (
                  <Button
                    variant="secondary"
                    className="w-9 h-9 p-0 flex items-center justify-center rounded-lg bg-secondary/40 hover:bg-secondary/60"
                    onClick={() =>
                      document
                        .getElementById("coach-book-section")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  className="flex-1 h-9 rounded-lg font-bold text-xs uppercase tracking-widest bg-secondary/40 hover:bg-secondary/60"
                  onClick={() => navigate("/profile?tab=info&edit=true")}
                >
                  Edit profile
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 h-9 rounded-lg font-bold text-xs uppercase tracking-widest bg-secondary/40 hover:bg-secondary/60"
                  onClick={async () => {
                    const url = `${window.location.origin}/player-card/${card.user_id}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: `${card.name} — Player Card`, url });
                      } catch {}
                    } else {
                      try {
                        await navigator.clipboard.writeText(url);
                        const { toast } = await import("sonner");
                        toast.success("Profile link copied!");
                      } catch {}
                    }
                  }}
                >
                  Share profile
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
