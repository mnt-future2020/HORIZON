import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import PlayerDashboard from "@/pages/PlayerDashboard";
import VenueDiscovery from "@/pages/VenueDiscovery";
import VenueDetail from "@/pages/VenueDetail";
import MatchmakingPage from "@/pages/MatchmakingPage";
import VenueOwnerDashboard from "@/pages/VenueOwnerDashboard";
import CoachDashboard from "@/pages/CoachDashboard";
import SplitPaymentPage from "@/pages/SplitPaymentPage";
import ProfilePage from "@/pages/ProfilePage";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import LeaderboardPage from "@/pages/LeaderboardPage";
import RatingProfilePage from "@/pages/RatingProfilePage";
import HighlightsPage from "@/pages/HighlightsPage";
import SharedHighlightPage from "@/pages/SharedHighlightPage";
import IoTDashboard from "@/pages/IoTDashboard";
import PublicVenuePage from "@/pages/PublicVenuePage";
import POSPage from "@/pages/POSPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsPage from "@/pages/TermsPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import NotificationsPage from "@/pages/NotificationsPage";
import PrivacySettingsPage from "@/pages/PrivacySettingsPage";
import SocialFeedPage from "@/pages/SocialFeedPage";
import PlayerCardPage from "@/pages/PlayerCardPage";
import TournamentsPage from "@/pages/TournamentsPage";
import TournamentDetailPage from "@/pages/TournamentDetailPage";
import CoachListingPage from "@/pages/CoachListingPage";
import CommunitiesPage from "@/pages/CommunitiesPage";
import GroupDetailPage from "@/pages/GroupDetailPage";
import TeamsPage from "@/pages/TeamsPage";
import ChatPage from "@/pages/ChatPage";
import ExplorePage from "@/pages/ExplorePage";
import BookmarksPage from "@/pages/BookmarksPage";
import ContactSyncPage from "@/pages/ContactSyncPage";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFoundPage from "@/pages/NotFoundPage";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
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
