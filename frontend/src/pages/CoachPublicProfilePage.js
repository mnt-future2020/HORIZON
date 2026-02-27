import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { coachingAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star, MapPin, Clock, IndianRupee, Award, BadgeCheck,
  CheckCircle2, ArrowLeft, Users, Loader2, GraduationCap,
  Trophy, Briefcase, ChevronRight, Package, Calendar,
  MessageCircle,
} from "lucide-react";

const COACH_PLACEHOLDER = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StatPill({ icon: Icon, label, value, color = "text-primary" }) {
  return (
    <div className="glass-card rounded-xl p-3 text-center flex-1 min-w-[72px]">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <p className={`font-black text-base leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor = "text-primary", title, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span>{title}</span>
      </h3>
      {children}
    </motion.div>
  );
}

function CredentialItem({ icon: Icon, iconColor, text, image }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 ${iconColor}`}><Icon className="h-4 w-4" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{text}</p>
        {image && (
          <img src={mediaUrl(image)} alt="proof"
            className="mt-1.5 h-16 w-24 rounded-lg object-cover border border-border" />
        )}
      </div>
    </div>
  );
}

export default function CoachPublicProfilePage() {
  const { coachId } = useParams();
  const navigate = useNavigate();
  const [coach, setCoach] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coachId) return;
    setLoading(true);
    Promise.all([
      coachingAPI.getCoach(coachId),
      coachingAPI.getCoachPackages ? coachingAPI.getCoachPackages(coachId) : Promise.resolve({ data: [] }),
    ])
      .then(([coachRes, pkgRes]) => {
        setCoach(coachRes.data);
        setPackages(pkgRes.data || []);
      })
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [coachId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!coach) return null;

  const avgRating = coach.coaching_rating || coach.avg_rating || 0;
  const totalSessions = coach.total_sessions || 0;
  const totalReviews = coach.total_reviews || 0;
  const yearsExp = coach.years_of_experience || 0;

  // Availability grouped by day
  const availSlots = coach.availability || [];
  const slotsByDay = {};
  availSlots.forEach(s => {
    if (!slotsByDay[s.day_of_week]) slotsByDay[s.day_of_week] = [];
    slotsByDay[s.day_of_week].push(s);
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">

      {/* ── Back button ── */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* ── Hero Card ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl overflow-hidden">
        {/* Cover strip */}
        <div className="h-20 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
        <div className="px-5 pb-5 -mt-10">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-card bg-secondary shrink-0">
              <img src={mediaUrl(coach.avatar) || COACH_PLACEHOLDER} alt={coach.name}
                className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl font-black truncate">{coach.name}</h1>
                {coach.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
              {coach.city && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />{coach.city}
                  {coach.coaching_venue && <span className="text-muted-foreground/60"> · {coach.coaching_venue}</span>}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 pb-1">
              <p className="font-black text-xl text-primary">₹{coach.session_price || 500}</p>
              <p className="text-[10px] text-muted-foreground">{coach.session_duration_minutes || 60} min</p>
            </div>
          </div>

          {/* Bio */}
          {coach.coaching_bio && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{coach.coaching_bio}</p>
          )}

          {/* Sports */}
          {coach.coaching_sports?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {coach.coaching_sports.map(s => (
                <Badge key={s} variant="secondary" className="text-[10px] capitalize font-bold">
                  {s.replace("_", " ")}
                </Badge>
              ))}
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-2">
            <Button className="flex-1 bg-primary text-primary-foreground font-bold"
              onClick={() => navigate("/coaching")}>
              <Calendar className="h-4 w-4 mr-1.5" /> Book a Session
            </Button>
            <Button variant="outline" className="font-bold flex-1"
              onClick={() => navigate("/coaching")}>
              <Package className="h-4 w-4 mr-1.5" /> View Packages
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Row ── */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {avgRating > 0 && (
          <StatPill icon={Star} label="Rating" value={avgRating.toFixed(1)} color="text-amber-400" />
        )}
        {totalSessions > 0 && (
          <StatPill icon={Users} label="Sessions" value={totalSessions} />
        )}
        {totalReviews > 0 && (
          <StatPill icon={MessageCircle} label="Reviews" value={totalReviews} color="text-sky-400" />
        )}
        {yearsExp > 0 && (
          <StatPill icon={Briefcase} label="Yrs Exp" value={`${yearsExp}+`} color="text-violet-400" />
        )}
      </div>

      {/* ── Specializations ── */}
      {coach.specializations?.length > 0 && (
        <SectionCard icon={GraduationCap} title="Specializations">
          <div className="flex flex-wrap gap-2">
            {coach.specializations.map((s, i) => (
              <Badge key={i} className="bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
                {s}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Achievements ── */}
      {coach.achievements?.length > 0 && (
        <SectionCard icon={Trophy} iconColor="text-amber-500" title="Achievements">
          <div className="space-y-2">
            {coach.achievements.map((a, i) => (
              <CredentialItem key={i} icon={CheckCircle2} iconColor="text-primary"
                text={typeof a === "string" ? a : a.text}
                image={typeof a === "object" ? a.image : null} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Awards ── */}
      {coach.awards?.length > 0 && (
        <SectionCard icon={Award} iconColor="text-amber-500" title="Awards">
          <div className="space-y-2">
            {coach.awards.map((a, i) => (
              <CredentialItem key={i} icon={Award} iconColor="text-amber-500"
                text={typeof a === "string" ? a : a.text}
                image={typeof a === "object" ? a.image : null} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Certifications ── */}
      {coach.certifications_list?.length > 0 && (
        <SectionCard icon={BadgeCheck} iconColor="text-sky-500" title="Certifications">
          <div className="space-y-2">
            {coach.certifications_list.map((c, i) => (
              <CredentialItem key={i} icon={BadgeCheck} iconColor="text-sky-500"
                text={typeof c === "string" ? c : c.text}
                image={typeof c === "object" ? c.image : null} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Playing History ── */}
      {coach.playing_history && (
        <SectionCard icon={Briefcase} iconColor="text-violet-400" title="Playing History">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {coach.playing_history}
          </p>
        </SectionCard>
      )}

      {/* ── Availability ── */}
      {Object.keys(slotsByDay).length > 0 && (
        <SectionCard icon={Calendar} title="Availability">
          <div className="space-y-2">
            {Object.entries(slotsByDay).map(([dayIdx, slots]) => (
              <div key={dayIdx} className="flex items-center gap-3">
                <span className="w-10 text-xs font-bold text-muted-foreground">{DAY_SHORT[parseInt(dayIdx)]}</span>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s, i) => (
                    <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {s.start_time} – {s.end_time}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Packages ── */}
      {packages.length > 0 && (
        <SectionCard icon={Package} title="Coaching Packages">
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.id} className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm truncate">{pkg.name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{pkg.type || "monthly"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pkg.sessions_per_month} sessions · {pkg.duration_minutes || 60} min each
                  </p>
                  {pkg.features?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pkg.features.map(f => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15">✓ {f}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg text-primary">₹{(pkg.price || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{pkg.type === "quarterly" ? "/quarter" : pkg.type === "one_time" ? "one-time" : "/month"}</p>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full bg-primary text-primary-foreground font-bold mt-1"
            onClick={() => navigate("/coaching")}>
            Book Now <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </SectionCard>
      )}

      {/* ── Reviews ── */}
      {avgRating > 0 && (
        <div className="glass-card rounded-2xl p-5 text-center">
          <div className="flex justify-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-5 w-5 ${i <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            ))}
          </div>
          <p className="font-black text-2xl text-amber-400">{avgRating.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">{totalReviews} review{totalReviews !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border sm:hidden z-40">
        <Button className="w-full bg-primary text-primary-foreground font-bold h-12 text-base"
          onClick={() => navigate("/coaching")}>
          <Calendar className="h-5 w-5 mr-2" /> Book a Session with {coach.name.split(" ")[0]}
        </Button>
      </motion.div>
    </div>
  );
}
