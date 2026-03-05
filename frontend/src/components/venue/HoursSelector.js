import { Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function to12h(h24) {
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return { hour: h, ampm };
}

function to24h(h12, ampm) {
  let h = h12 % 12;
  if (ampm === "PM") h += 12;
  return h;
}

export { to12h, to24h };

export default function HoursSelector({
  openingHour = 6,
  closingHour = 23,
  onOpeningChange,
  onClosingChange,
}) {
  const opening = to12h(openingHour);
  const closing = to12h(closingHour);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-600" />
          Opening Hour
        </label>
        <div className="flex gap-2">
          <Select
            value={String(opening.hour)}
            onValueChange={(val) =>
              onOpeningChange(to24h(Number(val), opening.ampm))
            }
          >
            <SelectTrigger className="flex-1 h-10 rounded-lg cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={opening.ampm}
            onValueChange={(val) =>
              onOpeningChange(to24h(opening.hour, val))
            }
          >
            <SelectTrigger className="w-20 h-10 rounded-lg cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-600" />
          Closing Hour
        </label>
        <div className="flex gap-2">
          <Select
            value={String(closing.hour)}
            onValueChange={(val) =>
              onClosingChange(to24h(Number(val), closing.ampm))
            }
          >
            <SelectTrigger className="flex-1 h-10 rounded-lg cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={closing.ampm}
            onValueChange={(val) =>
              onClosingChange(to24h(closing.hour, val))
            }
          >
            <SelectTrigger className="w-20 h-10 rounded-lg cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
