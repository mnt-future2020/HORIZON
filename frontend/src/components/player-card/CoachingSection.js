import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  MapPin,
  Star,
  Users,
  Briefcase,
  Trophy,
  Award,
  BadgeCheck,
  CheckCircle2,
  Package,
  Calendar,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function CoachingSection({
  card,
  coachData,
  coachPackages,
  isOwnProfile,
  subscribing,
  onSubscribe,
  selectedDate,
  selectedSlot,
  coachSlots,
  slotsLoading,
  bookingSport,
  bookingNotes,
  booking,
  onDateChange,
  onSlotSelect,
  onSportSelect,
  onNotesChange,
  onBook,
}) {
  const next14 = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
          value: d.toISOString().slice(0, 10),
          day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
            d,
          ),
          date: d.getDate(),
          month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(
            d,
          ),
          isToday: i === 0,
        };
      }),
    [],
  );

  const slotSports = useMemo(() => {
    if (selectedSlot?.sports?.length > 0) return selectedSlot.sports;
    return coachData?.coaching_sports || [];
  }, [selectedSlot, coachData]);

  if (card.role !== "coach" || !coachData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="mt-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display font-bold text-sm">Coaching Profile</h3>
      </div>

      {/* Bio + price */}
      {(coachData.coaching_bio ||
        coachData.city ||
        coachData.coaching_sports?.length > 0) && (
        <div className="rounded-[24px] border border-border/40 bg-card p-4 mb-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              {coachData.coaching_bio && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                  {coachData.coaching_bio}
                </p>
              )}
              {coachData.city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {coachData.city}
                  {coachData.coaching_venue && (
                    <span> · {coachData.coaching_venue}</span>
                  )}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-xl text-brand-500">
                ₹{coachData.session_price || 500}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {coachData.session_duration_minutes || 60} min
              </p>
            </div>
          </div>
          {coachData.coaching_sports?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {coachData.coaching_sports.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[10px] capitalize font-bold"
                >
                  {s.replace("_", " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coach Stats */}
      {(coachData.coaching_rating > 0 ||
        coachData.total_sessions > 0 ||
        coachData.years_of_experience > 0) && (
        <div className="flex gap-3 mb-4">
          {coachData.coaching_rating > 0 && (
            <div className="rounded-xl border border-border/40 bg-card p-3 text-center flex-1">
              <Star className="h-4 w-4 mx-auto mb-1 text-brand-500" />
              <p className="font-black text-base text-brand-500">
                {Number(coachData.coaching_rating).toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">Rating</p>
            </div>
          )}
          {coachData.total_sessions > 0 && (
            <div className="rounded-xl border border-border/40 bg-card p-3 text-center flex-1">
              <Users className="h-4 w-4 mx-auto mb-1 text-brand-500" />
              <p className="font-black text-base text-brand-500">
                {coachData.total_sessions}
              </p>
              <p className="text-[10px] text-muted-foreground">Sessions</p>
            </div>
          )}
          {coachData.years_of_experience > 0 && (
            <div className="rounded-xl border border-border/40 bg-card p-3 text-center flex-1">
              <Briefcase className="h-4 w-4 mx-auto mb-1 text-brand-500" />
              <p className="font-black text-base text-brand-500">
                {coachData.years_of_experience}+
              </p>
              <p className="text-[10px] text-muted-foreground">Yrs Exp</p>
            </div>
          )}
        </div>
      )}

      {/* Details (Specializations, Achievements, Awards, Certs) */}
      <div className="space-y-4 mb-4">
        {coachData.specializations?.length > 0 && (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Specializations
            </h4>
            <div className="flex flex-wrap gap-2">
              {coachData.specializations.map((s, i) => (
                <Badge
                  key={i}
                  className="bg-brand-500/10 text-brand-500 border border-brand-500/20 text-xs font-medium"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {coachData.achievements?.length > 0 && (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Achievements
            </h4>
            <div className="space-y-2">
              {coachData.achievements.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Trophy className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    {typeof a === "string" ? a : a.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {coachData.awards?.length > 0 && (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Awards
            </h4>
            <div className="space-y-2">
              {coachData.awards.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    {typeof a === "string" ? a : a.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {coachData.certifications_list?.length > 0 && (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Certifications
            </h4>
            <div className="space-y-2">
              {coachData.certifications_list.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <BadgeCheck className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    {typeof c === "string" ? c : c.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {coachData.playing_history && (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Playing History
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {coachData.playing_history}
            </p>
          </div>
        )}
      </div>

      {/* Packages */}
      {coachPackages.length > 0 && (
        <div className="rounded-[20px] border border-border bg-card p-4 mb-4">
          <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Coaching Packages
          </h4>
          <div className="space-y-3">
            {coachPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`rounded-[24px] border p-3 transition-all ${pkg.subscribed ? "border-brand-500/30 bg-brand-500/5" : "border-border/40 bg-secondary/20"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pkg.sessions_per_month} sessions ·{" "}
                      {pkg.duration_minutes || 60} min each
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-base text-brand-500">
                      ₹{(pkg.price || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/month</p>
                  </div>
                </div>
                {pkg.description && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {pkg.description}
                  </p>
                )}
                {!isOwnProfile &&
                  (pkg.subscribed ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/10">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                      <span className="text-xs font-bold text-brand-500">
                        {pkg.sessions_remaining} sessions remaining
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSubscribe(pkg)}
                      disabled={subscribing}
                      className="w-full h-9 rounded-lg bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-brand-600 transition-[background-color,opacity] disabled:opacity-60"
                    >
                      {subscribing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
                      Subscribe · ₹{(pkg.price || 0).toLocaleString()}/mo
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inline Book a Session ── */}
      {!isOwnProfile && (
        <div
          id="coach-book-section"
          className="rounded-[24px] border border-brand-500/20 bg-card p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-500" />
              <h4 className="font-bold text-sm">Book a Session</h4>
            </div>
            <span className="font-black text-brand-500">
              ₹{coachData.session_price || 500}
              <span className="text-[10px] text-muted-foreground font-normal">
                {" "}
                / {coachData.session_duration_minutes || 60} min
              </span>
            </span>
          </div>

          {/* Date strip */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Select Date
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
            {next14.map((d) => (
              <button
                key={d.value}
                onClick={() => onDateChange(d.value)}
                className={`flex flex-col items-center shrink-0 w-[50px] py-2 rounded-xl border transition-[background-color,border-color,color] ${
                  selectedDate === d.value
                    ? "border-brand-500 bg-brand-500/10 text-brand-500"
                    : "border-border/40 bg-background/50 hover:border-brand-500/40"
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase ${selectedDate === d.value ? "text-brand-500" : "text-muted-foreground"}`}
                >
                  {d.day}
                </span>
                <span className="text-base font-black leading-tight">
                  {d.date}
                </span>
                <span
                  className={`text-[10px] ${selectedDate === d.value ? "text-brand-500/70" : "text-muted-foreground"}`}
                >
                  {d.month}
                </span>
                {d.isToday && (
                  <span className="text-[8px] font-bold text-brand-500 mt-0.5">
                    Today
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Slots */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Available Slots
          </p>
          {slotsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          ) : coachSlots.length === 0 ? (
            <div className="flex flex-col items-center py-8 rounded-xl bg-secondary/20 border border-dashed border-border mb-4">
              <Calendar className="h-7 w-7 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-bold text-muted-foreground">
                No slots on this day
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a different date
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {coachSlots.map((slot) => (
                <button
                  key={slot.start_time}
                  onClick={() => {
                    if (slot.available) onSlotSelect(slot);
                  }}
                  disabled={!slot.available}
                  className={`flex flex-col items-center px-2 py-3 rounded-xl border text-xs font-bold transition-[background-color,border-color,color] ${
                    selectedSlot?.start_time === slot.start_time
                      ? "border-brand-500 bg-brand-500/10 text-brand-500"
                      : slot.available
                        ? "border-border/40 bg-background hover:border-brand-500/50 hover:bg-brand-500/5"
                        : "border-border/20 bg-secondary/20 text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  <span className={slot.available ? "" : "line-through"}>
                    {slot.start_time}
                  </span>
                  <span
                    className={`text-[10px] font-normal mt-0.5 ${selectedSlot?.start_time === slot.start_time ? "text-brand-500/70" : "text-muted-foreground"}`}
                  >
                    {slot.end_time}
                  </span>
                  {!slot.available && (
                    <span className="text-[10px] text-red-400/70 mt-0.5">
                      Booked
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Sport + Notes */}
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 mb-4"
            >
              {slotSports.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {slotSports.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSportSelect(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize transition-[background-color,border-color,color] ${
                        bookingSport === s
                          ? "border-brand-500 bg-brand-500/10 text-brand-500"
                          : "border-border/40 hover:border-brand-500/40"
                      }`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              ) : slotSports.length === 1 ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/8 border border-brand-500/20 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0" />
                  <span className="text-sm font-bold capitalize text-brand-500">
                    {slotSports[0].replace("_", " ")}
                  </span>
                </div>
              ) : null}
              <Input
                value={bookingNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="What do you want to work on? (optional)…"
                className="bg-background border-border text-sm"
              />
            </motion.div>
          )}

          {/* Summary */}
          {selectedSlot && (
            <div className="flex items-center justify-between text-xs mb-3 px-1">
              <span className="text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  day: "numeric",
                  month: "short",
                }).format(new Date(selectedDate))}
                {" · "}
                {selectedSlot.start_time}–{selectedSlot.end_time}
                {bookingSport && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="capitalize">
                      {bookingSport.replace("_", " ")}
                    </span>
                  </>
                )}
              </span>
              <span className="font-black text-brand-500">
                ₹{coachData.session_price || 500}
              </span>
            </div>
          )}

          {/* Confirm */}
          <button
            disabled={!selectedSlot || booking}
            onClick={onBook}
            className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              selectedSlot && !booking
                ? "bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            } transition-[background-color,border-color,color,box-shadow]`}
          >
            {booking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
              </>
            ) : selectedSlot ? (
              <>Confirm Booking · ₹{coachData.session_price || 500}</>
            ) : (
              "Select a slot to book"
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
