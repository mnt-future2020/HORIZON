import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { notificationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutDashboard, MapPin, Swords, User, LogOut, GraduationCap, Building2, Bell, CheckCheck, Shield, Trophy, Lightbulb, ShoppingCart, MessageSquare, Lock, Medal, Dumbbell, Users, MessageCircle, Search, Bookmark } from "lucide-react";

function NavLink({ to, icon: Icon, label, active }) {
  return (
    <Link to={to} data-testid={`nav-link-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={`flex items-center gap-2 text-sm font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadUnreadCount = useCallback(() => {
    notificationAPI.unreadCount().then(res => setUnreadCount(res.data?.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const handleNotifOpen = (open) => {
    setNotifOpen(open);
    if (open) {
      notificationAPI.list().then(res => setNotifications(res.data || [])).catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await notificationAPI.markRead(notif.id).catch(() => {});
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.venue_id) {
      setNotifOpen(false);
      navigate(`/venues/${notif.venue_id}`);
    }
  };

  // Desktop gets full nav, mobile gets Instagram-style bottom 5
  const desktopLinks = {
    player: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/explore", icon: Search, label: "Explore" },
      { to: "/player", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/venues", icon: MapPin, label: "Venues" },
      { to: "/matchmaking", icon: Swords, label: "Matches" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/teams", icon: Shield, label: "Teams" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
      { to: "/coaching", icon: Dumbbell, label: "Coaching" },
    ],
  };
  const mobileLinks = {
    player: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/explore", icon: Search, label: "Explore" },
      { to: "/communities", icon: Users, label: "Groups" },
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
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/admin", icon: Shield, label: "Admin Console" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
  };
  const links = {
    player: desktopLinks.player,
    venue_owner: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/owner", icon: Building2, label: "Dashboard" },
      { to: "/pos", icon: ShoppingCart, label: "POS" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
    ],
    coach: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/coach", icon: GraduationCap, label: "Dashboard" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/admin", icon: Shield, label: "Admin Console" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
    ],
  };

  const navLinks = links[user?.role] || links.player;
  const mobileNavLinks = mobileLinks[user?.role] || mobileLinks.player;

  return (
    <>
      {/* Desktop Top Header (Logo + Profile) */}
      <header className="hidden md:flex fixed top-0 left-0 w-full z-50 h-[72px] items-center justify-between px-8 bg-card/90 backdrop-blur-xl border-b border-border shadow-sm"
        data-testid="desktop-navbar">
        <div className="flex items-center flex-1 pr-8">
          <div className="w-[280px] mr-8 shrink-0">
            <Link to="/feed" className="font-display font-black text-3xl tracking-tighter uppercase text-emerald-700 flex items-center gap-3">
              <div className="bg-emerald-600 p-1.5 rounded-lg text-white shrink-0">
                <Shield className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <span className="truncate">LOBBI</span>
            </Link>
          </div>
          
          {/* Search Bar - Decorative matching Stitch */}
          <div className="relative w-80 hidden lg:block">
             <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
             <input className="w-full bg-secondary/20 border-2 border-emerald-600/40 rounded-full py-2 pl-10 pr-4 text-sm focus:border-emerald-600 outline-none transition-all placeholder:text-muted-foreground/70" placeholder="Search athletes, teams, or results..." type="text"/>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <Popover open={notifOpen} onOpenChange={handleNotifOpen}>
            <PopoverTrigger asChild>
              <button className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground transition-colors" data-testid="notification-bell">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background"
                    data-testid="notification-badge"></span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" data-testid="notification-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-bold">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1"
                    data-testid="mark-all-read-btn"><CheckCheck className="h-3 w-3" /> Mark all read</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">No notifications yet</div>
                ) : (
                  notifications.map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      data-testid={`notification-item-${n.id}`}
                      className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-secondary/30 transition-colors ${!n.is_read ? "bg-emerald-600/5" : ""}`}>
                      <div className="flex items-start gap-2">
                        {!n.is_read && <div className="h-2 w-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />}
                        <div className={!n.is_read ? "" : "ml-4"}>
                          <div className="text-xs font-semibold text-foreground">{n.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</div>
                          <div className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <Link to="/notifications" onClick={() => setNotifOpen(false)}
                className="block text-center text-xs font-bold text-emerald-600 hover:bg-emerald-600/5 transition-colors py-2.5 border-t border-border/50">
                View All Notifications
              </Link>
            </PopoverContent>
          </Popover>

          <div className="h-6 w-px bg-border mx-2"></div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid="user-menu-trigger">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-bold text-foreground leading-tight">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
                </div>
                <Avatar className="h-9 w-9 border-2 border-emerald-600/20">
                  {user?.avatar && <AvatarImage src={mediaUrl(user.avatar)} alt={user?.name} className="object-cover" />}
                  <AvatarFallback className="bg-emerald-600/10 text-emerald-600 text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-lg border-border/50 rounded-xl">
              <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile" className="py-2.5">
                <User className="mr-2 h-4 w-4 text-muted-foreground" /> Profile
              </DropdownMenuItem>
              {user?.role !== "super_admin" && (
                <DropdownMenuItem onClick={() => navigate("/player-card/me")} className="py-2.5">
                  <Trophy className="mr-2 h-4 w-4 text-muted-foreground" /> Lobbian Card
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/bookmarks")} className="py-2.5">
                <Bookmark className="mr-2 h-4 w-4 text-muted-foreground" /> Saved Posts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy")} className="py-2.5">
                <Lock className="mr-2 h-4 w-4 text-muted-foreground" /> Privacy & Data
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={logout} className="text-red-500 py-2.5 hover:text-red-600 hover:bg-red-500/10" data-testid="menu-logout">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile bottom nav — Instagram-style 5 tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[64px] flex items-center justify-around bg-background/90 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
        data-testid="mobile-navbar">
        {mobileNavLinks.map(l => (
          <Link key={l.to} to={l.to} data-testid={`mobile-nav-${l.label.toLowerCase()}`}
            className={`flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
              path === l.to || path.startsWith(l.to + "/")
                ? "text-emerald-600"
                : "text-muted-foreground active:text-foreground"
            }`}>
            <l.icon className={`h-[22px] w-[22px] shrink-0 ${path === l.to || path.startsWith(l.to + "/") ? "stroke-[2.5]" : ""}`} />
            <span className="text-[9px] font-bold leading-tight">{l.label}</span>
          </Link>
        ))}
        {/* Notification tab */}
        <Link to="/notifications" data-testid="mobile-nav-alerts"
          className={`relative flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
            path === "/notifications" ? "text-emerald-600" : "text-muted-foreground active:text-foreground"
          }`}>
          <div className="relative">
            <Bell className={`h-[22px] w-[22px] shrink-0 ${path === "/notifications" ? "stroke-[2.5]" : ""}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border-2 border-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold leading-tight">Alerts</span>
        </Link>
        {/* Profile tab */}
        <Link to="/profile" data-testid="mobile-nav-profile"
          className={`flex flex-col items-center justify-center gap-1 min-w-0 flex-1 min-h-[48px] transition-colors ${
            path === "/profile" || path.startsWith("/player-card/")
              ? "text-emerald-600"
              : "text-muted-foreground active:text-foreground"
          }`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center overflow-hidden ${
            path === "/profile" ? "ring-2 ring-emerald-600 border border-background" : "border border-border"
          }`}>
            {user?.avatar
              ? <img src={mediaUrl(user.avatar)} alt="" className="h-6 w-6 rounded-full object-cover" />
              : <User className="h-4 w-4 text-muted-foreground" />}
          </div>
          <span className="text-[9px] font-bold leading-tight">Me</span>
        </Link>
      </nav>

      {/* Spacers */}
      <div className="hidden md:block h-[72px]" />
      <div className="md:hidden h-[64px]" />
    </>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const desktopLinks = {
    player: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/explore", icon: Search, label: "Explore" },
      { to: "/player", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/venues", icon: MapPin, label: "Venues" },
      { to: "/matchmaking", icon: Swords, label: "Matches" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/teams", icon: Shield, label: "Teams" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
      { to: "/coaching", icon: Dumbbell, label: "Coaching" },
    ],
  };

  const links = {
    player: desktopLinks.player,
    venue_owner: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/owner", icon: Building2, label: "Dashboard" },
      { to: "/pos", icon: ShoppingCart, label: "POS" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/tournaments", icon: Medal, label: "Tournaments" },
    ],
    coach: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/coach", icon: GraduationCap, label: "Dashboard" },
      { to: "/communities", icon: Users, label: "Groups" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
    ],
    super_admin: [
      { to: "/feed", icon: MessageSquare, label: "Feed" },
      { to: "/admin", icon: Shield, label: "Admin Console" },
      { to: "/iot", icon: Lightbulb, label: "IoT" },
    ],
  };

  const navLinks = links[user?.role] || links.player;

  return (
    <aside className="hidden lg:flex sticky top-[96px] h-[calc(100vh-120px)] w-[280px] flex-shrink-0 flex-col bg-card rounded-[24px] border border-border/40 shadow-sm p-5 overflow-y-auto no-scrollbar">
      <nav className="flex flex-col gap-1.5 mb-8">
        {navLinks.map(l => {
           const active = path === l.to || path.startsWith(l.to + "/");
           return (
             <Link key={l.to} to={l.to} data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
               className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                 active 
                  ? "bg-emerald-600/10 text-emerald-600 font-bold" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
               }`}>
               <l.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
               <span>{l.label}</span>
             </Link>
           );
        })}
      </nav>
    </aside>
  );
}
