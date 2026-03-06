import {
  Car,
  Zap,
  ShieldCheck,
  Droplets,
  Wind,
  Coffee,
  ShoppingBag,
  Wifi,
  Video,
  AlertCircle,
  Users,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import {
  MdSportsSoccer,
  MdSportsCricket,
  MdSportsBasketball,
  MdSportsTennis,
  MdSportsVolleyball,
  MdSportsHockey,
  MdSportsKabaddi,
  MdPool,
  MdSportsScore,
} from "react-icons/md";
import { GiShuttlecock, GiPingPongBat, GiTennisRacket } from "react-icons/gi";

// ── Sport Suggestions ───────────────────────────────────────────────
export const SPORT_SUGGESTIONS = [
  "Football",
  "Cricket",
  "Badminton",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Table Tennis",
  "Hockey",
  "Pickleball",
  "Swimming",
];

// ── Amenity Suggestions ─────────────────────────────────────────────
export const AMENITY_SUGGESTIONS = [
  "Parking",
  "Washroom",
  "Changing Room",
  "Drinking Water",
  "Floodlights",
  "Cafeteria",
  "First Aid",
  "WiFi",
  "Seating Area",
  "Scoreboard",
];

// ── Sport Labels (lowercase key → display label) ────────────────────
export const SPORT_LABELS = {
  football: "Football",
  cricket: "Cricket",
  badminton: "Badminton",
  basketball: "Basketball",
  tennis: "Tennis",
  table_tennis: "Table Tennis",
  "table tennis": "Table Tennis",
  volleyball: "Volleyball",
  hockey: "Hockey",
  kabaddi: "Kabaddi",
  swimming: "Swimming",
  pickleball: "Pickleball",
};

export function getSportLabel(key) {
  if (!key) return key;
  return SPORT_LABELS[key] || SPORT_LABELS[key.replace(/ /g, "_")] || key;
}

// ── Sport Colors ────────────────────────────────────────────────────
export const SPORT_COLORS = {
  football: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cricket: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  badminton: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  basketball: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  tennis: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  table_tennis: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  "table tennis": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  volleyball: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  hockey: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  kabaddi: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  swimming: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  pickleball: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
};

// ── Sport Icons (react-icons — sport-specific) ──────────────────────
export const SPORT_ICONS = {
  football: MdSportsSoccer,
  cricket: MdSportsCricket,
  badminton: GiShuttlecock,
  basketball: MdSportsBasketball,
  tennis: MdSportsTennis,
  table_tennis: GiPingPongBat,
  "table tennis": GiPingPongBat,
  volleyball: MdSportsVolleyball,
  hockey: MdSportsHockey,
  kabaddi: MdSportsKabaddi,
  swimming: MdPool,
  pickleball: GiTennisRacket,
};

// ── Fallback sport icon for custom/unknown sports ───────────────────
export const SPORT_ICON_FALLBACK = MdSportsScore;

export function getSportIcon(key) {
  if (!key) return SPORT_ICON_FALLBACK;
  return SPORT_ICONS[key] || SPORT_ICONS[key.replace(/ /g, "_")] || SPORT_ICON_FALLBACK;
}

// ── Amenity Icons (Lucide components) ───────────────────────────────
export const AMENITY_ICON_MAP = {
  Parking: Car,
  Floodlights: Zap,
  "Changing Room": ShieldCheck,
  "Changing Rooms": ShieldCheck,
  Washroom: ShieldCheck,
  AC: Wind,
  Shower: Droplets,
  "Drinking Water": Droplets,
  "Water Cooler": Droplets,
  Cafe: Coffee,
  Cafeteria: Coffee,
  "Pro Shop": ShoppingBag,
  Coaching: Trophy,
  WiFi: Wifi,
  "Video Analysis": Video,
  "First Aid": AlertCircle,
  Nets: CheckCircle2,
  "Bowling Machine": CheckCircle2,
  "Seating Area": Users,
  Scoreboard: Trophy,
};

export function getAmenityIcon(name) {
  return AMENITY_ICON_MAP[name] || CheckCircle2;
}
