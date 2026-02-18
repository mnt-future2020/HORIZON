import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Sun, Moon } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({ name: "", email: "", password: "", role: "player", phone: "", business_name: "", gst_number: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(loginData.email, loginData.password);
      if (res.user?.account_status === "pending") {
        toast.info("Your account is pending admin approval. You'll be notified once approved.");
      } else if (res.user?.account_status === "rejected") {
        toast.error("Your account registration was not approved. Please contact support.");
      } else if (res.user?.account_status === "suspended") {
        toast.error("Your account has been suspended. Please contact support.");
      } else {
        toast.success("Welcome back!");
      }
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(regData);
      if (res.user?.role === "venue_owner") {
        toast.success("Registration submitted! Your account needs admin approval before you can manage venues.");
      } else {
        toast.success("Account created!");
      }
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Theme toggle - top right */}
      <div className="fixed top-4 right-4 z-50">
        <button onClick={toggleTheme} data-testid="auth-theme-toggle"
          className="h-9 w-9 rounded-lg flex items-center justify-center bg-secondary/50 hover:bg-secondary transition-colors">
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        </button>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md">
        <button onClick={() => navigate("/")} data-testid="auth-back-btn"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-left mb-8">
          <h1 className="font-display text-3xl font-black tracking-tighter uppercase text-primary">Horizon</h1>
          <p className="text-sm text-muted-foreground mt-2">Sports Facility Operating System</p>
        </div>

        <div className="glass-card rounded-lg p-8">
          <Tabs defaultValue="login" data-testid="auth-tabs">
            <TabsList className="w-full bg-secondary/50 mb-6">
              <TabsTrigger value="login" className="w-1/2 font-bold" data-testid="login-tab">Log In</TabsTrigger>
              <TabsTrigger value="register" className="w-1/2 font-bold" data-testid="register-tab">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input type="email" required value={loginData.email}
                    onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))}
                    className="mt-2 bg-background border-border focus:border-primary h-11"
                    placeholder="you@example.com" data-testid="login-email-input" />
                </div>
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input type="password" required value={loginData.password}
                    onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))}
                    className="mt-2 bg-background border-border focus:border-primary h-11"
                    placeholder="Enter password" data-testid="login-password-input" />
                </div>
                <Button type="submit" disabled={loading} data-testid="login-submit-btn"
                  className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide h-11">
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Demo: demo@player.com / demo@owner.com / demo@coach.com (pw: demo123)<br/>
                  Admin: admin@horizon.com (pw: admin123)
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <Input required value={regData.name}
                    onChange={e => setRegData(p => ({ ...p, name: e.target.value }))}
                    className="mt-2 bg-background border-border h-11"
                    placeholder="Your name" data-testid="register-name-input" />
                </div>
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input type="email" required value={regData.email}
                    onChange={e => setRegData(p => ({ ...p, email: e.target.value }))}
                    className="mt-2 bg-background border-border h-11"
                    placeholder="you@example.com" data-testid="register-email-input" />
                </div>
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input type="password" required value={regData.password}
                    onChange={e => setRegData(p => ({ ...p, password: e.target.value }))}
                    className="mt-2 bg-background border-border h-11"
                    placeholder="Min 6 characters" data-testid="register-password-input" />
                </div>
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">I am a</Label>
                  <Select value={regData.role} onValueChange={v => setRegData(p => ({ ...p, role: v }))}>
                    <SelectTrigger className="mt-2 bg-background border-border h-11" data-testid="register-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="venue_owner">Venue Owner</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Phone (optional)</Label>
                  <Input value={regData.phone}
                    onChange={e => setRegData(p => ({ ...p, phone: e.target.value }))}
                    className="mt-2 bg-background border-border h-11"
                    placeholder="+91 98765 43210" data-testid="register-phone-input" />
                </div>
                {regData.role === "venue_owner" && (
                  <>
                    <div>
                      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Business Name</Label>
                      <Input value={regData.business_name}
                        onChange={e => setRegData(p => ({ ...p, business_name: e.target.value }))}
                        className="mt-2 bg-background border-border h-11"
                        placeholder="Your sports facility name" data-testid="register-business-name" />
                    </div>
                    <div>
                      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">GST Number (optional)</Label>
                      <Input value={regData.gst_number}
                        onChange={e => setRegData(p => ({ ...p, gst_number: e.target.value }))}
                        className="mt-2 bg-background border-border h-11"
                        placeholder="29AABCR1234F1Z5" data-testid="register-gst-number" />
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300" data-testid="pending-notice">
                      Venue owner accounts require admin approval. You'll be notified once approved.
                    </div>
                  </>
                )}
                <Button type="submit" disabled={loading} data-testid="register-submit-btn"
                  className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide h-11">
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
