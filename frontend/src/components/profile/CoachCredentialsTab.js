import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Award, Plus, X, Camera, CheckCircle2, BadgeCheck, Save } from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { uploadAPI, coachingAPI } from "@/lib/api";
import { toast } from "sonner";

export function CoachCredentialsTab({ user }) {
  const normalizeItems = (arr) => (arr || []).map(item =>
    typeof item === "string" ? { text: item, image: "" } : item
  );

  const [experienceForm, setExperienceForm] = useState({
    years_of_experience: String(user?.years_of_experience || 0),
    specializations: user?.specializations || [],
    achievements: normalizeItems(user?.achievements),
    awards: normalizeItems(user?.awards),
    certifications_list: normalizeItems(user?.certifications_list),
    playing_history: user?.playing_history || "",
  });

  const [newSpecialization, setNewSpecialization] = useState("");
  const [newAchievement, setNewAchievement] = useState("");
  const [newAward, setNewAward] = useState("");
  const [newCertification, setNewCertification] = useState("");

  const handleSaveExperience = async () => {
    try {
      await coachingAPI.updateProfile({
        years_of_experience: parseInt(experienceForm.years_of_experience, 10) || 0,
        specializations: experienceForm.specializations,
        achievements: experienceForm.achievements,
        awards: experienceForm.awards,
        certifications_list: experienceForm.certifications_list,
        playing_history: experienceForm.playing_history,
      });
      toast.success("Experience & credentials saved!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };

  const handleExperienceImageUpload = async (field, index, files) => {
    if (!files || !files[0]) return;
    try {
      const res = await uploadAPI.image(files[0]);
      const url = res.data.url;
      setExperienceForm(p => {
        const items = [...p[field]];
        items[index] = { ...items[index], image: url };
        return { ...p, [field]: items };
      });
      toast.success("Image uploaded!");
    } catch {
      toast.error("Image upload failed");
    }
  };

  const addSpecialization = () => {
    if (newSpecialization.trim()) {
      setExperienceForm(p => ({
        ...p,
        specializations: [...p.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization("");
    }
  };

  const removeSpecialization = (index) => {
    setExperienceForm(p => ({
      ...p,
      specializations: p.specializations.filter((_, i) => i !== index)
    }));
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      setExperienceForm(p => ({
        ...p,
        achievements: [...p.achievements, { text: newAchievement.trim(), image: "" }]
      }));
      setNewAchievement("");
    }
  };

  const removeAchievement = (index) => {
    setExperienceForm(p => ({
      ...p,
      achievements: p.achievements.filter((_, i) => i !== index)
    }));
  };

  const addAward = () => {
    if (newAward.trim()) {
      setExperienceForm(p => ({
        ...p,
        awards: [...p.awards, { text: newAward.trim(), image: "" }]
      }));
      setNewAward("");
    }
  };

  const removeAward = (index) => {
    setExperienceForm(p => ({
      ...p,
      awards: p.awards.filter((_, i) => i !== index)
    }));
  };

  const addCertification = () => {
    if (newCertification.trim()) {
      setExperienceForm(p => ({
        ...p,
        certifications_list: [...p.certifications_list, { text: newCertification.trim(), image: "" }]
      }));
      setNewCertification("");
    }
  };

  const removeCertification = (index) => {
    setExperienceForm(p => ({
      ...p,
      certifications_list: p.certifications_list.filter((_, i) => i !== index)
    }));
  };

  const removeImage = (field, index) => {
    setExperienceForm(p => {
      const items = [...p[field]];
      items[index] = { ...items[index], image: "" };
      return { ...p, [field]: items };
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900">
            <Award className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </div>
          <h3 className="font-display font-bold text-lg">Experience & Credentials</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Shown on your public profile. Add images as proof to build trust.
        </p>

        {/* Years of Experience */}
        <div>
          <Label htmlFor="years-experience" className="text-sm font-semibold mb-2 block">
            Years of Experience
          </Label>
          <Input
            id="years-experience"
            type="number"
            min="0"
            value={experienceForm.years_of_experience}
            onChange={e => setExperienceForm(p => ({ ...p, years_of_experience: e.target.value }))}
            className="bg-background border-border max-w-xs"
            inputMode="numeric"
          />
        </div>

        {/* Specializations */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Specializations</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {experienceForm.specializations.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1.5 font-medium">
                {s}
                <button
                  onClick={() => removeSpecialization(i)}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newSpecialization}
              onChange={e => setNewSpecialization(e.target.value)}
              placeholder="e.g. Batting technique"
              className="bg-background border-border text-sm flex-1"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialization();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addSpecialization}
              className="shrink-0 font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Achievements */}
        <CredentialSection
          label="Achievements"
          items={experienceForm.achievements}
          newValue={newAchievement}
          setNewValue={setNewAchievement}
          onAdd={addAchievement}
          onRemove={removeAchievement}
          onRemoveImage={removeImage}
          onImageUpload={handleExperienceImageUpload}
          field="achievements"
          icon={CheckCircle2}
          iconColor="text-brand-600 dark:text-brand-400"
          placeholder="e.g. State level player 2019"
        />

        {/* Awards */}
        <CredentialSection
          label="Awards"
          items={experienceForm.awards}
          newValue={newAward}
          setNewValue={setNewAward}
          onAdd={addAward}
          onRemove={removeAward}
          onRemoveImage={removeImage}
          onImageUpload={handleExperienceImageUpload}
          field="awards"
          icon={Award}
          iconColor="text-amber-500"
          placeholder="e.g. Best Coach Award 2023"
        />

        {/* Certifications */}
        <CredentialSection
          label="Certifications"
          items={experienceForm.certifications_list}
          newValue={newCertification}
          setNewValue={setNewCertification}
          onAdd={addCertification}
          onRemove={removeCertification}
          onRemoveImage={removeImage}
          onImageUpload={handleExperienceImageUpload}
          field="certifications_list"
          icon={BadgeCheck}
          iconColor="text-brand-600 dark:text-brand-400"
          placeholder="e.g. NIS Diploma in Badminton"
        />

        {/* Playing History */}
        <div>
          <Label htmlFor="playing-history" className="text-sm font-semibold mb-2 block">
            Playing History
          </Label>
          <Textarea
            id="playing-history"
            value={experienceForm.playing_history}
            onChange={e => setExperienceForm(p => ({ ...p, playing_history: e.target.value }))}
            rows={4}
            placeholder="Describe your playing career..."
            className="bg-background border-border resize-none"
          />
        </div>

        <Button
          className="w-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold min-h-[52px]"
          onClick={handleSaveExperience}
        >
          <Save className="h-5 w-5 mr-2" aria-hidden="true" /> Save Experience & Credentials
        </Button>
      </div>
    </div>
  );
}

function CredentialSection({
  label,
  items,
  newValue,
  setNewValue,
  onAdd,
  onRemove,
  onRemoveImage,
  onImageUpload,
  field,
  icon: Icon,
  iconColor,
  placeholder
}) {
  return (
    <div>
      <Label className="text-sm font-semibold mb-2 block">{label}</Label>
      <div className="space-y-3 mb-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="flex items-center gap-2.5 text-sm mb-2">
              <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
              <span className="flex-1 font-medium text-foreground">{item.text}</span>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {item.image ? (
                <div className="relative group">
                  <img
                    src={mediaUrl(item.image)}
                    alt={`${label} proof`}
                    className="h-16 w-20 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() => onRemoveImage(field, i)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/90"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 cursor-pointer hover:underline font-medium">
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Add proof image
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => onImageUpload(field, i, e.target.files)}
                    aria-label={`Upload proof image for ${label.toLowerCase()} ${i + 1}`}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder={placeholder}
          className="bg-background border-border text-sm flex-1"
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onAdd}
          className="shrink-0 font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
