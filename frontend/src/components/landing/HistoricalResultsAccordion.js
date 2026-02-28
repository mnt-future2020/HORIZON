import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const historicalData = [
  {
    year: "2024",
    podiums: "12",
    bestFinish: "1ST",
    results: [
      { round: "01", location: "ALPHA ARENA", date: "JAN 2024", finish: "WIN", eventTime: "20:00" },
      { round: "02", location: "BETA FIELD", date: "FEB 2024", finish: "WIN", eventTime: "21:30" },
    ],
  },
  {
    year: "2023",
    podiums: "10",
    bestFinish: "2ND",
    results: [
      { round: "01", location: "GAMMA PRO", date: "MAR 2023", finish: "FINAL", eventTime: "19:45" },
    ],
  },
];

export function HistoricalResultsAccordion() {
  const [activeYear, setActiveYear] = useState("2024");

  return (
    <div className="w-full bg-[#111111] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="flex flex-col">
            <h2 className="font-oswald text-4xl md:text-6xl font-bold uppercase leading-none text-white tracking-tighter">
              ARENA
            </h2>
            <h1 className="font-brier text-5xl text-zinc-400 leading-none md:-mt-2 md:text-7xl mt-2.5">Event History</h1>
          </div>
          <p className="text-zinc-500 text-sm md:text-base max-w-xs md:text-right font-medium">
            Discover the legendary matches and tournaments hosted at our premium sports arenas.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {historicalData.map((data) => (
            <div key={data.year} className="border-b border-white/10 last:border-none">
              <button
                onClick={() => setActiveYear(activeYear === data.year ? null : data.year)}
                className={cn(
                  "w-full flex items-center justify-between p-4 md:p-6 transition-all duration-300 ease-out group",
                  activeYear === data.year
                    ? "bg-turf-accent text-black"
                    : "bg-transparent text-white hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-6">
                  <ChevronDown
                    className={cn(
                      "w-6 h-6 md:w-8 md:h-8 transition-transform duration-300",
                      activeYear === data.year ? "rotate-180 text-black" : "text-white -rotate-90"
                    )}
                  />
                  <span className="font-oswald font-bold text-5xl md:text-7xl tracking-tighter leading-none">
                    {data.year}
                  </span>
                </div>

                <div className="flex items-center gap-8 md:gap-16 pr-4">
                  <div className="flex flex-col items-end">
                    <div className="text-xs font-bold uppercase opacity-60 mb-1">Ranking</div>
                    <span className="font-oswald font-bold text-2xl md:text-4xl italic leading-none">
                      {data.bestFinish}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-xs font-bold uppercase opacity-60 mb-1">Top Events</div>
                    <span className="font-oswald font-bold text-2xl md:text-4xl leading-none">
                      {data.podiums}
                    </span>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {activeYear === data.year && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden bg-zinc-900/30"
                  >
                    <div className="grid grid-cols-12 gap-4 py-4 px-6 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/10">
                      <div className="col-span-1">#</div>
                      <div className="col-span-4">Venue</div>
                      <div className="col-span-3 text-center">Date</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-2 text-right">Time Slot</div>
                    </div>

                    <div className="p-0">
                      {data.results.map((result, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-4 py-4 px-6 border-b border-white/5 text-white hover:bg-white/5 transition-colors items-center group"
                        >
                          <div className="col-span-1">
                            <span className="font-oswald font-bold text-2xl text-zinc-600">
                              {result.round}
                            </span>
                          </div>

                          <div className="col-span-4 flex items-center gap-3">
                            <span className="font-oswald font-bold text-2xl md:text-4xl uppercase tracking-tighter leading-none text-white/90">
                              {result.location}
                            </span>
                          </div>

                          <div className="col-span-3 text-center font-oswald font-bold text-xl md:text-2xl text-white/70 uppercase">
                            {result.date}
                          </div>

                          <div className="col-span-2 text-center font-oswald font-bold text-xl md:text-3xl italic flex items-center justify-center">
                            <span className={result.finish === "WIN" || result.finish === "1ST" ? "text-turf-accent" : "text-white"}>
                              {result.finish}
                            </span>
                          </div>

                          <div className="col-span-2 text-right font-oswald font-bold text-lg text-white/80">
                            {result.eventTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
