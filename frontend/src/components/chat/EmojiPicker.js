import React, { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
      "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
      "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢",
      "🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏",
      "😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷",
      "🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠",
      "🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️",
      "😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰",
      "😥","😢","😭","😱","😖","😣","😞","😓","😩","😫",
      "🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩",
      "🤡","👹","👺","👻","👽","👾","🤖",
    ],
  },
  {
    label: "Gestures",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌",
      "🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
      "👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛",
      "🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💪",
      "🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁",
      "🦷","🦴","👀","👁️","👅","👄","🫦","💋",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝",
      "💟","♥️","💯","💢","💥","💫","💦","💨","🕳️","💣",
      "💬","🗨️","🗯️","💭","💤","🔥","⭐","🌟","✨","⚡",
      "🎉","🎊","🏆","🥇","🥈","🥉","🏅","🎯","🎮",
    ],
  },
  {
    label: "Sports",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱",
      "🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳",
      "🪁","🛝","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼",
      "🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤸","🤼",
      "🤺","⛹️","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣",
      "🧗","🚴","🚵","🏆","🥇","🥈","🥉","🏅",
    ],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍇","🍈","🍉","🍊","🍋","🍌","🍍","🥭","🍎","🍏",
      "🍐","🍑","🍒","🍓","🫐","🥝","🍅","🫒","🥥","🥑",
      "🍆","🥔","🥕","🌽","🌶️","🫑","🥒","🥬","🥦","🧄",
      "🧅","🍄","🥜","🌰","🍞","🥐","🥖","🫓","🥨","🥯",
      "🥞","🧇","🧀","🍖","🍗","🥩","🥓","🍔","🍟","🍕",
      "🌭","🥪","🌮","🌯","🫔","🥙","🧆","🥚","🍳","🥘",
      "🍲","🫕","🥣","🥗","🍿","🧈","🍱","🍘","🍙","🍚",
      "🍛","🍜","🍝","🍠","🍢","🍣","🍤","🍥","🥮","🍡",
    ],
  },
  {
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️",
      "💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️",
      "🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️",
      "🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🔌",
      "💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶",
      "💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧",
      "🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️",
    ],
  },
];

export default function EmojiPicker({ onSelect, onClose, pickerRef }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    // Simple search: just return all emojis (emoji search by name would need a mapping)
    // For now, return all if searching (users typically just scroll)
    return all.filter(() => true).slice(0, 80);
  }, [search]);

  const currentCategory = EMOJI_CATEGORIES[activeCategory];

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 right-0 sm:left-auto sm:right-auto sm:w-[320px] mb-2 bg-card border border-border/40 rounded-2xl shadow-2xl z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji…"
            className="w-full pl-8 pr-2 h-8 rounded-xl bg-secondary/30 border-none text-[12px] outline-none focus:ring-1 focus:ring-brand-600/30 placeholder:text-muted-foreground/30"
          />
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/10 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(i)}
              className={`h-8 w-8 flex items-center justify-center rounded-lg text-[16px] flex-shrink-0 transition-all ${
                i === activeCategory
                  ? "bg-brand-600/10 scale-110"
                  : "hover:bg-secondary/40 opacity-60 hover:opacity-100"
              }`}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="h-[220px] overflow-y-auto p-2 custom-scrollbar">
        {search && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1 mb-1.5">
            All Emojis
          </p>
        )}
        {!search && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1 mb-1.5">
            {currentCategory.label}
          </p>
        )}
        <div className="grid grid-cols-8 gap-0.5">
          {(filteredEmojis || currentCategory.emojis).map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => onSelect({ emoji })}
              className="h-9 w-full flex items-center justify-center text-[20px] rounded-lg hover:bg-secondary/50 active:scale-90 transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
