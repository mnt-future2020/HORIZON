import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";

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

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" />;
  if (user.role === "super_admin") return <Navigate to="/admin" />;
  if (user.role === "venue_owner") return <Navigate to="/owner" />;
  if (user.role === "coach") return <Navigate to="/coach" />;
  return <Navigate to="/player" />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      {user && <Navbar />}
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
