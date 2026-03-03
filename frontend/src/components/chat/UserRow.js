import React from "react";
import { User, MessageCircle } from "lucide-react";
import { mediaUrl } from "@/lib/utils";

const UserRow = ({ u, onSelect, badge }) => (
  <button
    onClick={onSelect}
    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-all text-left group"
  >
    <div className="h-11 w-11 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-transparent group-hover:border-brand-600/20 transition-all">
      {u.avatar ? (
        <img
          src={mediaUrl(u.avatar)}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-110"
        />
      ) : (
        <User className="h-5 w-5 text-brand-600" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-sm font-semibold truncate block text-foreground/90 group-hover:text-brand-600 transition-colors">
        {u.name}
      </span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-muted-foreground capitalize">
          {u.role === "player" ? "lobbian" : u.role || "lobbian"}
        </span>
        {u.skill_rating && (
          <span className="text-[10px] text-muted-foreground/60">
            • {u.skill_rating} SR
          </span>
        )}
        {badge && (
          <span className="text-[10px] text-brand-600 font-bold capitalize bg-brand-600/10 px-1.5 py-0.5 rounded-full border border-brand-600/10">
            {badge}
          </span>
        )}
      </div>
    </div>
    <div className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all">
      <MessageCircle className="h-4 w-4 text-brand-600 group-hover:text-white transition-colors" />
    </div>
  </button>
);

export default UserRow;
