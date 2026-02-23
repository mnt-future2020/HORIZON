import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";

// MEDIUM FIX #22: Lazy-load all pages — reduces initial bundle size significantly
// Only Navbar + ErrorBoundary are eagerly loaded (needed immediately)
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const PlayerDashboard = lazy(() => import("@/pages/PlayerDashboard"));
const VenueDiscovery = lazy(() => import("@/pages/VenueDiscovery"));
const VenueDetail = lazy(() => import("@/pages/VenueDetail"));
const MatchmakingPage = lazy(() => import("@/pages/MatchmakingPage"));
const VenueOwnerDashboard = lazy(() => import("@/pages/VenueOwnerDashboard"));
const CoachDashboard = lazy(() => import("@/pages/CoachDashboard"));
const SplitPaymentPage = lazy(() => import("@/pages/SplitPaymentPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SuperAdminDashboard = lazy(() => import("@/pages/SuperAdminDashboard"));
const LeaderboardPage = lazy(() => import("@/pages/LeaderboardPage"));
const RatingProfilePage = lazy(() => import("@/pages/RatingProfilePage"));
const HighlightsPage = lazy(() => import("@/pages/HighlightsPage"));
const SharedHighlightPage = lazy(() => import("@/pages/SharedHighlightPage"));
const IoTDashboard = lazy(() => import("@/pages/IoTDashboard"));
const PublicVenuePage = lazy(() => import("@/pages/PublicVenuePage"));
const POSPage = lazy(() => import("@/pages/POSPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const RefundPolicyPage = lazy(() => import("@/pages/RefundPolicyPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const PrivacySettingsPage = lazy(() => import("@/pages/PrivacySettingsPage"));
const SocialFeedPage = lazy(() => import("@/pages/SocialFeedPage"));
const PlayerCardPage = lazy(() => import("@/pages/PlayerCardPage"));
const TournamentsPage = lazy(() => import("@/pages/TournamentsPage"));
const TournamentDetailPage = lazy(() => import("@/pages/TournamentDetailPage"));
const CoachListingPage = lazy(() => import("@/pages/CoachListingPage"));
const CommunitiesPage = lazy(() => import("@/pages/CommunitiesPage"));
const GroupDetailPage = lazy(() => import("@/pages/GroupDetailPage"));
const TeamsPage = lazy(() => import("@/pages/TeamsPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const ExplorePage = lazy(() => import("@/pages/ExplorePage"));
const BookmarksPage = lazy(() => import("@/pages/BookmarksPage"));
const ContactSyncPage = lazy(() => import("@/pages/ContactSyncPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

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
