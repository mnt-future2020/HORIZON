import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSportLabel } from "@/lib/venue-constants";

export default function TurfConfigPanel({
  turfConfig = [],
  baseTurf,
  onConfigChange,
  onBaseTurfChange,
}) {
  if (turfConfig.length === 0) return null;

  const addTurf = (sport) => {
    onConfigChange(
      turfConfig.map((tc) =>
        tc.sport === sport
          ? {
              ...tc,
              turfs: [
                ...tc.turfs,
                { name: `${getSportLabel(sport)} Turf ${tc.turfs.length + 1}`, price: 2000 },
              ],
            }
          : tc
      )
    );
  };

  const removeTurf = (sport, idx) => {
    onConfigChange(
      turfConfig.map((tc) =>
        tc.sport === sport
          ? { ...tc, turfs: tc.turfs.filter((_, i) => i !== idx) }
          : tc
      )
    );
  };

  const renameTurf = (sport, idx, name) => {
    onConfigChange(
      turfConfig.map((tc) =>
        tc.sport === sport
          ? {
              ...tc,
              turfs: tc.turfs.map((t, i) =>
                i === idx ? { ...t, name } : t
              ),
            }
          : tc
      )
    );
  };

  const updatePrice = (sport, idx, price) => {
    onConfigChange(
      turfConfig.map((tc) =>
        tc.sport === sport
          ? {
              ...tc,
              turfs: tc.turfs.map((t, i) =>
                i === idx ? { ...t, price: Number(price) || 0 } : t
              ),
            }
          : tc
      )
    );
  };

  return (
    <div className="space-y-3">
      {turfConfig.map((tc) => (
        <div
          key={tc.sport}
          className="border border-border rounded-xl p-4 bg-secondary/10"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-brand-600 capitalize">
              {getSportLabel(tc.sport)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addTurf(tc.sport)}
              className="h-8 text-xs px-3 cursor-pointer hover:text-brand-600 transition-colors duration-200"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Turf
            </Button>
          </div>
          <div className="space-y-2">
            {tc.turfs.map((t, idx) => {
              const isBase = baseTurf
                ? baseTurf.sport === tc.sport && baseTurf.idx === idx
                : turfConfig[0]?.sport === tc.sport && idx === 0;

              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-2"
                >
                  {/* Base radio */}
                  <label
                    className="flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[36px]"
                    title="Set as base price"
                  >
                    <input
                      type="radio"
                      name="base_turf"
                      checked={isBase}
                      onChange={() =>
                        onBaseTurfChange({ sport: tc.sport, idx })
                      }
                      className="accent-brand-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <Badge
                      variant={isBase ? "default" : "outline"}
                      className={`text-[10px] px-1.5 py-0 ${
                        isBase
                          ? "bg-brand-600 text-white border-brand-600"
                          : "text-muted-foreground/40 border-border/40"
                      }`}
                    >
                      BASE
                    </Badge>
                  </label>

                  {/* Turf name */}
                  <Input
                    value={t.name}
                    onChange={(e) =>
                      renameTurf(tc.sport, idx, e.target.value)
                    }
                    placeholder={`Turf ${idx + 1} name`}
                    className="h-9 rounded-lg bg-background border-border/60 text-sm flex-1"
                  />

                  {/* Price */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">
                      ₹
                    </span>
                    <Input
                      type="number"
                      value={t.price ?? 2000}
                      onChange={(e) =>
                        updatePrice(tc.sport, idx, e.target.value)
                      }
                      min="0"
                      step="100"
                      className="h-9 rounded-lg bg-background border-border/60 text-sm w-24"
                    />
                  </div>

                  {/* Delete */}
                  {tc.turfs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTurf(tc.sport, idx)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                      aria-label={`Remove ${t.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
