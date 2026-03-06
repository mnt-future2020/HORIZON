import { useState } from "react";
import { Plus, X, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SPORT_SUGGESTIONS, getSportIcon, getSportLabel } from "@/lib/venue-constants";

export default function SportChipSelector({ selected = [], onChange }) {
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const normalizedSelected = selected.map((s) => s.toLowerCase());

  const toggleSport = (sport) => {
    const key = sport.toLowerCase();
    if (normalizedSelected.includes(key)) {
      onChange(selected.filter((s) => s.toLowerCase() !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const addCustomSport = (val) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!normalizedSelected.includes(key)) {
      onChange([...selected, key]);
    }
    setCustomInput("");
  };

  const customSports = selected.filter(
    (s) => !SPORT_SUGGESTIONS.some((sug) => sug.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Predefined Sport Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
        role="group"
        aria-label="Select sports"
      >
        {SPORT_SUGGESTIONS.map((sport) => {
          const key = sport.toLowerCase();
          const isSelected = normalizedSelected.includes(key);
          const IconComp = getSportIcon(key);

          return (
            <button
              key={sport}
              type="button"
              onClick={() => toggleSport(sport)}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 active:scale-[0.97] ${
                isSelected
                  ? "bg-brand-600/10 border-brand-600 text-brand-600 shadow-sm shadow-brand-600/10"
                  : "bg-secondary/30 border-border/60 text-muted-foreground hover:border-brand-600/40 hover:bg-secondary/50"
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className="w-3.5 h-3.5 text-brand-600" />
                </div>
              )}
              <IconComp
                className={`w-5 h-5 ${isSelected ? "text-brand-600" : "text-muted-foreground"}`}
              />
              <span className="text-center leading-tight">{sport}</span>
            </button>
          );
        })}
      </div>

      {/* Custom sports chips */}
      {customSports.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customSports.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-600 text-white"
            >
              {getSportLabel(s)}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== s))}
                className="hover:opacity-70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full"
                aria-label={`Remove ${getSportLabel(s)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Custom Toggle */}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-brand-600 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-md px-1 py-0.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add custom sport
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${showCustom ? "rotate-180" : ""}`}
        />
      </button>

      {showCustom && (
        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSport(customInput);
              }
            }}
            placeholder="Type a sport name..."
            className="h-10 rounded-xl bg-secondary/20 border-border/40 flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addCustomSport(customInput)}
            disabled={!customInput.trim()}
            className="h-10 rounded-xl cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
