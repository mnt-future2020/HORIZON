import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense, useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Clock, XCircle, ShieldAlert } from "lucide-react";

// Lazy load with retry: if chunk fails to load (stale cache after rebuild), retry once
function lazyRetry(importFn) {
  return lazy(() => importFn().catch((err) => {
    // Retry once after a small delay
    return new Promise(resolve => setTimeout(resolve, 500))
      .then(() => importFn())
      .catch(() => { throw err; });
  }));
}

// MEDIUM FIX #22: Lazy-load all pages — reduces initial bundle size significantly
// Only Navbar + ErrorBoundary are eagerly loaded (needed immediately)
const LandingPage = lazyRetry(() => import("@/pages/LandingPage"));
const AuthPage = lazyRetry(() => import("@/pages/AuthPage"));
const PlayerDashboard = lazyRetry(() => import("@/pages/PlayerDashboard"));
const VenueDiscovery = lazyRetry(() => import("@/pages/VenueDiscovery"));
const VenueDetail = lazyRetry(() => import("@/pages/VenueDetail"));
const MatchmakingPage = lazyRetry(() => import("@/pages/MatchmakingPage"));
const VenueOwnerDashboard = lazyRetry(() => import("@/pages/VenueOwnerDashboard"));
const CoachDashboard = lazyRetry(() => import("@/pages/CoachDashboard"));
const SplitPaymentPage = lazyRetry(() => import("@/pages/SplitPaymentPage"));
const ProfilePage = lazyRetry(() => import("@/pages/ProfilePage"));
const SuperAdminDashboard = lazyRetry(() => import("@/pages/SuperAdminDashboard"));
const LeaderboardPage = lazyRetry(() => import("@/pages/LeaderboardPage"));
const RatingProfilePage = lazyRetry(() => import("@/pages/RatingProfilePage"));
const HighlightsPage = lazyRetry(() => import("@/pages/HighlightsPage"));
const SharedHighlightPage = lazyRetry(() => import("@/pages/SharedHighlightPage"));
const IoTDashboard = lazyRetry(() => import("@/pages/IoTDashboard"));
const PublicVenuePage = lazyRetry(() => import("@/pages/PublicVenuePage"));
const POSPage = lazyRetry(() => import("@/pages/POSPage"));
const AboutPage = lazyRetry(() => import("@/pages/AboutPage"));
const ContactPage = lazyRetry(() => import("@/pages/ContactPage"));
const PrivacyPolicyPage = lazyRetry(() => import("@/pages/PrivacyPolicyPage"));
const TermsPage = lazyRetry(() => import("@/pages/TermsPage"));
const RefundPolicyPage = lazyRetry(() => import("@/pages/RefundPolicyPage"));
const NotificationsPage = lazyRetry(() => import("@/pages/NotificationsPage"));
const PrivacySettingsPage = lazyRetry(() => import("@/pages/PrivacySettingsPage"));
const SocialFeedPage = lazyRetry(() => import("@/pages/SocialFeedPage"));
const PlayerCardPage = lazyRetry(() => import("@/pages/PlayerCardPage"));
const TournamentsPage = lazyRetry(() => import("@/pages/TournamentsPage"));
const TournamentDetailPage = lazyRetry(() => import("@/pages/TournamentDetailPage"));
const CoachListingPage = lazyRetry(() => import("@/pages/CoachListingPage"));
const CommunitiesPage = lazyRetry(() => import("@/pages/CommunitiesPage"));
const GroupDetailPage = lazyRetry(() => import("@/pages/GroupDetailPage"));
const TeamsPage = lazyRetry(() => import("@/pages/TeamsPage"));
const ChatPage = lazyRetry(() => import("@/pages/ChatPage"));
const ExplorePage = lazyRetry(() => import("@/pages/ExplorePage"));
const BookmarksPage = lazyRetry(() => import("@/pages/BookmarksPage"));
const ContactSyncPage = lazyRetry(() => import("@/pages/ContactSyncPage"));
const NotFoundPage = lazyRetry(() => import("@/pages/NotFoundPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const VENUE_OWNER_ALLOWED_PATHS = ["/feed", "/chat", "/communities", "/profile"];

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  // Venue owner with unverified docs: only allow feed, chat, communities, profile
  if (user.role === "venue_owner" && (user.doc_verification_status || "not_uploaded") !== "verified") {
    const path = window.location.pathname;
    const allowed = VENUE_OWNER_ALLOWED_PATHS.some(p => path === p || path.startsWith(p + "/"));
    if (!allowed) {
      const docStatus = user.doc_verification_status || "not_uploaded";
      return (
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="glass-card rounded-lg p-8 space-y-4">
            <ShieldAlert className="h-12 w-12 text-amber-400 mx-auto" />
            <h1 className="font-display text-xl font-black">Account Not Verified</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {docStatus === "pending_review"
                ? "Your documents are under review. You'll get access once our team verifies them."
                : "To access this feature, please upload your verification documents and get your account verified."}
            </p>
            {docStatus !== "pending_review" && (
              <Button className="font-bold" onClick={() => window.location.href = "/profile"}>
                <Upload className="h-4 w-4 mr-2" /> Upload Documents
              </Button>
            )}
          </div>
        </div>
      );
    }
  }
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" />;
  return <Navigate to="/feed" />;
}

function DocVerificationPopup() {
  const { user } = useAuth();
  const docStatus = user?.doc_verification_status || "not_uploaded";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user && user.role === "venue_owner" && docStatus !== "verified") setOpen(true);
  }, [user, docStatus]);

  if (!user || user.role !== "venue_owner" || docStatus === "verified") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {docStatus === "rejected" ? <><XCircle className="h-5 w-5 text-destructive" /> Documents Rejected</> :
             docStatus === "pending_review" ? <><Clock className="h-5 w-5 text-amber-400" /> Under Review</> :
             <><Upload className="h-5 w-5 text-primary" /> Verify Your Account</>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          {docStatus === "not_uploaded" && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Upload your verification documents to get your account verified and unlock full venue management features.</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Business License</li>
                <li>GST Certificate</li>
                <li>ID Proof</li>
                <li>Address Proof</li>
              </ul>
            </div>
          )}
          {docStatus === "pending_review" && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-sm text-muted-foreground">Your documents have been submitted and are being reviewed by our team. We'll notify you once verified.</p>
            </div>
          )}
          {docStatus === "rejected" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Your documents were rejected. Please re-upload correct documents.</p>
              {user?.doc_rejection_reason && (
                <p className="text-xs text-destructive font-medium">Reason: {user.doc_rejection_reason}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Later</Button>
            {docStatus !== "pending_review" && (
              <Button className="flex-1 font-bold" onClick={() => { setOpen(false); window.location.href = "/profile"; }}>
                {docStatus === "rejected" ? "Re-upload Docs" : "Upload Docs"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      {user && <Navbar />}
      <DocVerificationPopup />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" /> : <LandingPage />} />
          <Route path="/auth" element={user ? <Navigate to="/feed" /> : <AuthPage />} />
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/player" element={<ProtectedRoute><PlayerDashboard /></ProtectedRoute>} />
          <Route path="/venues" element={<VenueDiscovery />} />
          <Route path="/venues/:id" element={<ProtectedRoute><VenueDetail /></ProtectedRoute>} />
          <Route path="/matchmaking" element={<ProtectedRoute><MatchmakingPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/rating-profile" element={<ProtectedRoute><RatingProfilePage /></ProtectedRoute>} />
          <Route path="/rating-profile/:userId" element={<ProtectedRoute><RatingProfilePage /></ProtectedRoute>} />
          <Route path="/owner" element={<ProtectedRoute roles={["venue_owner"]}><VenueOwnerDashboard /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute roles={["coach"]}><CoachDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/split/:token" element={<SplitPaymentPage />} />
          <Route path="/highlights" element={<ProtectedRoute><HighlightsPage /></ProtectedRoute>} />
          <Route path="/highlights/shared/:shareId" element={<SharedHighlightPage />} />
          <Route path="/iot" element={<ProtectedRoute roles={["venue_owner", "super_admin"]}><IoTDashboard /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute roles={["venue_owner", "super_admin"]}><POSPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/venue/:slug" element={<PublicVenuePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/privacy" element={<ProtectedRoute><PrivacySettingsPage /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><SocialFeedPage /></ProtectedRoute>} />
          <Route path="/player-card/:userId" element={<ProtectedRoute><PlayerCardPage /></ProtectedRoute>} />
          <Route path="/tournaments" element={<ProtectedRoute><TournamentsPage /></ProtectedRoute>} />
          <Route path="/tournaments/:tournamentId" element={<ProtectedRoute><TournamentDetailPage /></ProtectedRoute>} />
          <Route path="/coaching" element={<ProtectedRoute><CoachListingPage /></ProtectedRoute>} />
          <Route path="/communities" element={<ProtectedRoute><CommunitiesPage /></ProtectedRoute>} />
          <Route path="/communities/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><ExplorePage /></ProtectedRoute>} />
          <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><ContactSyncPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
