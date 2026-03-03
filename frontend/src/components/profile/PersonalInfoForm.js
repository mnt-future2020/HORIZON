import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

const cleanPhone = (v) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  return d.slice(0, 10);
};

export function PersonalInfoForm({ user, form, setForm, editing }) {
  const role = user?.role;

  if (!editing) {
    return <PersonalInfoDisplay user={user} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Name
        </Label>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          data-testid="profile-name-input"
        />
      </div>

      <div>
        <Label htmlFor="profile-phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Phone
        </Label>
        <div className="flex">
          <span className="inline-flex items-center px-4 bg-muted border border-r-0 border-border rounded-l-lg text-sm font-bold text-muted-foreground select-none">
            +91
          </span>
          <Input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))}
            className="bg-background border-border rounded-l-none h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            data-testid="profile-phone-input"
            placeholder="98765 43210"
            maxLength={10}
          />
        </div>
      </div>

      {role === "player" && <PlayerFields form={form} setForm={setForm} />}
      {role === "venue_owner" && <VenueOwnerFields form={form} setForm={setForm} />}
      {role === "coach" && <CoachFields form={form} setForm={setForm} />}
    </div>
  );
}

function PlayerFields({ form, setForm }) {
  return (
    <>
      <div>
        <Label htmlFor="profile-bio" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Bio
        </Label>
        <Textarea
          id="profile-bio"
          name="bio"
          value={form.bio}
          onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
          placeholder="Tell Lobbians about yourself…"
          rows={3}
          className="bg-background border-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-none"
          spellCheck={true}
        />
      </div>
      <div>
        <Label htmlFor="profile-sports" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Sports (comma separated)
        </Label>
        <Input
          id="profile-sports"
          name="sports"
          autoComplete="off"
          value={form.sports}
          onChange={e => setForm(p => ({ ...p, sports: e.target.value }))}
          placeholder="Football, Cricket, Badminton"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
      <div>
        <Label htmlFor="profile-position" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Preferred Position
        </Label>
        <Input
          id="profile-position"
          name="position"
          autoComplete="off"
          value={form.preferred_position}
          onChange={e => setForm(p => ({ ...p, preferred_position: e.target.value }))}
          placeholder="Midfielder, Goalkeeper…"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          data-testid="profile-position-input"
        />
      </div>
    </>
  );
}

function VenueOwnerFields({ form, setForm }) {
  return (
    <>
      <div>
        <Label htmlFor="business-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Business Name
        </Label>
        <Input
          id="business-name"
          name="business_name"
          autoComplete="organization"
          value={form.business_name}
          onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
          placeholder="Your business name"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
      <div>
        <Label htmlFor="gst-number" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          GST Number
        </Label>
        <Input
          id="gst-number"
          name="gst_number"
          autoComplete="off"
          spellCheck={false}
          value={form.gst_number}
          onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))}
          placeholder="22AAAAA0000A1Z5"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
    </>
  );
}

function CoachFields({ form, setForm }) {
  return (
    <>
      <div>
        <Label htmlFor="coaching-bio" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Coaching Bio
        </Label>
        <Textarea
          id="coaching-bio"
          name="coaching_bio"
          value={form.coaching_bio}
          onChange={e => setForm(p => ({ ...p, coaching_bio: e.target.value }))}
          placeholder="Tell Lobbians about your coaching experience…"
          rows={3}
          className="bg-background border-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-none"
          spellCheck={true}
        />
      </div>
      <div>
        <Label htmlFor="coaching-sports" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Sports (comma separated)
        </Label>
        <Input
          id="coaching-sports"
          name="coaching_sports"
          autoComplete="off"
          value={form.coaching_sports}
          onChange={e => setForm(p => ({ ...p, coaching_sports: e.target.value }))}
          placeholder="Football, Cricket, Badminton"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="session-price" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Session Price (₹)
          </Label>
          <Input
            id="session-price"
            name="session_price"
            type="number"
            inputMode="numeric"
            value={form.session_price}
            onChange={e => setForm(p => ({ ...p, session_price: e.target.value }))}
            placeholder="500"
            className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>
        <div>
          <Label htmlFor="session-duration" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Duration (mins)
          </Label>
          <Input
            id="session-duration"
            name="session_duration"
            type="number"
            inputMode="numeric"
            value={form.session_duration_minutes}
            onChange={e => setForm(p => ({ ...p, session_duration_minutes: e.target.value }))}
            placeholder="60"
            className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="city" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          City
        </Label>
        <Input
          id="city"
          name="city"
          value={form.city}
          onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
          placeholder="Chennai"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
      <div>
        <Label htmlFor="coaching-venue" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Coaching Venue
        </Label>
        <Input
          id="coaching-venue"
          name="coaching_venue"
          value={form.coaching_venue}
          onChange={e => setForm(p => ({ ...p, coaching_venue: e.target.value }))}
          placeholder="Venue name or address"
          className="bg-background border-border h-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>
    </>
  );
}

function PersonalInfoDisplay({ user }) {
  return (
    <div className="space-y-3">
      <InfoRow label="Name" value={user?.name} />
      <InfoRow label="Email" value={user?.email} />
      <InfoRow label="Phone" value={user?.phone || "Not set"} />
      <InfoRow
        label="Role"
        value={
          <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider">
            {user?.role === "player" ? "LOBBIAN" : user?.role?.replace("_", " ")}
          </Badge>
        }
      />

      {user?.bio && <InfoRow label="Bio" value={user.bio} valueClass="text-right max-w-[60%]" />}
      
      {user?.sports?.length > 0 && (
        <InfoRow
          label="Sports"
          value={
            <div className="flex flex-wrap gap-1.5 justify-end">
              {user.sports.map(s => (
                <Badge key={s} variant="secondary" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          }
        />
      )}

      {user?.preferred_position && <InfoRow label="Position" value={user.preferred_position} />}

      {user?.role === "venue_owner" && (
        <>
          {user.business_name && <InfoRow label="Business Name" value={user.business_name} />}
          {user.gst_number && <InfoRow label="GST Number" value={user.gst_number} />}
        </>
      )}

      {user?.role === "coach" && (
        <>
          {user.coaching_bio && <InfoRow label="Bio" value={user.coaching_bio} valueClass="text-right max-w-[60%]" />}
          {user.coaching_sports?.length > 0 && (
            <InfoRow
              label="Sports"
              value={
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {user.coaching_sports.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              }
            />
          )}
          {user.session_price && (
            <InfoRow
              label="Session Price"
              value={`₹${user.session_price} / ${user.session_duration_minutes || 60} min`}
            />
          )}
          {user.city && <InfoRow label="City" value={user.city} />}
          {user.coaching_venue && <InfoRow label="Coaching Venue" value={user.coaching_venue} />}
          {user?.coaching_rating > 0 && (
            <InfoRow
              label="Rating"
              value={
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  {Number(user.coaching_rating).toFixed(1)}
                </span>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold text-foreground ${valueClass}`}>{value}</span>
    </div>
  );
}
