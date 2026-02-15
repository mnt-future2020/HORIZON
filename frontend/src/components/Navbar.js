import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { notificationAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutDashboard, MapPin, Swords, User, LogOut, GraduationCap, Building2, Bell, CheckCheck, Shield } from "lucide-react";

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

  const links = {
    player: [
      { to: "/player", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/venues", icon: MapPin, label: "Venues" },
      { to: "/matchmaking", icon: Swords, label: "Matchmaking" },
    ],
    venue_owner: [
      { to: "/owner", icon: Building2, label: "Dashboard" },
    ],
    coach: [
      { to: "/coach", icon: GraduationCap, label: "Dashboard" },
    ],
    super_admin: [
      { to: "/admin", icon: Shield, label: "Admin Console" },
    ],
  };

  const navLinks = links[user?.role] || links.player;

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex fixed top-0 w-full z-50 h-14 items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-border"
        data-testid="desktop-navbar">
        <div className="flex items-center gap-10">
          <Link to="/dashboard" className="font-display font-black text-lg tracking-tighter uppercase text-primary">
            Horizon
          </Link>
          <div className="flex items-center gap-6">
            {navLinks.map(l => (
              <NavLink key={l.to} {...l} active={path === l.to || path.startsWith(l.to + "/")} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <Popover open={notifOpen} onOpenChange={handleNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9" data-testid="notification-bell">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
                    data-testid="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" data-testid="notification-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-bold">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] text-primary hover:underline flex items-center gap-1"
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
                      className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}>
                      <div className="flex items-start gap-2">
                        {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
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
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-3" data-testid="user-menu-trigger">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground hidden lg:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile">
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive" data-testid="menu-logout">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center justify-around bg-background border-t border-border safe-area-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
        data-testid="mobile-navbar">
        {navLinks.map(l => (
          <Link key={l.to} to={l.to} data-testid={`mobile-nav-${l.label.toLowerCase()}`}
            className={`flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[48px] rounded-lg transition-colors ${
              path === l.to || path.startsWith(l.to + "/")
                ? "text-primary bg-primary/10"
                : "text-muted-foreground active:text-foreground active:bg-secondary"
            }`}>
            <l.icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{l.label}</span>
          </Link>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[48px] rounded-lg text-muted-foreground active:text-foreground active:bg-secondary transition-colors"
              data-testid="mobile-notification-bell">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-2 h-3.5 min-w-[14px] px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="text-[10px] font-semibold">Alerts</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" side="top" className="w-80 p-0 mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-bold">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <button key={n.id} onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className={!n.is_read ? "" : "ml-4"}>
                        <div className="text-xs font-semibold">{n.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{n.message}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Link to="/profile" data-testid="mobile-nav-profile"
          className={`flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[48px] rounded-lg transition-colors ${
            path === "/profile"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground active:text-foreground active:bg-secondary"
          }`}>
          <User className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Profile</span>
        </Link>
      </nav>

      {/* Spacers */}
      <div className="hidden md:block h-14" />
      <div className="md:hidden h-0" />
    </>
  );
}
