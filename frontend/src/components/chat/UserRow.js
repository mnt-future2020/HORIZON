import React from "react";
import { User, MessageCircle } from "lucide-react";
import { mediaUrl } from "@/lib/utils";

const UserRow = ({ u, onSelect, badge }) => (
  <button
    onClick={onSelect}
    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] sm:rounded-[24px] hover:bg-brand-600/5 active:bg-brand-600/12 transition-all text-left group border border-transparent hover:border-brand-600/10 mb-1"
  >
    <div className="relative">
      <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-600/5 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/50 group-hover:border-brand-600/30 transition-all shadow-sm">
        {u.avatar ? (
          <img
            src={mediaUrl(u.avatar)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <User className="h-6 w-6 sm:h-7 sm:w-7 text-brand-600/50" />
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-card flex items-center justify-center border-2 border-card shadow-sm">
        <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500" />
      </div>
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[14px] sm:text-[15px] font-black truncate block text-foreground tracking-tight group-hover:text-brand-600 transition-colors">
          {u.name}
        </span>
        {badge && (
          <span className="text-[8px] sm:text-[9px] text-brand-600 font-black uppercase tracking-widest bg-brand-600/10 px-2 py-0.5 rounded-full border border-brand-600/10 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
        <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate">
          {u.role === "player" ? "Athlete" : u.role || "Player"}
        </span>
        {u.skill_rating && (
          <>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-black text-brand-600/80 shrink-0">
              {u.skill_rating} SR
            </span>
          </>
        )}
      </div>
    </div>

    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-secondary/50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm border border-border/10">
      <MessageCircle className="h-4.5 w-4.5 text-muted-foreground group-hover:text-white transition-colors" />
    </div>
  </button>
);

export default UserRow;
