import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin, Swords, GraduationCap, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const journeys = [
  {
    id: "players",
    icon: MapPin,
    title: "FOR PLAYERS",
    subtitle: "Book venues, find games, track your stats",
    accentColor: "text-turf-accent",
    steps: [
      { step: "01", title: "DISCOVER VENUES", detail: "Search by sport, location, or GPS. See ratings, prices & live slot availability.", time: "30 sec" },
      { step: "02", title: "BOOK & SPLIT", detail: "Select a slot, pay solo or split 2–22 ways with a shareable link. QR code for check-in.", time: "2 min" },
      { step: "03", title: "PLAY & RATE", detail: "Show up, scan QR, play your game. Leave a review and build your profile.", time: "1 hour" },
      { step: "04", title: "TRACK PROGRESS", detail: "View your player card, skill rating, win rate, tournament performance & badges.", time: "Always" },
    ],
  },
  {
    id: "matchmaking",
    icon: Swords,
    title: "MATCHMAKING",
    subtitle: "Find opponents & climb the leaderboard",
    accentColor: "text-turf-accent",
    steps: [
      { step: "01", title: "CREATE OR JOIN", detail: "Post a match with sport, time, venue and skill range — or browse open games.", time: "1 min" },
      { step: "02", title: "AI TEAM BALANCING", detail: "Once filled, AI suggests balanced teams based on Glicko-2 ratings.", time: "Instant" },
      { step: "03", title: "SUBMIT RESULTS", detail: "After playing, submit the score. Other players confirm via majority vote.", time: "1 min" },
      { step: "04", title: "RATINGS UPDATE", detail: "Skill ratings automatically adjust. Climb from Bronze to Diamond on the leaderboard.", time: "Instant" },
    ],
  },
  {
    id: "coaching",
    icon: GraduationCap,
    title: "COACHING",
    subtitle: "Find coaches or run your academy",
    accentColor: "text-turf-accent",
    steps: [
      { step: "01", title: "FIND A COACH", detail: "Browse coaches by sport, rating, and price. View their available time slots.", time: "1 min" },
      { step: "02", title: "BOOK SESSION", detail: "Select a slot, pay via Razorpay, get a QR code for session check-in.", time: "2 min" },
      { step: "03", title: "TRAIN & IMPROVE", detail: "Coach scans QR, marks attendance. Session performance auto-recorded.", time: "1 hour" },
      { step: "04", title: "TRACK & SUBSCRIBE", detail: "View progress over time. Subscribe to monthly coaching packages for regular training.", time: "Ongoing" },
    ],
  },
  {
    id: "tournaments",
    icon: Trophy,
    title: "TOURNAMENTS",
    subtitle: "Compete in organized competitions",
    accentColor: "text-turf-accent",
    steps: [
      { step: "01", title: "BROWSE & REGISTER", detail: "Find tournaments by sport. See format, prize pool, and entry fee. Pay to register.", time: "2 min" },
      { step: "02", title: "AUTO BRACKETS", detail: "Organizer starts — brackets auto-generated. Knockout, Round Robin, or League.", time: "Instant" },
      { step: "03", title: "LIVE SCORING", detail: "Real-time score updates via WebSocket. Spectators watch live on their phones.", time: "Real-time" },
      { step: "04", title: "WIN & EARN", detail: "Results sync to bracket. Performance records created. Prize pool distributed.", time: "Post-match" },
    ],
  },
];

export default function HowItWorksSection() {
  const [activeJourney, setActiveJourney] = useState("players");

  return (
    <div id="how-it-works" className="w-full bg-[#111111] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="flex flex-col">
            <h2 className="font-oswald text-4xl md:text-6xl font-bold uppercase leading-none text-white tracking-tighter">
              HOW IT
            </h2>
            <h1 className="font-brier text-5xl text-zinc-400 leading-none md:-mt-2 md:text-7xl mt-2.5">Works</h1>
          </div>
          <p className="text-zinc-500 text-sm md:text-base max-w-xs md:text-right font-medium">
            Four ways to use Lobbi — whether you're a player, coach, venue owner, or competitor.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {journeys.map((journey) => {
            const Icon = journey.icon;
            const isActive = activeJourney === journey.id;

            return (
              <div key={journey.id} className="border-b border-white/10 last:border-none">
                <button
                  onClick={() => setActiveJourney(isActive ? null : journey.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 md:p-6 transition-all duration-300 ease-out group",
                    isActive
                      ? "bg-turf-accent text-black"
                      : "bg-transparent text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <ChevronDown
                      className={cn(
                        "w-6 h-6 md:w-8 md:h-8 transition-transform duration-300",
                        isActive ? "rotate-180 text-black" : "text-white -rotate-90"
                      )}
                    />
                    <Icon className={cn(
                      "w-6 h-6 md:w-8 md:h-8 transition-colors",
                      isActive ? "text-black" : "text-turf-accent"
                    )} />
                    <div className="text-left">
                      <span className="font-oswald font-bold text-3xl md:text-5xl tracking-tighter leading-none block">
                        {journey.title}
                      </span>
                      <span className={cn(
                        "text-xs md:text-sm font-medium mt-1 block",
                        isActive ? "text-black/60" : "text-white/40"
                      )}>
                        {journey.subtitle}
                      </span>
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden bg-zinc-900/30"
                    >
                      <div className="grid grid-cols-12 gap-4 py-4 px-6 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/10">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Step</div>
                        <div className="col-span-5">Details</div>
                        <div className="col-span-2 text-right">Speed</div>
                      </div>

                      <div className="p-0">
                        {journey.steps.map((step, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-12 gap-4 py-4 px-6 border-b border-white/5 text-white hover:bg-white/5 transition-colors items-center group"
                          >
                            <div className="col-span-1">
                              <span className="font-oswald font-bold text-2xl text-zinc-600">
                                {step.step}
                              </span>
                            </div>

                            <div className="col-span-4 flex items-center gap-3">
                              <span className="font-oswald font-bold text-xl md:text-3xl uppercase tracking-tighter leading-none text-white/90">
                                {step.title}
                              </span>
                            </div>

                            <div className="col-span-5 text-sm text-white/50 leading-snug">
                              {step.detail}
                            </div>

                            <div className="col-span-2 text-right font-oswald font-bold text-base text-turf-accent">
                              {step.time}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
