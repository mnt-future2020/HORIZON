import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { notificationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  MapPin,
  Swords,
  User,
  LogOut,
  GraduationCap,
  Building2,
  Bell,
  CheckCheck,
  Shield,
  Trophy,
  Lightbulb,
  ShoppingCart,
  MessageSquare,
  Lock,
  Medal,
  Dumbbell,
  MessageCircle,
  Bookmark,
  Settings,
  ClipboardList,
  Menu,
} from "lucide-react";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const handleFeedClick = (e) => {
    if (path === "/feed") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("feed:refresh"));
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNavClick = (to) => {
    if (to === "/feed") return; // handled by handleFeedClick
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadUnreadCount = useCallback(() => {
    notificationAPI
      .unreadCount()
      .then((res) => setUnreadCount(res.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const handleNotifOpen = (open) => {
    setNotifOpen(open);
    if (open) {
      notificationAPI
        .list()
        .then((res) => setNotifications(res.data || []))
        .catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await notificationAPI.markRead(notif.id).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
    }
    if (notif.venue_id) {
      setNotifOpen(false);
      navigate(`/venues/${notif.venue_id}`);
    }
  };

  // All navigation links by role
  const allLinks = {
    player: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/player", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/venues", icon: MapPin, label: "Venues" },
      { to: "/matchmaking", icon: Swords, label: "Matches" },
      { to: "/teams", icon: Shield, label: "Teams" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
      { to: "/coaching", icon: Dumbbell, label: "Coaching" },
    ],
    venue_owner: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/owner", icon: Building2, label: "Dashboard" },
      { to: "/owner/manage", icon: ClipboardList, label: "Venue Mgmt" },
      { to: "/pos", icon: ShoppingCart, label: "POS" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
    ],
    coach: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/coach", icon: GraduationCap, label: "Dashboard" },
      { to: "/venues", icon: MapPin, label: "Venues" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
      { to: "/teams", icon: Shield, label: "Teams" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/admin", icon: Shield, label: "Admin Console" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
  };

  // Mobile bottom nav - top 5 most used for quick access
  const mobileBottomLinks = {
    player: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/player", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/matchmaking", icon: Swords, label: "Matches" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    venue_owner: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/owner", icon: Building2, label: "Dashboard" },
      { to: "/pos", icon: ShoppingCart, label: "POS" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    coach: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/coach", icon: GraduationCap, label: "Dashboard" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/admin", icon: Shield, label: "Admin" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
  };

  const allNavLinks = allLinks[user?.role] || allLinks.player;
  const mobileBottomNavLinks =
    mobileBottomLinks[user?.role] || mobileBottomLinks.player;

  return (
    <>
      {/* Desktop & Tablet Top Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 h-16 md:h-[72px] flex items-center justify-between px-4 md:px-6 lg:px-8 bg-card/95 backdrop-blur-xl border-b border-border/50 shadow-sm"
        data-testid="navbar"
      >
        {/* Left: Logo + Hamburger Menu (Tablet/Mobile) */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Hamburger Menu for Tablet & Mobile */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="flex lg:hidden items-center justify-center h-10 w-10 rounded-lg hover:bg-secondary/50 active:bg-secondary/70 text-foreground transition-all duration-200 touch-manipulation cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 outline-none"
                aria-label="Open menu"
                data-testid="mobile-menu-trigger"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
              <SheetHeader className="px-6 py-5 border-b border-border bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-950/30">
                <SheetTitle asChild>
                  <Logo size="sm" className="text-brand-700 dark:text-brand-400" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col py-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                {allNavLinks.map((link) => {
                  const isActive =
                    path === link.to || path.startsWith(link.to + "/");
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => { handleNavClick(link.to); setMobileMenuOpen(false); }}
                      data-testid={`mobile-menu-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                      className={`flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-200 min-h-[52px] touch-manipulation ${
                        isActive
                          ? "bg-brand-600/10 text-brand-600 border-l-4 border-brand-600 font-semibold"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:translate-x-1 border-l-4 border-transparent"
                      }`}
                    >
                      <link.icon
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link
            to="/feed"
            className="text-brand-700 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors duration-200"
          >
            <Logo size="md" />
          </Link>
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Notification Bell */}
          <Popover
            open={notifOpen}
            onOpenChange={handleNotifOpen}
            modal={false}
          >
            <PopoverTrigger asChild>
              <button
                className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-secondary/50 active:bg-secondary/70 text-muted-foreground hover:text-foreground transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 touch-manipulation cursor-pointer"
                data-testid="notification-bell"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background animate-pulse"
                    data-testid="notification-badge"
                    aria-label={`${unreadCount} unread notifications`}
                  ></span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 sm:w-96 p-0 shadow-xl border-border/50"
              data-testid="notification-panel"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-brand-50/30 to-transparent dark:from-brand-950/20">
                <span className="text-sm font-bold">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-brand-600 hover:text-brand-700 dark:hover:text-brand-500 hover:underline flex items-center gap-1 cursor-pointer touch-manipulation transition-colors duration-200"
                    data-testid="mark-all-read-btn"
                  >
                    <CheckCheck className="h-3 w-3" aria-hidden="true" /> Mark
                    all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell
                      className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted-foreground font-medium">
                      No notifications yet
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      We'll notify you when something arrives
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      data-testid={`notification-item-${n.id}`}
                      className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-secondary/30 active:bg-secondary/50 transition-all duration-200 cursor-pointer touch-manipulation ${!n.is_read ? "bg-brand-600/5" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <div className="h-2 w-2 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                        )}
                        <div className={!n.is_read ? "" : "ml-4"}>
                          <div className="text-xs font-semibold text-foreground">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setNotifOpen(false)}
                className="block text-center text-xs font-bold text-brand-600 hover:text-brand-700 dark:hover:text-brand-500 hover:bg-brand-600/5 transition-all duration-200 py-2.5 border-t border-border/50 cursor-pointer"
              >
                View All Notifications
              </Link>
            </PopoverContent>
          </Popover>

          {/* Divider (Desktop only) */}
          <div className="hidden md:block h-6 w-px bg-border/50"></div>

          {/* User Profile Dropdown (Desktop & Tablet) */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 md:gap-3 hover:opacity-80 active:opacity-70 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-full cursor-pointer touch-manipulation"
                data-testid="user-menu-trigger"
                aria-label="User menu"
              >
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-bold text-foreground leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
                <Avatar className="h-9 w-9 border-2 border-brand-600/20 hover:border-brand-600/40 transition-all duration-200">
                  {user?.avatar && (
                    <AvatarImage
                      src={mediaUrl(user.avatar)}
                      alt={user?.name}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-brand-600/10 text-brand-600 text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 shadow-xl border-border/50 rounded-xl"
            >
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                data-testid="menu-profile"
                className="py-2.5 cursor-pointer focus:bg-brand-600/10 focus:text-brand-600"
              >
                <User className="mr-2 h-4 w-4" aria-hidden="true" /> Profile
              </DropdownMenuItem>
              {user?.role !== "super_admin" && (
                <DropdownMenuItem
                  onClick={() => navigate("/player-card/me")}
                  className="py-2.5 cursor-pointer focus:bg-brand-600/10 focus:text-brand-600"
                >
                  <Trophy className="mr-2 h-4 w-4" aria-hidden="true" /> Lobbian
                  Card
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => navigate("/bookmarks")}
                className="py-2.5 cursor-pointer focus:bg-brand-600/10 focus:text-brand-600"
              >
                <Bookmark className="mr-2 h-4 w-4" aria-hidden="true" /> Saved
                Posts
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/privacy")}
                className="py-2.5 cursor-pointer focus:bg-brand-600/10 focus:text-brand-600"
              >
                <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> Privacy &
                Data
              </DropdownMenuItem>
              {user?.role === "coach" && (
                <DropdownMenuItem
                  onClick={() => navigate("/coach/settings")}
                  className="py-2.5 cursor-pointer focus:bg-brand-600/10 focus:text-brand-600"
                >
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />{" "}
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                onClick={logout}
                className="text-red-500 py-2.5 hover:text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-600 cursor-pointer"
                data-testid="menu-logout"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
        data-testid="mobile-navbar"
      >
        {mobileBottomNavLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={l.to === "/feed" ? handleFeedClick : () => handleNavClick(l.to)}
            data-testid={`mobile-nav-${l.label.toLowerCase()}`}
            className={`flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
              path === l.to || path.startsWith(l.to + "/")
                ? "text-brand-600"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <l.icon
              className={`h-[22px] w-[22px] shrink-0 ${path === l.to || path.startsWith(l.to + "/") ? "stroke-[2.5]" : ""}`}
            />
            <span className="text-[10px] font-medium leading-tight">
              {l.label}
            </span>
          </Link>
        ))}
        {/* Notification tab */}
        <Link
          to="/notifications"
          data-testid="mobile-nav-alerts"
          className={`relative flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
            path === "/notifications"
              ? "text-brand-600"
              : "text-muted-foreground active:text-foreground"
          }`}
        >
          <div className="relative">
            <Bell
              className={`h-[22px] w-[22px] shrink-0 ${path === "/notifications" ? "stroke-[2.5]" : ""}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center border-2 border-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium leading-tight">Alerts</span>
        </Link>
        {/* Profile tab */}
        <Link
          to="/profile"
          data-testid="mobile-nav-profile"
          className={`flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
            path === "/profile" || path.startsWith("/player-card/")
              ? "text-brand-600"
              : "text-muted-foreground active:text-foreground"
          }`}
        >
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center overflow-hidden ${
              path === "/profile"
                ? "ring-2 ring-brand-600 border border-background"
                : "border border-border"
            }`}
          >
            {user?.avatar ? (
              <img
                src={mediaUrl(user.avatar)}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-[10px] font-medium leading-tight">Me</span>
        </Link>
      </nav>

      {/* Spacers for fixed headers */}
      <div className="h-16 md:h-[72px]" />
      <div
        className="hidden h-16"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
      />
    </>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const handleFeedClick = (e) => {
    if (path === "/feed") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("feed:refresh"));
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNavClick = (to) => {
    if (to === "/feed") return; // handled by handleFeedClick
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const links = {
    player: [
      { to: "/feed", ms: "rss_feed", label: "Feed" },
      { to: "/player", ms: "dashboard", label: "Dashboard" },
      { to: "/venues", ms: "location_on", label: "Venues" },
      { to: "/matchmaking", ms: "sports_kabaddi", label: "Matches" },
      { to: "/teams", ms: "shield", label: "Teams" },
      { to: "/chat", ms: "forum", label: "Chat" },
      { to: "/tournaments", ms: "emoji_events", label: "Tournaments" },
      { to: "/coaching", ms: "fitness_center", label: "Coaching" },
    ],
    venue_owner: [
      { to: "/feed", ms: "rss_feed", label: "Feed" },
      { to: "/owner", ms: "dashboard", label: "Dashboard", exact: true },
      { to: "/owner/manage", ms: "storefront", label: "Venue Management" },
      { to: "/owner/finance", ms: "payments", label: "Finance" },
      { to: "/pos", ms: "point_of_sale", label: "POS" },
      { to: "/iot", ms: "sensors", label: "IoT" },
      { to: "/chat", ms: "forum", label: "Chat" },
      { to: "/tournaments", ms: "emoji_events", label: "Tournaments" },
    ],
    coach: [
      { to: "/feed", ms: "rss_feed", label: "Feed" },
      { to: "/coach", ms: "dashboard", label: "Dashboard", exact: true },
      { to: "/coach/manage", ms: "fitness_center", label: "Coach Management" },
      { to: "/venues", ms: "location_on", label: "Venues" },
      { to: "/tournaments", ms: "emoji_events", label: "Tournaments" },
      { to: "/teams", ms: "shield", label: "Teams" },
      { to: "/chat", ms: "forum", label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", ms: "rss_feed", label: "Feed" },
      { to: "/admin", ms: "admin_panel_settings", label: "Admin Console" },
      { to: "/iot", ms: "sensors", label: "IoT" },
    ],
  };

  const navLinks = links[user?.role] || links.player;

  return (
    <aside className="hidden lg:flex sticky top-[96px] h-[calc(100vh-120px)] w-64 flex-shrink-0 flex-col bg-card rounded-[24px] border border-border/40 shadow-sm p-5 overflow-y-auto no-scrollbar">
      <nav className="flex flex-col gap-1.5 mb-8">
        {navLinks.map((l) => {
          const active = l.exact
            ? path === l.to
            : path === l.to || path.startsWith(l.to + "/");
          return (
            <Link
              key={l.to}
              to={l.to}
              onClick={l.to === "/feed" ? handleFeedClick : () => handleNavClick(l.to)}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                active
                  ? "bg-brand-600/10 text-brand-600 font-bold"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "22px",
                  lineHeight: 1,
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {l.ms}
              </span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
