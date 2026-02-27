import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, analyticsAPI, bookingAPI, uploadAPI, careerAPI, venueAPI, coachingAPI, organizationAPI, playerCardAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Trophy, Star, TrendingUp, Calendar, Shield, LogOut, Save, Camera, Loader2, BarChart3, Clock, Award, Building2, BadgeCheck, MapPin, DollarSign, Users, Briefcase, MessageSquare, FileText, Upload, CheckCircle2, XCircle, AlertCircle, AlertTriangle, Video, Image, Info, Lock, Minus, Eye, EyeOff, Plus, X, ShieldCheck, Trash2 } from "lucide-react";

const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

const normalizeItems = (arr) => (arr || []).map(item =>
  typeof item === "string" ? { text: item, image: "" } : item
);

const COACH_DOC_SLOTS = [
  { key: "government_id", label: "Government ID (Aadhaar / PAN / Passport)", type: "document", required: true },
  { key: "coaching_certification", label: "Coaching Certification (NIS / AIFF / NCA / ICC)", type: "document", required: true },
  { key: "federation_membership", label: "Sport Federation Membership Card", type: "document", required: true },
  { key: "profile_photo", label: "Professional Photo", type: "image", required: true },
  { key: "playing_experience", label: "Playing Experience Proof", type: "document", required: false },
  { key: "first_aid_certificate", label: "First Aid / CPR Certificate", type: "document", required: false },
  { key: "fitness_certificate", label: "Fitness Certificate", type: "document", required: false },
  { key: "background_check", label: "Background / Police Check", type: "document", required: false },
  { key: "qualification_proof", label: "Qualification Proof (10+2 / Graduation)", type: "document", required: false },
  { key: "experience_letters", label: "Previous Coaching Experience Letters", type: "document", multiple: true, required: false },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", preferred_position: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [career, setCareer] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const [playerCard, setPlayerCard] = useState(null);
  // Venue Owner state
  const [ownerVenues, setOwnerVenues] = useState([]);
  const [venueAnalytics, setVenueAnalytics] = useState({});
  const [reviewSummaries, setReviewSummaries] = useState({});
  // Coach state
  const [coachStats, setCoachStats] = useState(null);
  const [coachOrgs, setCoachOrgs] = useState([]);
  const [coachSessions, setCoachSessions] = useState([]);
  // Document verification state
  const [docs, setDocs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submittingDocs, setSubmittingDocs] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const avatarInputRef = useRef(null);
  // Password change state
  const [showPwChange, setShowPwChange] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new_pw: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Coach experience & credentials state
  const [experienceForm, setExperienceForm] = useState({
    years_of_experience: "0", specializations: [],
    achievements: [], awards: [], certifications_list: [],
    playing_history: "",
  });
  const [newSpecialization, setNewSpecialization] = useState("");
  const [newAchievement, setNewAchievement] = useState("");
  const [newAward, setNewAward] = useState("");
  const [newCertification, setNewCertification] = useState("");

  useEffect(() => {
    if (!user) return;
    const role = user.role;

    // Initialize form based on role
    if (role === "player") {
      setForm({ name: user.name || "", phone: user.phone || "", preferred_position: user.preferred_position || "", bio: user.bio || "", sports: (user.sports || []).join(", ") });
    } else if (role === "venue_owner") {
      setForm({ name: user.name || "", phone: user.phone || "", business_name: user.business_name || "", gst_number: user.gst_number || "" });
      const rawDocs = user.verification_documents || {};
      // Ensure turf_images and turf_videos are always arrays
      setDocs({
        ...rawDocs,
        turf_images: Array.isArray(rawDocs.turf_images) ? rawDocs.turf_images : [],
        turf_videos: Array.isArray(rawDocs.turf_videos) ? rawDocs.turf_videos : [],
      });
    } else if (role === "coach") {
      setForm({
        name: user.name || "", phone: user.phone || "",
        coaching_bio: user.coaching_bio || "", coaching_sports: (user.coaching_sports || []).join(", "),
        session_price: user.session_price || "", session_duration_minutes: user.session_duration_minutes || 60,
        city: user.city || "", coaching_venue: user.coaching_venue || "",
      });
      // Initialize coach verification documents
      setDocs(user.coach_verification_documents || {});
      // Initialize experience form
      setExperienceForm({
        years_of_experience: String(user.years_of_experience || 0),
        specializations: user.specializations || [],
        achievements: normalizeItems(user.achievements),
        awards: normalizeItems(user.awards),
        certifications_list: normalizeItems(user.certifications_list),
        playing_history: user.playing_history || "",
      });
    } else {
      setForm({ name: user.name || "", phone: user.phone || "" });
    }

    // Role-specific data loading
    if (role === "player") {
      Promise.all([
        analyticsAPI.player().catch(() => ({ data: null })),
        bookingAPI.list().catch(() => ({ data: [] })),
      ]).then(([sRes, bRes]) => {
        setStats(sRes.data);
        setBookings(bRes.data || []);
      });
      if (user.id) {
        setCareerLoading(true);
        careerAPI.getCareer(user.id)
          .then((res) => setCareer(res.data))
          .catch(() => setCareer(null))
          .finally(() => setCareerLoading(false));
        playerCardAPI.getCard(user.id)
          .then((res) => setPlayerCard(res.data))
          .catch(() => {});
      }
    } else if (role === "venue_owner") {
      venueAPI.getOwnerVenues().then(async (res) => {
        const venues = res.data || [];
        setOwnerVenues(venues);
        // Fetch analytics & reviews for each venue
        const analyticsMap = {};
        const reviewMap = {};
        await Promise.all(venues.map(async (v) => {
          const [aRes, rRes] = await Promise.all([
            analyticsAPI.venue(v.id).catch(() => ({ data: null })),
            venueAPI.getReviewSummary(v.id).catch(() => ({ data: null })),
          ]);
          if (aRes.data) analyticsMap[v.id] = aRes.data;
          if (rRes.data) reviewMap[v.id] = rRes.data;
        }));
        setVenueAnalytics(analyticsMap);
        setReviewSummaries(reviewMap);
      }).catch(() => {});
      bookingAPI.list().then((res) => setBookings(res.data || [])).catch(() => {});
    } else if (role === "coach") {
      coachingAPI.stats().then((res) => setCoachStats(res.data)).catch(() => {});
      coachingAPI.listSessions().then((res) => setCoachSessions(res.data || [])).catch(() => {});
      organizationAPI.my().then((res) => setCoachOrgs(res.data || [])).catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const role = user?.role;
      if (role === "coach") {
        // Coach: dual save — auth profile + coaching profile
        const { name, phone, coaching_bio, coaching_sports, session_price, session_duration_minutes, city, coaching_venue } = form;
        const [authRes] = await Promise.all([
          authAPI.updateProfile({ name, phone }),
          coachingAPI.updateProfile({
            coaching_bio, city, coaching_venue,
            coaching_sports: coaching_sports.split(",").map(s => s.trim()).filter(Boolean),
            session_price: Number(session_price) || 0,
            session_duration_minutes: Number(session_duration_minutes) || 60,
          }),
        ]);
        updateUser(authRes.data);
      } else {
        const payload = { ...form };
        if (role === "player" && typeof payload.sports === "string") {
          payload.sports = payload.sports.split(",").map(s => s.trim()).filter(Boolean);
        }
        const res = await authAPI.updateProfile(payload);
        updateUser(res.data);
      }
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadAPI.image(file);
      const url = res.data.url;
      const profileRes = await authAPI.updateProfile({ avatar: url });
      updateUser(profileRes.data);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // Document upload helpers
  const DOC_SLOTS = [
    { key: "business_license", label: "Business License", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
    { key: "gst_certificate", label: "GST Certificate", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
    { key: "id_proof", label: "ID Proof", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
    { key: "address_proof", label: "Address Proof", type: "document", accept: "image/*,.pdf", multiple: false, required: true },
    { key: "turf_images", label: "Turf Images", type: "image", accept: "image/*", multiple: true, required: false },
    { key: "turf_videos", label: "Turf Videos", type: "video", accept: "video/*", multiple: true, required: false },
  ];

  const handleDocUpload = async (slotKey, files, slotType) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(slotKey);
    setUploadProgress(0);
    try {
      const onProgress = (e) => { if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
      const slotDef = DOC_SLOTS.find(s => s.key === slotKey);
      const isMultiple = slotDef?.multiple;
      if (!isMultiple) {
        // Single file upload (business_license, gst_certificate, id_proof, address_proof)
        const file = files[0];
        const res = slotType === "document"
          ? await uploadAPI.document(file, onProgress)
          : await uploadAPI.image(file, onProgress);
        const docData = { url: res.data.url, uploaded_at: new Date().toISOString() };
        const newDocs = { ...docs, [slotKey]: docData };
        setDocs(newDocs);
        await authAPI.updateVerificationDocs({ [slotKey]: docData });
      } else {
        // Multiple files (turf_images or turf_videos)
        const existing = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
        const uploaded = [];
        for (const file of files) {
          const res = slotType === "image"
            ? await uploadAPI.image(file, onProgress)
            : await uploadAPI.video(file, onProgress);
          uploaded.push({ url: res.data.url, uploaded_at: new Date().toISOString() });
        }
        const merged = [...existing, ...uploaded];
        const newDocs = { ...docs, [slotKey]: merged };
        setDocs(newDocs);
        await authAPI.updateVerificationDocs({ [slotKey]: merged });
      }
      toast.success("Uploaded successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploadingDoc(null);
      setUploadProgress(0);
    }
  };

  const handleRemoveDoc = async (slotKey, index) => {
    const current = docs[slotKey];
    let newVal;
    if (Array.isArray(current)) {
      newVal = current.filter((_, i) => i !== index);
    } else {
      newVal = null;
    }
    const newDocs = { ...docs, [slotKey]: newVal };
    setDocs(newDocs);
    await authAPI.updateVerificationDocs({ [slotKey]: newVal }).catch(() => {});
  };

  const handleSubmitForReview = async () => {
    setSubmittingDocs(true);
    try {
      const res = await authAPI.updateVerificationDocs({ submit: true });
      updateUser(res.data);
      toast.success("Documents submitted for review!");
    } catch (err) {
      toast.error("Failed to submit documents");
    } finally {
      setSubmittingDocs(false);
    }
  };

  const allRequiredDocsUploaded = DOC_SLOTS.filter(s => s.required).every(s => docs[s.key]?.url);
  const allRequiredCoachDocsUploaded = COACH_DOC_SLOTS.filter(s => s.required).every(s => docs[s.key]?.url);
  const docStatus = user?.doc_verification_status || "not_uploaded";

  // Coach document handlers
  const handleCoachDocUpload = async (slotKey, files) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(slotKey);
    setUploadProgress(0);
    try {
      const onProgress = (e) => { if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
      const slotDef = COACH_DOC_SLOTS.find(s => s.key === slotKey);
      if (slotDef?.multiple) {
        const existing = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
        const uploaded = [];
        for (const file of files) {
          const res = await uploadAPI.document(file, onProgress);
          uploaded.push({ url: res.data.url, uploaded_at: new Date().toISOString() });
        }
        const merged = [...existing, ...uploaded];
        const newDocs = { ...docs, [slotKey]: merged };
        setDocs(newDocs);
        await authAPI.updateCoachVerificationDocs({ [slotKey]: merged });
      } else {
        const file = files[0];
        const res = slotDef?.type === "image"
          ? await uploadAPI.image(file, onProgress)
          : await uploadAPI.document(file, onProgress);
        const docData = { url: res.data.url, uploaded_at: new Date().toISOString() };
        const newDocs = { ...docs, [slotKey]: docData };
        setDocs(newDocs);
        await authAPI.updateCoachVerificationDocs({ [slotKey]: docData });
      }
      toast.success("Uploaded successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally { setUploadingDoc(null); setUploadProgress(0); }
  };

  const handleCoachRemoveDoc = async (slotKey, index) => {
    const slotDef = COACH_DOC_SLOTS.find(s => s.key === slotKey);
    let newVal;
    if (slotDef?.multiple) {
      const current = Array.isArray(docs[slotKey]) ? docs[slotKey] : [];
      newVal = current.filter((_, i) => i !== index);
    } else {
      newVal = null;
    }
    const newDocs = { ...docs, [slotKey]: newVal };
    setDocs(newDocs);
    await authAPI.updateCoachVerificationDocs({ [slotKey]: newVal }).catch(() => {});
    toast.success("Document removed");
  };

  const handleCoachSubmitForReview = async () => {
    setSubmittingDocs(true);
    try {
      const res = await authAPI.updateCoachVerificationDocs({ submit: true });
      updateUser(res.data);
      toast.success("Documents submitted for review!");
    } catch (err) {
      toast.error("Failed to submit documents");
    } finally { setSubmittingDocs(false); }
  };

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
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
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
    } catch { toast.error("Image upload failed"); }
  };

  const getRatingTier = (r) => {
    if (r >= 2500) return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-500/10" };
    if (r >= 2000) return { label: "Gold", color: "text-amber-400", bg: "bg-amber-500/10" };
    if (r >= 1500) return { label: "Silver", color: "text-slate-300", bg: "bg-slate-500/10" };
    return { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10" };
  };

  const tier = getRatingTier(user?.skill_rating || 1500);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="profile-page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <div className="glass-card rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Clickable avatar with camera overlay */}
            <div className="relative group">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-16 h-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center relative focus:outline-none focus:ring-2 focus:ring-primary"
                title="Change profile photo"
              >
                {user?.avatar ? (
                  <img src={mediaUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-black text-2xl text-primary">{user?.name?.[0]?.toUpperCase()}</span>
                )}
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  {uploadingAvatar
                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                    : <Camera className="h-5 w-5 text-white" />}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-xl font-bold text-foreground">{user?.name}</h1>
                {(user?.is_verified || playerCard?.is_verified || (user?.role === "coach" && user?.doc_verification_status === "verified")) && (
                  <BadgeCheck className="h-5 w-5 text-blue-400 shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">{user?.role === "player" ? "LOBBIAN" : user?.role?.replace("_", " ").toUpperCase()}</Badge>
            </div>
          </div>

          {/* Role-specific stats grid */}
          {user?.role === "player" && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Trophy className={`h-5 w-5 mx-auto mb-1 ${tier.color}`} />
                <div className={`text-lg font-display font-black ${tier.color}`}>{user?.skill_rating || 1500}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">{tier.label}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-lg font-display font-black">{stats?.total_games || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Games</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Star className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <div className="text-lg font-display font-black">
                  {stats?.total_games ? `${Math.round((stats.wins / stats.total_games) * 100)}%` : "0%"}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Win Rate</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-brand-400" />
                <div className="text-lg font-display font-black text-brand-400">{stats?.wins || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Wins</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <XCircle className="h-5 w-5 mx-auto mb-1 text-red-400" />
                <div className="text-lg font-display font-black text-red-400">{stats?.losses || user?.losses || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Losses</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Minus className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <div className="text-lg font-display font-black text-amber-400">{stats?.draws || user?.draws || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Draws</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Shield className="h-5 w-5 mx-auto mb-1 text-sky-400" />
                <div className="text-lg font-display font-black">{user?.reliability_score || 100}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Reliability</div>
                {(user?.no_shows > 0) && <div className="text-[9px] text-red-400 mt-0.5">{user.no_shows} no-show{user.no_shows > 1 ? "s" : ""}</div>}
              </div>
            </div>
          )}

          {user?.role === "venue_owner" && (() => {
            const totalBookings = Object.values(venueAnalytics || {}).reduce((s, a) => s + (a?.total_bookings || 0), 0);
            const totalRevenue = Object.values(venueAnalytics || {}).reduce((s, a) => s + (a?.total_revenue || 0), 0);
            const ratings = Object.values(reviewSummaries || {}).filter(r => r?.average_rating > 0);
            const ratingSum = ratings.reduce((s, r) => s + (Number(r.average_rating) || 0), 0);
            const avgRating = ratings.length > 0 ? (ratingSum / ratings.length).toFixed(1) : "N/A";
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-display font-black">{ownerVenues.length}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Venues</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-brand-400" />
                  <div className="text-lg font-display font-black">{totalBookings}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Bookings</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                  <div className="text-lg font-display font-black">{"\u20B9"}{(totalRevenue || 0).toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Revenue</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <Star className="h-5 w-5 mx-auto mb-1 text-violet-400" />
                  <div className="text-lg font-display font-black">{avgRating}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase">Avg Rating</div>
                </div>
              </div>
            );
          })()}

          {user?.role === "coach" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-lg font-display font-black">{coachStats?.total_sessions || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Sessions</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-brand-400" />
                <div className="text-lg font-display font-black">{"\u20B9"}{(coachStats?.total_revenue || 0).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Revenue</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Star className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <div className="text-lg font-display font-black">{coachStats?.average_rating?.toFixed(1) || "N/A"}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Avg Rating</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50">
                <Users className="h-5 w-5 mx-auto mb-1 text-violet-400" />
                <div className="text-lg font-display font-black">{coachStats?.active_subscribers || 0}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase">Subscribers</div>
              </div>
            </div>
          )}

          {playerCard?.overall_score !== undefined && (
            <div className="flex items-center gap-4 mt-4 p-4 rounded-xl bg-background/50">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted-foreground/20" />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7"
                    strokeDasharray={`${playerCard.overall_score * 2.64} 264`} strokeLinecap="round"
                    className={playerCard.overall_score >= 86 ? "text-amber-400" : playerCard.overall_score >= 71 ? "text-violet-400" : playerCard.overall_score >= 51 ? "text-brand-400" : playerCard.overall_score >= 31 ? "text-blue-400" : "text-muted-foreground"} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-xl font-black">{playerCard.overall_score}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-display text-sm font-black">Overall Score</div>
                  <button onClick={() => navigate(`/lobbian/${user?.id}`)}
                    className="p-0.5 rounded-full hover:bg-muted transition-colors" title="View full breakdown & how to level up">
                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
                <Badge className={`text-[10px] mt-1 ${playerCard.overall_score >= 86 ? "bg-amber-400/20 text-amber-400" : playerCard.overall_score >= 71 ? "bg-violet-400/20 text-violet-400" : playerCard.overall_score >= 51 ? "bg-brand-400/20 text-brand-400" : playerCard.overall_score >= 31 ? "bg-blue-400/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
                  {playerCard.overall_tier}
                </Badge>
                {playerCard.overall_score < 50 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {playerCard.overall_score < 20 ? "Play matches to start leveling up" :
                     playerCard.overall_score < 35 ? "Keep playing to improve your stats" :
                     "Almost Intermediate! Keep it up"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Venue Owner: Verification status banner */}
        {user?.role === "venue_owner" && docStatus !== "verified" && user?.account_status !== "active" && (
          <div className={`rounded-lg p-4 mb-6 border ${
            docStatus === "rejected" ? "bg-destructive/10 border-destructive/30" :
            docStatus === "pending_review" ? "bg-amber-500/10 border-amber-500/30" :
            "bg-blue-500/10 border-blue-500/30"
          }`}>
            {docStatus === "rejected" && (<>
              <div className="font-bold text-sm text-destructive mb-1 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> Documents Rejected
              </div>
              <div className="text-xs text-muted-foreground">{user.doc_rejection_reason || "Please re-upload corrected documents."}</div>
            </>)}
            {docStatus === "pending_review" && (<>
              <div className="font-bold text-sm text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Documents Under Review
              </div>
              <div className="text-xs text-muted-foreground">Your documents are being reviewed by the admin. You will be notified once approved.</div>
            </>)}
            {(docStatus === "not_uploaded" || !docStatus) && (<>
              <div className="font-bold text-sm text-blue-400 mb-1 flex items-center gap-1.5">
                <Upload className="h-4 w-4" /> Upload Verification Documents
              </div>
              <div className="text-xs text-muted-foreground">Please upload your business documents to get your account verified.</div>
            </>)}
          </div>
        )}

        {/* Coach: Verification status banner */}
        {user?.role === "coach" && user?.coach_type === "individual" && docStatus !== "verified" && (
          <div className={`rounded-lg p-4 mb-6 border ${
            docStatus === "rejected" ? "bg-destructive/10 border-destructive/30" :
            docStatus === "pending_review" ? "bg-blue-500/10 border-blue-500/30" :
            "bg-amber-500/10 border-amber-500/30"
          }`}>
            {docStatus === "rejected" && (<>
              <div className="font-bold text-sm text-destructive mb-1 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> Verification Rejected
              </div>
              <div className="text-xs text-muted-foreground">{user.doc_rejection_reason || "Please re-upload corrected documents."}</div>
            </>)}
            {docStatus === "pending_review" && (<>
              <div className="font-bold text-sm text-blue-400 mb-1 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Documents Under Review
              </div>
              <div className="text-xs text-muted-foreground">Your documents are being reviewed by the admin. You will be notified once approved.</div>
            </>)}
            {(docStatus === "not_uploaded" || !docStatus) && (<>
              <div className="font-bold text-sm text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Complete Your Profile Verification
              </div>
              <div className="text-xs text-muted-foreground">Upload your documents below to get verified and start coaching.</div>
            </>)}
          </div>
        )}

        <Tabs defaultValue="info" data-testid="profile-tabs">
          <TabsList className="bg-secondary/50 mb-6">
            <TabsTrigger value="info" className="font-bold">Info</TabsTrigger>
            {user?.role === "player" && <>
              <TabsTrigger value="history" className="font-bold">History</TabsTrigger>
              <TabsTrigger value="performance" className="font-bold">Performance</TabsTrigger>
            </>}
            {user?.role === "venue_owner" && <>
              <TabsTrigger value="documents" className="font-bold">Documents</TabsTrigger>
              <TabsTrigger value="venues" className="font-bold">Venues</TabsTrigger>
              <TabsTrigger value="reviews" className="font-bold">Reviews</TabsTrigger>
            </>}
            {user?.role === "coach" && <>
              {user?.coach_type === "individual" && (
                <TabsTrigger value="documents" className="font-bold">Documents</TabsTrigger>
              )}
              <TabsTrigger value="credentials" className="font-bold">Credentials</TabsTrigger>
              <TabsTrigger value="sessions" className="font-bold">Sessions</TabsTrigger>
              <TabsTrigger value="organizations" className="font-bold">Organizations</TabsTrigger>
            </>}
          </TabsList>

          {/* ===== INFO TAB (all roles) ===== */}
          <TabsContent value="info">
            <div className="glass-card rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">Personal Info</h3>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="edit-profile-btn">Edit</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} data-testid="save-profile-btn"
                      className="bg-primary text-primary-foreground">
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div><Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="profile-name-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Phone</Label>
                    <div className="flex mt-1">
                      <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs font-bold text-muted-foreground select-none">+91</span>
                      <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))}
                        className="bg-background border-border rounded-l-none" data-testid="profile-phone-input" placeholder="98765 43210" maxLength={10} />
                    </div></div>
                  {/* Lobbian-specific edit fields */}
                  {user?.role === "player" && (<>
                    <div><Label className="text-xs text-muted-foreground">Bio</Label>
                      <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                        placeholder="Tell Lobbians about yourself..." rows={3}
                        className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Sports (comma separated)</Label>
                      <Input value={form.sports} onChange={e => setForm(p => ({ ...p, sports: e.target.value }))}
                        placeholder="Football, Cricket, Badminton" className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Preferred Position</Label>
                      <Input value={form.preferred_position} onChange={e => setForm(p => ({ ...p, preferred_position: e.target.value }))}
                        placeholder="Midfielder, Goalkeeper..." className="mt-1 bg-background border-border"
                        data-testid="profile-position-input" /></div>
                  </>)}
                  {/* Venue Owner-specific edit fields */}
                  {user?.role === "venue_owner" && (<>
                    <div><Label className="text-xs text-muted-foreground">Business Name</Label>
                      <Input value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                        placeholder="Your business name" className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">GST Number</Label>
                      <Input value={form.gst_number} onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))}
                        placeholder="22AAAAA0000A1Z5" className="mt-1 bg-background border-border" /></div>
                  </>)}
                  {/* Coach-specific edit fields */}
                  {user?.role === "coach" && (<>
                    <div><Label className="text-xs text-muted-foreground">Coaching Bio</Label>
                      <Textarea value={form.coaching_bio} onChange={e => setForm(p => ({ ...p, coaching_bio: e.target.value }))}
                        placeholder="Tell Lobbians about your coaching experience..." rows={3}
                        className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Sports (comma separated)</Label>
                      <Input value={form.coaching_sports} onChange={e => setForm(p => ({ ...p, coaching_sports: e.target.value }))}
                        placeholder="Football, Cricket, Badminton" className="mt-1 bg-background border-border" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs text-muted-foreground">Session Price ({"\u20B9"})</Label>
                        <Input type="number" value={form.session_price} onChange={e => setForm(p => ({ ...p, session_price: e.target.value }))}
                          placeholder="500" className="mt-1 bg-background border-border" /></div>
                      <div><Label className="text-xs text-muted-foreground">Duration (mins)</Label>
                        <Input type="number" value={form.session_duration_minutes} onChange={e => setForm(p => ({ ...p, session_duration_minutes: e.target.value }))}
                          placeholder="60" className="mt-1 bg-background border-border" /></div>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">City</Label>
                      <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                        placeholder="Chennai" className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Coaching Venue</Label>
                      <Input value={form.coaching_venue} onChange={e => setForm(p => ({ ...p, coaching_venue: e.target.value }))}
                        placeholder="Venue name or address" className="mt-1 bg-background border-border" /></div>
                  </>)}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground">{user?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <span className="text-sm font-medium text-foreground">{user?.phone || "Not set"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <Badge variant="secondary" className="text-[10px]">{user?.role === "player" ? "LOBBIAN" : user?.role?.replace("_", " ").toUpperCase()}</Badge>
                  </div>
                  {/* Lobbian display fields */}
                  {user?.bio && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Bio</span>
                      <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{user.bio}</span>
                    </div>
                  )}
                  {user?.sports?.length > 0 && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Sports</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {user.sports.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {user?.preferred_position && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Position</span>
                      <span className="text-sm font-medium text-foreground">{user.preferred_position}</span>
                    </div>
                  )}
                  {/* Venue Owner display fields */}
                  {user?.role === "venue_owner" && (<>
                    {user.business_name && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Business Name</span>
                        <span className="text-sm font-medium text-foreground">{user.business_name}</span>
                      </div>
                    )}
                    {user.gst_number && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">GST Number</span>
                        <span className="text-sm font-medium text-foreground">{user.gst_number}</span>
                      </div>
                    )}
                  </>)}
                  {/* Coach display fields */}
                  {user?.role === "coach" && (<>
                    {user.coaching_bio && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Bio</span>
                        <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{user.coaching_bio}</span>
                      </div>
                    )}
                    {user.coaching_sports?.length > 0 && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Sports</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {user.coaching_sports.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                        </div>
                      </div>
                    )}
                    {user.session_price && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Session Price</span>
                        <span className="text-sm font-medium text-foreground">{"\u20B9"}{user.session_price} / {user.session_duration_minutes || 60} min</span>
                      </div>
                    )}
                    {user.city && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">City</span>
                        <span className="text-sm font-medium text-foreground">{user.city}</span>
                      </div>
                    )}
                    {user.coaching_venue && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Coaching Venue</span>
                        <span className="text-sm font-medium text-foreground">{user.coaching_venue}</span>
                      </div>
                    )}
                    {user?.coaching_rating > 0 && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Rating</span>
                        <span className="text-sm font-medium text-foreground flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-400" /> {Number(user.coaching_rating).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </>)}
                </div>
              )}

              {/* Password Change */}
              <div className="mt-6 border border-border rounded-lg overflow-hidden">
                <button onClick={() => setShowPwChange(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors">
                  <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> Change Password</span>
                  <span className="text-muted-foreground text-xs">{showPwChange ? "▲" : "▼"}</span>
                </button>
                {showPwChange && (
                  <div className="px-4 pb-4 space-y-3">
                    <div><Label className="text-xs text-muted-foreground">Current Password</Label>
                      <div className="relative mt-1">
                        <Input type={showPw ? "text" : "password"} value={pwForm.current}
                          onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                          className="bg-background border-border pr-10" placeholder="Enter current password" />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">New Password</Label>
                      <Input type={showPw ? "text" : "password"} value={pwForm.new_pw}
                        onChange={e => setPwForm(p => ({ ...p, new_pw: e.target.value }))}
                        className="mt-1 bg-background border-border" placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Confirm New Password</Label>
                      <Input type={showPw ? "text" : "password"} value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                        className="mt-1 bg-background border-border" placeholder="Re-enter new password" />
                    </div>
                    <Button className="w-full font-bold" disabled={changingPw || !pwForm.current || !pwForm.new_pw || !pwForm.confirm}
                      onClick={async () => {
                        if (pwForm.new_pw !== pwForm.confirm) { toast.error("Passwords don't match"); return; }
                        setChangingPw(true);
                        try {
                          const res = await authAPI.changePassword({ current_password: pwForm.current, new_password: pwForm.new_pw });
                          localStorage.setItem("horizon_token", res.data.token);
                          localStorage.setItem("horizon_refresh_token", res.data.refresh_token);
                          toast.success("Password changed!");
                          setPwForm({ current: "", new_pw: "", confirm: "" });
                          setShowPwChange(false);
                        } catch (err) {
                          toast.error(err?.response?.data?.detail || "Failed to change password");
                        } finally { setChangingPw(false); }
                      }}>
                      {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                    </Button>
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 mt-4"
                onClick={logout} data-testid="profile-logout-btn">
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </TabsContent>

          {/* ===== LOBBIAN: History Tab ===== */}
          {user?.role === "player" && (
            <TabsContent value="history">
              {bookings.length === 0 ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No booking history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.slice(0, 15).map(b => (
                    <div key={b.id} className="glass-card rounded-lg p-4 flex items-center justify-between" data-testid={`history-card-${b.id}`}>
                      <div>
                        <div className="font-bold text-sm text-foreground">{b.venue_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{b.date} | {b.start_time}-{b.end_time} | {b.sport}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-foreground">{"\u20B9"}{b.total_amount}</div>
                        <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                          className="text-[10px]">{b.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== LOBBIAN: Performance Tab ===== */}
          {user?.role === "player" && (
            <TabsContent value="performance">
              {careerLoading ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                  <p className="text-sm">Loading performance data...</p>
                </div>
              ) : !career ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-3" />
                  <p className="text-sm">No performance data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                      <BarChart3 className="h-5 w-5 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-display font-black text-foreground">{career.total_records || 0}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Total Records</div>
                    </div>
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                      <Clock className="h-5 w-5 mx-auto mb-2 text-blue-400" />
                      <div className="text-2xl font-display font-black text-foreground">{career.training_hours || 0}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Training Hours</div>
                    </div>
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                      <Award className="h-5 w-5 mx-auto mb-2 text-amber-400" />
                      <div className="text-2xl font-display font-black text-foreground">{career.tournaments_played || 0}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Tournaments</div>
                    </div>
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-4 text-center">
                      <Building2 className="h-5 w-5 mx-auto mb-2 text-brand-400" />
                      <div className="text-2xl font-display font-black text-foreground">
                        {career.organizations ? (Array.isArray(career.organizations) ? career.organizations.length : career.organizations) : 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Organizations</div>
                    </div>
                  </div>

                  <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                    <h3 className="font-display font-bold text-foreground mb-4">Records Timeline</h3>
                    {career.recent_records && career.recent_records.length > 0 ? (
                      <div className="space-y-3">
                        {career.recent_records.map((record, idx) => {
                          const typeColors = {
                            training: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                            match_result: "bg-brand-500/15 text-brand-400 border-brand-500/30",
                            assessment: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                            tournament_result: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                            achievement: "bg-rose-500/15 text-rose-400 border-rose-500/30",
                          };
                          const badgeClass = typeColors[record.type] || "bg-secondary text-muted-foreground border-border";
                          const statsObj = record.stats || record.data || {};
                          const statEntries = Object.entries(statsObj).slice(0, 4);
                          return (
                            <div key={record.id || idx} className="flex flex-col gap-2 p-3 rounded-lg bg-background/50 border border-border/50" data-testid={`perf-record-${record.id || idx}`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {record.date ? new Date(record.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                                  </span>
                                  <Badge className={`text-[10px] border ${badgeClass}`}>{(record.type || "unknown").replace("_", " ")}</Badge>
                                </div>
                                {record.sport && <Badge variant="outline" className="text-[10px]">{record.sport}</Badge>}
                              </div>
                              <div className="font-semibold text-sm text-foreground">{record.title || record.type || "Untitled"}</div>
                              {record.source_name && (
                                <div className="text-xs text-muted-foreground">Source: <span className="text-foreground/80">{record.source_name}</span></div>
                              )}
                              {statEntries.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {statEntries.map(([key, value]) => (
                                    <span key={key} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground">
                                      <span className="font-medium text-foreground/70">{key.replace(/_/g, " ")}:</span> {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">No records yet</p>
                    )}
                  </div>

                  {career.records_by_sport && Object.keys(career.records_by_sport).length > 0 && (
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                      <h3 className="font-display font-bold text-foreground mb-4">Sport Breakdown</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(career.records_by_sport).map(([sport, count]) => (
                          <Badge key={sport} variant="secondary" className="text-xs px-3 py-1.5 font-mono">
                            {sport} <span className="ml-1.5 font-black text-primary">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {career.records_by_source && Object.keys(career.records_by_source).length > 0 && (
                    <div className="bg-card/80 dark:bg-card/50 border border-border rounded-xl p-5">
                      <h3 className="font-display font-bold text-foreground mb-4">Source Breakdown</h3>
                      <div className="space-y-2">
                        {Object.entries(career.records_by_source).map(([source, count]) => (
                          <div key={source} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <span className="text-sm text-foreground">{source}</span>
                            <span className="text-sm font-display font-bold text-muted-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== VENUE OWNER: Documents Tab ===== */}
          {user?.role === "venue_owner" && (
            <TabsContent value="documents">
              <div className="space-y-4">
                {/* Required documents */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DOC_SLOTS.filter(s => !s.multiple).map(slot => {
                    const doc = docs[slot.key];
                    const isUploading = uploadingDoc === slot.key;
                    const isPdf = doc?.url?.toLowerCase().endsWith(".pdf");
                    return (
                      <div key={slot.key} className="glass-card rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-bold uppercase flex items-center gap-1">
                            {slot.label}
                            {slot.required && <span className="text-destructive">*</span>}
                          </Label>
                          {doc?.url && <CheckCircle2 className="h-4 w-4 text-brand-400" />}
                        </div>
                        {doc?.url ? (
                          <div className="space-y-2">
                            {isPdf ? (
                              <a href={mediaUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 rounded-md bg-background/50 text-sm text-primary hover:underline">
                                <FileText className="h-5 w-5" /> View PDF Document
                              </a>
                            ) : (
                              <img src={mediaUrl(doc.url)} alt={slot.label}
                                className="w-full h-32 object-contain rounded-md bg-background/50 cursor-pointer"
                                onClick={() => window.open(mediaUrl(doc.url), "_blank")} />
                            )}
                            {docStatus !== "pending_review" && (
                              <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground"
                                onClick={() => handleRemoveDoc(slot.key)}>
                                Replace
                              </Button>
                            )}
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            isUploading ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-primary/5"
                          }`}>
                            {isUploading ? (
                              <div className="w-full space-y-2">
                                <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                                <Progress value={uploadProgress} className="h-1.5" />
                                <div className="text-[10px] text-center text-muted-foreground">{uploadProgress}%</div>
                              </div>
                            ) : (<>
                              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Click to upload</span>
                              <span className="text-[10px] text-muted-foreground/60 mt-0.5">Image or PDF, max 10MB</span>
                            </>)}
                            <input type="file" accept={slot.accept} className="hidden" disabled={isUploading}
                              onChange={(e) => handleDocUpload(slot.key, e.target.files, slot.type)} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Turf Images */}
                {DOC_SLOTS.filter(s => s.key === "turf_images").map(slot => {
                  const items = Array.isArray(docs[slot.key]) ? docs[slot.key] : [];
                  const isUploading = uploadingDoc === slot.key;
                  return (
                    <div key={slot.key} className="glass-card rounded-lg p-4">
                      <Label className="text-xs font-bold uppercase mb-3 block">{slot.label}</Label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {items.map((img, i) => (
                          <div key={i} className="relative group">
                            <img src={mediaUrl(img.url || img)} alt={`Turf ${i + 1}`}
                              className="w-20 h-20 rounded-md object-cover cursor-pointer"
                              onClick={() => window.open(mediaUrl(img.url || img), "_blank")} />
                            {docStatus !== "pending_review" && (
                              <button className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveDoc(slot.key, i)}>x</button>
                            )}
                          </div>
                        ))}
                        {docStatus !== "pending_review" && (
                          <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer border-border hover:border-primary/30">
                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (<>
                              <Image className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground mt-0.5">Add</span>
                            </>)}
                            <input type="file" accept={slot.accept} multiple className="hidden" disabled={isUploading}
                              onChange={(e) => handleDocUpload(slot.key, e.target.files, slot.type)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Turf Videos */}
                {DOC_SLOTS.filter(s => s.key === "turf_videos").map(slot => {
                  const items = Array.isArray(docs[slot.key]) ? docs[slot.key] : [];
                  const isUploading = uploadingDoc === slot.key;
                  return (
                    <div key={slot.key} className="glass-card rounded-lg p-4">
                      <Label className="text-xs font-bold uppercase mb-3 block">{slot.label}</Label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {items.map((vid, i) => (
                          <div key={i} className="relative group">
                            <video src={mediaUrl(vid.url || vid)} controls
                              className="w-36 h-24 rounded-md object-cover" />
                            {docStatus !== "pending_review" && (
                              <button className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveDoc(slot.key, i)}>x</button>
                            )}
                          </div>
                        ))}
                        {docStatus !== "pending_review" && (
                          <label className="w-36 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer border-border hover:border-primary/30">
                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (<>
                              <Video className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground mt-0.5">Add Video</span>
                            </>)}
                            <input type="file" accept={slot.accept} multiple className="hidden" disabled={isUploading}
                              onChange={(e) => handleDocUpload(slot.key, e.target.files, slot.type)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Agreement checkbox + Submit for Review button */}
                {docStatus !== "pending_review" && docStatus !== "verified" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <Checkbox id="agree-terms" checked={agreedToTerms} onCheckedChange={setAgreedToTerms} className="mt-0.5" />
                      <label htmlFor="agree-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        I confirm that all uploaded documents are genuine and I agree to the{" "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                          Terms & Conditions
                        </a>{" "}and{" "}
                        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                          Privacy Policy
                        </a>.
                      </label>
                    </div>
                    <Button onClick={handleSubmitForReview}
                      disabled={!allRequiredDocsUploaded || !agreedToTerms || submittingDocs || !!uploadingDoc}
                      className="w-full bg-primary text-primary-foreground">
                      {submittingDocs ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : (
                        <><Upload className="h-4 w-4 mr-2" /> Submit Documents for Review</>
                      )}
                    </Button>
                  </div>
                )}
                {!allRequiredDocsUploaded && docStatus !== "pending_review" && docStatus !== "verified" && (
                  <p className="text-[10px] text-muted-foreground text-center">Upload all required documents (*) to submit for review</p>
                )}
              </div>
            </TabsContent>
          )}

          {/* ===== VENUE OWNER: Venues Tab ===== */}
          {user?.role === "venue_owner" && (
            <TabsContent value="venues">
              {ownerVenues.length === 0 ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No venues added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownerVenues.map(v => {
                    const va = venueAnalytics[v.id] || {};
                    return (
                      <div key={v.id} className="glass-card rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-bold text-sm text-foreground">{v.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {v.city}{v.area ? `, ${v.area}` : ""}
                            </div>
                          </div>
                          <Badge variant={v.status === "active" ? "default" : "secondary"} className="text-[10px]">{v.status || "active"}</Badge>
                        </div>
                        {v.sports?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {v.sports.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-center p-2 rounded-md bg-background/50">
                            <div className="text-sm font-display font-bold">{va.total_bookings || 0}</div>
                            <div className="text-[9px] text-muted-foreground font-mono uppercase">Bookings</div>
                          </div>
                          <div className="text-center p-2 rounded-md bg-background/50">
                            <div className="text-sm font-display font-bold">{"\u20B9"}{(va.total_revenue || 0).toLocaleString("en-IN")}</div>
                            <div className="text-[9px] text-muted-foreground font-mono uppercase">Revenue</div>
                          </div>
                          <div className="text-center p-2 rounded-md bg-background/50">
                            <div className="text-sm font-display font-bold flex items-center justify-center gap-0.5">
                              <Star className="h-3 w-3 text-amber-400" /> {reviewSummaries[v.id]?.average_rating?.toFixed(1) || "N/A"}
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono uppercase">Rating</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== VENUE OWNER: Reviews Tab ===== */}
          {user?.role === "venue_owner" && (
            <TabsContent value="reviews">
              {Object.keys(reviewSummaries).length === 0 ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ownerVenues.filter(v => reviewSummaries[v.id]).map(v => {
                    const rs = reviewSummaries[v.id];
                    return (
                      <div key={v.id} className="glass-card rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-display font-bold text-sm">{v.name}</h4>
                          <div className="flex items-center gap-1 text-sm font-display font-bold">
                            <Star className="h-4 w-4 text-amber-400" /> {rs.average_rating?.toFixed(1) || "N/A"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">{rs.total_reviews || 0} total reviews</div>
                        {rs.rating_distribution && (
                          <div className="space-y-1.5">
                            {[5, 4, 3, 2, 1].map(star => {
                              const count = rs.rating_distribution[star] || 0;
                              const pct = rs.total_reviews ? Math.round((count / rs.total_reviews) * 100) : 0;
                              return (
                                <div key={star} className="flex items-center gap-2 text-xs">
                                  <span className="w-3 text-right text-muted-foreground">{star}</span>
                                  <Star className="h-3 w-3 text-amber-400" />
                                  <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-8 text-right text-muted-foreground">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== COACH: Documents Tab (Individual only) ===== */}
          {user?.role === "coach" && user?.coach_type === "individual" && (
            <TabsContent value="documents">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Verification Documents
                  </h3>
                  {docStatus === "verified" && (
                    <Badge className="bg-green-500/10 text-green-500 text-[10px]">Verified</Badge>
                  )}
                  {docStatus === "pending_review" && (
                    <Badge className="bg-blue-500/10 text-blue-500 text-[10px]">Under Review</Badge>
                  )}
                  {docStatus === "rejected" && (
                    <Badge className="bg-red-500/10 text-red-500 text-[10px]">Rejected</Badge>
                  )}
                </div>
                {docStatus === "rejected" && user?.doc_rejection_reason && (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-500">
                    <strong>Rejection reason:</strong> {user.doc_rejection_reason}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Upload required documents to get verified. <span className="text-red-500">*</span> marks mandatory.</p>

                <div className="space-y-3">
                  {COACH_DOC_SLOTS.map(slot => {
                    const doc = docs[slot.key];
                    const isUploaded = slot.multiple ? (Array.isArray(doc) && doc.length > 0) : !!doc?.url;
                    const isUploading = uploadingDoc === slot.key;
                    const isPdf = !slot.multiple && doc?.url?.toLowerCase().endsWith(".pdf");
                    return (
                      <div key={slot.key} className={`glass-card rounded-lg p-4 ${isUploaded ? "border border-green-500/30 bg-green-500/5" : ""}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-bold uppercase flex items-center gap-1">
                            {slot.label} {slot.required && <span className="text-destructive">*</span>}
                          </Label>
                          {isUploaded && !isUploading && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              {docStatus !== "pending_review" && docStatus !== "verified" && (
                                <button onClick={() => handleCoachRemoveDoc(slot.key)} className="text-muted-foreground hover:text-red-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {isUploading ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Uploading... {uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-1.5" />
                          </div>
                        ) : isUploaded && !slot.multiple ? (
                          <div className="space-y-2">
                            {isPdf ? (
                              <a href={mediaUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 rounded-md bg-background/50 text-sm text-primary hover:underline">
                                <FileText className="h-5 w-5" /> View PDF
                              </a>
                            ) : (
                              <img src={mediaUrl(doc.url)} alt={slot.label}
                                className="w-full h-32 object-contain rounded-md bg-background/50 cursor-pointer"
                                onClick={() => window.open(mediaUrl(doc.url), "_blank")} />
                            )}
                          </div>
                        ) : isUploaded && slot.multiple ? (
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(doc) ? doc : []).map((item, i) => (
                              <div key={i} className="relative group">
                                <a href={mediaUrl(item.url || item)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 p-2 rounded-md bg-background/50 text-xs text-primary hover:underline">
                                  <FileText className="h-4 w-4" /> Doc {i + 1}
                                </a>
                                {docStatus !== "pending_review" && docStatus !== "verified" && (
                                  <button className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleCoachRemoveDoc(slot.key, i)}>x</button>
                                )}
                              </div>
                            ))}
                            {docStatus !== "pending_review" && docStatus !== "verified" && (
                              <label className="flex items-center gap-1 p-2 rounded-md border border-dashed border-border text-xs text-primary cursor-pointer hover:border-primary/30">
                                <Plus className="h-3.5 w-3.5" /> Add more
                                <input type="file" className="hidden" accept="image/*,.pdf" multiple
                                  onChange={e => handleCoachDocUpload(slot.key, e.target.files)} />
                              </label>
                            )}
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors border-border hover:border-primary/30 hover:bg-primary/5`}>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Click to upload</span>
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5">{slot.type === "image" ? "Image, max 10MB" : "Image or PDF, max 10MB"}</span>
                            <input type="file" className="hidden"
                              accept={slot.type === "image" ? "image/*" : "image/*,.pdf"}
                              multiple={!!slot.multiple}
                              onChange={e => handleCoachDocUpload(slot.key, e.target.files)} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Agreement + Submit */}
                {docStatus !== "pending_review" && docStatus !== "verified" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <Checkbox id="coach-agree-terms" checked={agreedToTerms} onCheckedChange={setAgreedToTerms} className="mt-0.5" />
                      <label htmlFor="coach-agree-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        I confirm that all uploaded documents are genuine and I agree to the{" "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Terms & Conditions</a>{" "}and{" "}
                        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Privacy Policy</a>.
                      </label>
                    </div>
                    <Button onClick={handleCoachSubmitForReview}
                      disabled={!allRequiredCoachDocsUploaded || !agreedToTerms || submittingDocs || !!uploadingDoc}
                      className="w-full bg-primary text-primary-foreground">
                      {submittingDocs ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : (
                        <><ShieldCheck className="h-4 w-4 mr-2" /> Submit Documents for Review</>
                      )}
                    </Button>
                  </div>
                )}
                {!allRequiredCoachDocsUploaded && docStatus !== "pending_review" && docStatus !== "verified" && (
                  <p className="text-[10px] text-muted-foreground text-center">Upload all required documents (<span className="text-red-500">*</span>) to submit for review</p>
                )}
              </div>
            </TabsContent>
          )}

          {/* ===== COACH: Credentials Tab ===== */}
          {user?.role === "coach" && (
            <TabsContent value="credentials">
              <div className="space-y-6">
                {/* Experience & Credentials */}
                <div className="glass-card rounded-lg p-6 space-y-4">
                  <h3 className="font-display font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Experience & Credentials
                  </h3>
                  <p className="text-xs text-muted-foreground">Shown on your public profile. Add images as proof to build trust.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Years of Experience</Label>
                      <Input type="number" min="0" value={experienceForm.years_of_experience}
                        onChange={e => setExperienceForm(p => ({ ...p, years_of_experience: e.target.value }))}
                        className="mt-1 bg-background border-border" />
                    </div>
                  </div>

                  {/* Specializations */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Specializations</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                      {experienceForm.specializations.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1">
                          {s}
                          <button onClick={() => setExperienceForm(p => ({ ...p, specializations: p.specializations.filter((_, j) => j !== i) }))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newSpecialization} onChange={e => setNewSpecialization(e.target.value)}
                        placeholder="e.g. Batting technique" className="bg-background border-border text-sm flex-1"
                        onKeyDown={e => { if (e.key === "Enter" && newSpecialization.trim()) { e.preventDefault(); setExperienceForm(p => ({ ...p, specializations: [...p.specializations, newSpecialization.trim()] })); setNewSpecialization(""); }}} />
                      <Button size="sm" variant="outline" onClick={() => { if (newSpecialization.trim()) { setExperienceForm(p => ({ ...p, specializations: [...p.specializations, newSpecialization.trim()] })); setNewSpecialization(""); }}}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Achievements with image support */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Achievements</Label>
                    <div className="space-y-2 mt-1 mb-2">
                      {experienceForm.achievements.map((a, i) => (
                        <div key={i} className="rounded-lg border border-border bg-secondary/10 p-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                            <span className="flex-1 font-medium">{a.text}</span>
                            <button onClick={() => setExperienceForm(p => ({ ...p, achievements: p.achievements.filter((_, j) => j !== i) }))}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            {a.image ? (
                              <div className="relative group">
                                <img src={mediaUrl(a.image)} alt="" className="h-12 w-16 rounded object-cover" />
                                <button onClick={() => setExperienceForm(p => { const items = [...p.achievements]; items[i] = { ...items[i], image: "" }; return { ...p, achievements: items }; })}
                                  className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline">
                                <Camera className="h-3 w-3" /> Add proof image
                                <input type="file" className="hidden" accept="image/*"
                                  onChange={e => handleExperienceImageUpload("achievements", i, e.target.files)} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newAchievement} onChange={e => setNewAchievement(e.target.value)}
                        placeholder="e.g. State level player 2019" className="bg-background border-border text-sm flex-1"
                        onKeyDown={e => { if (e.key === "Enter" && newAchievement.trim()) { e.preventDefault(); setExperienceForm(p => ({ ...p, achievements: [...p.achievements, { text: newAchievement.trim(), image: "" }] })); setNewAchievement(""); }}} />
                      <Button size="sm" variant="outline" onClick={() => { if (newAchievement.trim()) { setExperienceForm(p => ({ ...p, achievements: [...p.achievements, { text: newAchievement.trim(), image: "" }] })); setNewAchievement(""); }}}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Awards with image support */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Awards</Label>
                    <div className="space-y-2 mt-1 mb-2">
                      {experienceForm.awards.map((a, i) => (
                        <div key={i} className="rounded-lg border border-border bg-secondary/10 p-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Award className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="flex-1 font-medium">{a.text}</span>
                            <button onClick={() => setExperienceForm(p => ({ ...p, awards: p.awards.filter((_, j) => j !== i) }))}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            {a.image ? (
                              <div className="relative group">
                                <img src={mediaUrl(a.image)} alt="" className="h-12 w-16 rounded object-cover" />
                                <button onClick={() => setExperienceForm(p => { const items = [...p.awards]; items[i] = { ...items[i], image: "" }; return { ...p, awards: items }; })}
                                  className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline">
                                <Camera className="h-3 w-3" /> Add proof image
                                <input type="file" className="hidden" accept="image/*"
                                  onChange={e => handleExperienceImageUpload("awards", i, e.target.files)} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newAward} onChange={e => setNewAward(e.target.value)}
                        placeholder="e.g. Best Coach Award 2023" className="bg-background border-border text-sm flex-1"
                        onKeyDown={e => { if (e.key === "Enter" && newAward.trim()) { e.preventDefault(); setExperienceForm(p => ({ ...p, awards: [...p.awards, { text: newAward.trim(), image: "" }] })); setNewAward(""); }}} />
                      <Button size="sm" variant="outline" onClick={() => { if (newAward.trim()) { setExperienceForm(p => ({ ...p, awards: [...p.awards, { text: newAward.trim(), image: "" }] })); setNewAward(""); }}}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Certifications with image support */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Certifications</Label>
                    <div className="space-y-2 mt-1 mb-2">
                      {experienceForm.certifications_list.map((c, i) => (
                        <div key={i} className="rounded-lg border border-border bg-secondary/10 p-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <BadgeCheck className="h-3 w-3 text-blue-500 shrink-0" />
                            <span className="flex-1 font-medium">{c.text}</span>
                            <button onClick={() => setExperienceForm(p => ({ ...p, certifications_list: p.certifications_list.filter((_, j) => j !== i) }))}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            {c.image ? (
                              <div className="relative group">
                                <img src={mediaUrl(c.image)} alt="" className="h-12 w-16 rounded object-cover" />
                                <button onClick={() => setExperienceForm(p => { const items = [...p.certifications_list]; items[i] = { ...items[i], image: "" }; return { ...p, certifications_list: items }; })}
                                  className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:underline">
                                <Camera className="h-3 w-3" /> Add proof image
                                <input type="file" className="hidden" accept="image/*"
                                  onChange={e => handleExperienceImageUpload("certifications_list", i, e.target.files)} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newCertification} onChange={e => setNewCertification(e.target.value)}
                        placeholder="e.g. NIS Diploma in Badminton" className="bg-background border-border text-sm flex-1"
                        onKeyDown={e => { if (e.key === "Enter" && newCertification.trim()) { e.preventDefault(); setExperienceForm(p => ({ ...p, certifications_list: [...p.certifications_list, { text: newCertification.trim(), image: "" }] })); setNewCertification(""); }}} />
                      <Button size="sm" variant="outline" onClick={() => { if (newCertification.trim()) { setExperienceForm(p => ({ ...p, certifications_list: [...p.certifications_list, { text: newCertification.trim(), image: "" }] })); setNewCertification(""); }}}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Playing History */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Playing History</Label>
                    <Textarea value={experienceForm.playing_history}
                      onChange={e => setExperienceForm(p => ({ ...p, playing_history: e.target.value }))}
                      rows={3} placeholder="Describe your playing career..."
                      className="mt-1 bg-background border-border" />
                  </div>

                  <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveExperience}>
                    <Save className="h-4 w-4 mr-2" /> Save Experience & Credentials
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ===== COACH: Sessions Tab ===== */}
          {user?.role === "coach" && (
            <TabsContent value="sessions">
              {coachSessions.length === 0 ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No coaching sessions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachSessions.slice(0, 20).map(s => (
                    <div key={s.id} className="glass-card rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-foreground">{s.student_name || s.player_name || "Lobbian"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.sport} | {s.date} {s.start_time && `| ${s.start_time}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-foreground">{"\u20B9"}{s.amount || s.price || 0}</div>
                        <Badge variant={s.status === "completed" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"}
                          className="text-[10px]">{s.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== COACH: Organizations Tab ===== */}
          {user?.role === "coach" && (
            <TabsContent value="organizations">
              {coachOrgs.length === 0 ? (
                <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No organizations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachOrgs.map(org => (
                    <div key={org.id} className="glass-card rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm text-foreground">{org.name}</div>
                        <Badge variant="secondary" className="text-[10px]">{org.sport || "Multi-sport"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="text-center p-2 rounded-md bg-background/50">
                          <div className="text-sm font-display font-bold">{org.players?.length || org.player_count || 0}</div>
                          <div className="text-[9px] text-muted-foreground font-mono uppercase">Lobbians</div>
                        </div>
                        <div className="text-center p-2 rounded-md bg-background/50">
                          <div className="text-sm font-display font-bold">{org.staff?.length || org.staff_count || 0}</div>
                          <div className="text-[9px] text-muted-foreground font-mono uppercase">Staff</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </div>
  );
}
