import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LayoutDashboard, MapPin, Swords, User, LogOut, GraduationCap, Building2 } from "lucide-react";

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
