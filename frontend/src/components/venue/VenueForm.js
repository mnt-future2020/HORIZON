import { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Dumbbell,
  Sparkles,
  Settings,
  Image,
  Globe,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import VenueRichEditor from "./VenueRichEditor";
import SportChipSelector from "./SportChipSelector";
import AmenityChipSelector from "./AmenityChipSelector";
import TurfConfigPanel from "./TurfConfigPanel";
import HoursSelector from "./HoursSelector";
import VenueImageUpload from "./VenueImageUpload";
import { getSportLabel } from "@/lib/venue-constants";

function SectionHeading({ icon: Icon, children }) {
  return (
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-600" />
      {children}
    </h3>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export default function VenueForm({
  mode = "create",
  initialValues = {},
  onSubmit,
  isSubmitting = false,
  baseTurf: externalBaseTurf,
  onBaseTurfChange,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    name: "",
    description: "",
    sports: [],
    address: "",
    area: "",
    city: "Bengaluru",
    slot_duration_minutes: 60,
    opening_hour: 6,
    closing_hour: 23,
    amenities: [],
    images: [],
    turf_config: [],
    google_maps_url: "",
    ...initialValues,
  }));

  const [errors, setErrors] = useState({});

  // Sync initialValues on change (for edit mode re-opens)
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setForm({
        name: "",
        description: "",
        sports: [],
        address: "",
        area: "",
        city: "Bengaluru",
        slot_duration_minutes: 60,
        opening_hour: 6,
        closing_hour: 23,
        amenities: [],
        images: [],
        turf_config: [],
        google_maps_url: "",
        ...initialValues,
      });
      setErrors({});
    }
  }, [initialValues]);

  const updateField = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: null }));
  };

  // Sport add/remove — also manages turf_config
  const handleSportsChange = (newSports) => {
    setForm((prev) => {
      const oldSports = prev.sports || [];
      // Add new turf configs for newly added sports
      const added = newSports.filter((s) => !oldSports.includes(s));
      const removed = oldSports.filter((s) => !newSports.includes(s));

      let turfConfig = [...(prev.turf_config || [])];

      // Remove turf config for removed sports
      turfConfig = turfConfig.filter((tc) => !removed.includes(tc.sport));

      // Add default turf config for newly added sports
      for (const sport of added) {
        turfConfig.push({
          sport,
          turfs: [{ name: `${getSportLabel(sport)} Turf 1`, price: 2000 }],
        });
      }

      return { ...prev, sports: newSports, turf_config: turfConfig };
    });
    if (errors.sports) setErrors((p) => ({ ...p, sports: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = "Venue name is required";
    if (!form.city?.trim()) errs.city = "City is required";
    if (!form.sports?.length) errs.sports = "Select at least one sport";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = { ...form };
    // Compute total turfs
    if (payload.turf_config?.length) {
      payload.turfs = payload.turf_config.reduce(
        (sum, tc) => sum + tc.turfs.length,
        0
      );
    } else {
      payload.turfs = 1;
    }
    // Compute base_price from selected base turf
    const bt = externalBaseTurf || {
      sport: payload.turf_config?.[0]?.sport,
      idx: 0,
    };
    const baseTc = payload.turf_config?.find((tc) => tc.sport === bt?.sport);
    payload.base_price = baseTc?.turfs?.[bt?.idx]?.price || 2000;

    onSubmit(payload);
  };

  return (
    <div className="space-y-6 py-2">
      {/* ── Section 1: Basic Information ── */}
      <div className="space-y-4">
        <SectionHeading icon={Building2}>Basic Information</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel required>Venue Name</FieldLabel>
          <Input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter your venue name"
            className={`h-11 rounded-xl bg-secondary/20 border-border/40 ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Description</FieldLabel>
          <VenueRichEditor
            value={form.description}
            onChange={(val) => updateField("description", val)}
          />
        </div>
      </div>

      <Separator />

      {/* ── Section 2: Location ── */}
      <div className="space-y-4">
        <SectionHeading icon={MapPin}>Location</SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Address</FieldLabel>
            <Input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Street address"
              className="h-11 rounded-xl bg-secondary/20 border-border/40"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Area</FieldLabel>
            <Input
              value={form.area}
              onChange={(e) => updateField("area", e.target.value)}
              placeholder="e.g. Koramangala"
              className="h-11 rounded-xl bg-secondary/20 border-border/40"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel required>City</FieldLabel>
          <Input
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="City name"
            className={`h-11 rounded-xl bg-secondary/20 border-border/40 ${errors.city ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          <FieldError message={errors.city} />
        </div>
      </div>

      <Separator />

      {/* ── Section 3: Sports & Turf Config ── */}
      <div className="space-y-4">
        <SectionHeading icon={Dumbbell}>Sports & Turfs</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel required>Select Sports</FieldLabel>
          <SportChipSelector
            selected={form.sports}
            onChange={handleSportsChange}
          />
          <FieldError message={errors.sports} />
        </div>

        {form.turf_config?.length > 0 && (
          <div className="space-y-1.5">
            <FieldLabel>Turf Configuration</FieldLabel>
            <p className="text-xs text-muted-foreground">
              Set the name, price, and base price turf for each sport.
            </p>
            <TurfConfigPanel
              turfConfig={form.turf_config}
              baseTurf={externalBaseTurf}
              onConfigChange={(config) => updateField("turf_config", config)}
              onBaseTurfChange={onBaseTurfChange}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* ── Section 4: Amenities ── */}
      <div className="space-y-4">
        <SectionHeading icon={Sparkles}>Amenities</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel>Select Amenities</FieldLabel>
          <AmenityChipSelector
            selected={form.amenities}
            onChange={(val) => updateField("amenities", val)}
          />
        </div>
      </div>

      <Separator />

      {/* ── Section 5: Schedule & Settings ── */}
      <div className="space-y-4">
        <SectionHeading icon={Settings}>Schedule & Settings</SectionHeading>

        <HoursSelector
          openingHour={form.opening_hour}
          closingHour={form.closing_hour}
          onOpeningChange={(val) => updateField("opening_hour", val)}
          onClosingChange={(val) => updateField("closing_hour", val)}
        />

        <div className="flex items-center justify-between py-2 px-1">
          <div className="space-y-0.5">
            <label
              htmlFor="slot-duration"
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              Enable 30-minute bookings
            </label>
            <p className="text-xs text-muted-foreground">
              Allow players to book 30-min slots instead of the default 1 hour
            </p>
          </div>
          <Switch
            id="slot-duration"
            checked={form.slot_duration_minutes === 30}
            onCheckedChange={(checked) =>
              updateField("slot_duration_minutes", checked ? 30 : 60)
            }
            className="cursor-pointer"
          />
        </div>
      </div>

      <Separator />

      {/* ── Section 6: Location & Media ── */}
      <div className="space-y-4">
        <SectionHeading icon={Image}>Location & Media</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-600" />
              Google Maps Embed Link
            </span>
          </FieldLabel>
          <Input
            value={form.google_maps_url || ""}
            onChange={(e) => updateField("google_maps_url", e.target.value)}
            placeholder='Paste Google Maps <iframe> code or URL here'
            className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
          />
          <p className="text-xs text-muted-foreground bg-brand-600/5 p-2.5 rounded-lg border border-brand-600/10 leading-relaxed">
            <span className="text-brand-600 font-bold">Pro Tip:</span> In
            Google Maps, click Share &rarr; Embed a map &rarr; Copy HTML. We'll
            automatically extract the URL and make it responsive.
          </p>
        </div>

        <VenueImageUpload
          images={form.images || []}
          onChange={(imgs) => updateField("images", imgs)}
        />
      </div>

      {/* ── Submit Buttons ── */}
      <div className="flex gap-3 pt-2 sticky bottom-0 bg-background/95 backdrop-blur-sm pb-2 -mb-2 border-t border-border/50 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 rounded-xl cursor-pointer transition-colors duration-200"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="flex-1 h-11 bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all cursor-pointer"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : mode === "create" ? (
            "Create Venue"
          ) : (
            "Save & Go Live"
          )}
        </Button>
      </div>
    </div>
  );
}
