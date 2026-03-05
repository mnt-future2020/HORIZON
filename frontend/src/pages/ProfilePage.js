import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, analyticsAPI, bookingAPI, uploadAPI, careerAPI, venueAPI, coachingAPI, organizationAPI, playerCardAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogOut, Save, Loader2 } from "lucide-react";

// Profile Components
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { PlayerStats } from "@/components/profile/PlayerStats";
import { VenueOwnerStats } from "@/components/profile/VenueOwnerStats";
import { CoachStats } from "@/components/profile/CoachStats";
import { OverallScoreCard } from "@/components/profile/OverallScoreCard";
import { VerificationBanner } from "@/components/profile/VerificationBanner";
import { PasswordChangeSection } from "@/components/profile/PasswordChangeSection";
import { PersonalInfoForm } from "@/components/profile/PersonalInfoForm";
import { BookingHistory } from "@/components/profile/BookingHistory";
import { PerformanceTab } from "@/components/profile/PerformanceTab";
import { DocumentsUploadTab } from "@/components/profile/DocumentsUploadTab";
import { CoachDocumentsTab } from "@/components/profile/CoachDocumentsTab";
import { CoachCredentialsTab } from "@/components/profile/CoachCredentialsTab";
import { VenuesList } from "@/components/profile/VenuesList";
import { ReviewsList } from "@/components/profile/ReviewsList";
import { CoachSessionsList } from "@/components/profile/CoachSessionsList";
import { CoachOrganizationsList } from "@/components/profile/CoachOrganizationsList";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  
  // State
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
  


  // Rule 5.1: Calculate derived state during rendering
  const tier = useMemo(() => {
    const r = user?.skill_rating || 1500;
    if (r >= 2500) return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-500/10" };
    if (r >= 2000) return { label: "Gold", color: "text-amber-400", bg: "bg-amber-500/10" };
    if (r >= 1500) return { label: "Silver", color: "text-muted-foreground", bg: "bg-secondary" };
    return { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10" };
  }, [user?.skill_rating]);

  // Initialize form based on user role
  useEffect(() => {
    if (!user) return;
    const role = user.role;

    if (role === "player") {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        preferred_position: user.preferred_position || "",
        bio: user.bio || "",
        sports: (user.sports || []).join(", "),
      });
    } else if (role === "venue_owner") {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        business_name: user.business_name || "",
        gst_number: user.gst_number || "",
      });
    } else if (role === "coach") {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        coaching_bio: user.coaching_bio || "",
        coaching_sports: (user.coaching_sports || []).join(", "),
        session_price: user.session_price || "",
        session_duration_minutes: user.session_duration_minutes || 60,
        city: user.city || "",
        coaching_venue: user.coaching_venue || "",
      });
    } else {
      setForm({ name: user.name || "", phone: user.phone || "" });
    }

    // Rule 1.4: Promise.all for independent operations - parallel data loading
    if (role === "player") {
      const playerStatsPromise = analyticsAPI.player().catch(() => ({ data: null }));
      const bookingsPromise = bookingAPI.list().catch(() => ({ data: [] }));
      const careerPromise = user.id ? careerAPI.getCareer(user.id).catch(() => ({ data: null })) : Promise.resolve({ data: null });
      const playerCardPromise = user.id ? playerCardAPI.getCard(user.id).catch(() => ({ data: null })) : Promise.resolve({ data: null });

      setCareerLoading(true);
      Promise.all([playerStatsPromise, bookingsPromise, careerPromise, playerCardPromise])
        .then(([sRes, bRes, cRes, pRes]) => {
          setStats(sRes.data);
          setBookings(bRes.data || []);
          setCareer(cRes.data);
          setPlayerCard(pRes.data);
        })
        .finally(() => setCareerLoading(false));
    } else if (role === "venue_owner") {
      const venuesPromise = venueAPI.getOwnerVenues();
      const bookingsPromise = bookingAPI.list();

      Promise.all([venuesPromise, bookingsPromise])
        .then(async ([vRes, bRes]) => {
          const venues = vRes.data || [];
          setOwnerVenues(venues);
          setBookings(bRes.data || []);
          
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
        })
        .catch(() => {});
    } else if (role === "coach") {
      Promise.all([
        coachingAPI.stats().catch(() => ({ data: null })),
        coachingAPI.listSessions().catch(() => ({ data: [] })),
        organizationAPI.my().catch(() => ({ data: [] })),
      ]).then(([statsRes, sessionsRes, orgsRes]) => {
        setCoachStats(statsRes.data);
        setCoachSessions(sessionsRes.data || []);
        setCoachOrgs(orgsRes.data || []);
      });
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const role = user?.role;
      if (role === "coach") {
        const { name, phone, coaching_bio, coaching_sports, session_price, session_duration_minutes, city, coaching_venue } = form;
        const [authRes] = await Promise.all([
          authAPI.updateProfile({ name, phone }),
          coachingAPI.updateProfile({
            coaching_bio,
            city,
            coaching_venue,
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
  }, [form, user?.role, updateUser]);

  const handleAvatarUpload = useCallback(async (e) => {
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
  }, [updateUser]);

  if (!user) return null;

  return (
    <div className="mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="profile-page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <ProfileHeader
          user={user}
          playerCard={playerCard}
          uploadingAvatar={uploadingAvatar}
          onAvatarUpload={handleAvatarUpload}
        />

        {/* Stats Grid */}
        {(user?.role === "player" || user?.role === "venue_owner" || user?.role === "coach" || playerCard?.overall_score !== undefined) && (
          <div className="rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-lg p-6 sm:p-8 mb-6">
            {user?.role === "player" && <PlayerStats user={user} stats={stats} tier={tier} />}
            {user?.role === "venue_owner" && (
              <VenueOwnerStats
                ownerVenues={ownerVenues}
                venueAnalytics={venueAnalytics}
                reviewSummaries={reviewSummaries}
              />
            )}
            {user?.role === "coach" && <CoachStats coachStats={coachStats} />}

            {playerCard?.overall_score !== undefined && (
              <OverallScoreCard playerCard={playerCard} userId={user?.id} navigate={navigate} />
            )}
          </div>
        )}

        {/* Verification Banners */}
        <VerificationBanner
          role={user?.role}
          docStatus={user?.doc_verification_status}
          accountStatus={user?.account_status}
          rejectionReason={user?.doc_rejection_reason}
          coachType={user?.coach_type}
        />

        {/* Tabs */}
        <Tabs defaultValue="info" data-testid="profile-tabs" className="space-y-6">
          <TabsList className="bg-muted/50 mb-6 w-full justify-start overflow-x-auto touch-action-manipulation">
            <TabsTrigger value="info" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
              Info
            </TabsTrigger>
            {user?.role === "player" && (
              <>
                <TabsTrigger value="history" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  History
                </TabsTrigger>
                <TabsTrigger value="performance" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Performance
                </TabsTrigger>
              </>
            )}
            {user?.role === "venue_owner" && (
              <>
                <TabsTrigger value="documents" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Documents
                </TabsTrigger>
                <TabsTrigger value="venues" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Venues
                </TabsTrigger>
                <TabsTrigger value="reviews" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Reviews
                </TabsTrigger>
              </>
            )}
            {user?.role === "coach" && (
              <>
                {user?.coach_type === "individual" && (
                  <TabsTrigger value="documents" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                    Documents
                  </TabsTrigger>
                )}
                <TabsTrigger value="credentials" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Credentials
                </TabsTrigger>
                <TabsTrigger value="sessions" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="organizations" className="font-display font-bold data-[state=active]:bg-brand-600 data-[state=active]:text-white transition-all">
                  Organizations
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info">
            <div className="rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-lg p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-xl text-foreground">Personal Info</h3>
                  <p className="text-sm text-muted-foreground mt-1">Manage your account details</p>
                </div>
                {!editing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                    data-testid="edit-profile-btn"
                    className="font-semibold hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-400 transition-all duration-200"
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setEditing(false)} 
                      className="font-semibold hover:bg-muted transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      data-testid="save-profile-btn"
                      className="bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold hover:shadow-lg hover:shadow-brand-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1.5" aria-hidden="true" /> Save
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <PersonalInfoForm user={user} form={form} setForm={setForm} editing={editing} />

              <PasswordChangeSection />

              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 font-semibold min-h-[52px] touch-manipulation transition-all duration-200 hover:shadow-md"
                onClick={logout}
                data-testid="profile-logout-btn"
              >
                <LogOut className="h-5 w-5 mr-2" aria-hidden="true" /> Logout
              </Button>
            </div>
          </TabsContent>

          {/* Player History Tab */}
          {user?.role === "player" && (
            <TabsContent value="history">
              <BookingHistory bookings={bookings} />
            </TabsContent>
          )}

          {/* Player Performance Tab */}
          {user?.role === "player" && (
            <TabsContent value="performance">
              <PerformanceTab career={career} careerLoading={careerLoading} />
            </TabsContent>
          )}

          {/* Venue Owner Documents Tab */}
          {user?.role === "venue_owner" && (
            <TabsContent value="documents">
              <DocumentsUploadTab user={user} updateUser={updateUser} />
            </TabsContent>
          )}

          {/* Venue Owner Venues Tab */}
          {user?.role === "venue_owner" && (
            <TabsContent value="venues">
              <VenuesList
                ownerVenues={ownerVenues}
                venueAnalytics={venueAnalytics}
                reviewSummaries={reviewSummaries}
              />
            </TabsContent>
          )}

          {/* Venue Owner Reviews Tab */}
          {user?.role === "venue_owner" && (
            <TabsContent value="reviews">
              <ReviewsList ownerVenues={ownerVenues} reviewSummaries={reviewSummaries} />
            </TabsContent>
          )}

          {/* Coach Documents Tab (Individual only) */}
          {user?.role === "coach" && user?.coach_type === "individual" && (
            <TabsContent value="documents">
              <CoachDocumentsTab user={user} updateUser={updateUser} />
            </TabsContent>
          )}

          {/* Coach Credentials Tab */}
          {user?.role === "coach" && (
            <TabsContent value="credentials">
              <CoachCredentialsTab user={user} />
            </TabsContent>
          )}

          {/* Coach Sessions Tab */}
          {user?.role === "coach" && (
            <TabsContent value="sessions">
              <CoachSessionsList coachSessions={coachSessions} />
            </TabsContent>
          )}

          {/* Coach Organizations Tab */}
          {user?.role === "coach" && (
            <TabsContent value="organizations">
              <CoachOrganizationsList coachOrgs={coachOrgs} />
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </div>
  );
}
