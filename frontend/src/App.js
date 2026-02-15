import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import Navbar from "@/components/Navbar";

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
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/player" element={<ProtectedRoute><PlayerDashboard /></ProtectedRoute>} />
        <Route path="/venues" element={<ProtectedRoute><VenueDiscovery /></ProtectedRoute>} />
        <Route path="/venues/:id" element={<ProtectedRoute><VenueDetail /></ProtectedRoute>} />
        <Route path="/matchmaking" element={<ProtectedRoute><MatchmakingPage /></ProtectedRoute>} />
        <Route path="/owner" element={<ProtectedRoute roles={["venue_owner"]}><VenueOwnerDashboard /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute roles={["coach"]}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/split/:token" element={<SplitPaymentPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
