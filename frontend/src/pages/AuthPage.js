import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Dumbbell, Building2, Users } from "lucide-react";
import Logo from "@/components/Logo";

const cleanPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); return d.slice(0, 10); };

const DEV_ACCOUNTS = [
  { label: "Admin", email: "admin@lobbi.com", icon: ShieldCheck, color: "bg-red-500 hover:bg-red-600" },
  { label: "Player", email: "kansha@mntfuture.com", icon: Users, color: "bg-brand-500 hover:bg-brand-600" },
  { label: "Venue Owner", email: "kansha2312@mntfuture.com", icon: Building2, color: "bg-amber-500 hover:bg-amber-600" },
  { label: "Academy Coach", email: "coach@lobbi.com", icon: Dumbbell, color: "bg-green-500 hover:bg-green-600" },
  { label: "Individual Coach", email: "priya@lobbi.com", icon: Dumbbell, color: "bg-emerald-500 hover:bg-emerald-600" },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, devLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({ name: "", email: "", password: "", role: "player", phone: "", business_name: "", gst_number: "", coach_type: "" });

  const handleDevLogin = async (account) => {
    setDevLoading(account.email);
    try {
      await devLogin(account.email);
      toast.success(`Logged in as ${account.label}`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Dev login failed");
    } finally {
      setDevLoading(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(loginData.email, loginData.password);
      const status = res.user?.account_status;
      if (status === "pending") {
        toast.info("Your account is pending admin approval. You'll be notified once approved.");
        return;
      } else if (status === "rejected") {
        toast.error("Your account registration was not approved. Please contact support.");
        return;
      } else if (status === "suspended") {
        toast.error("Your account has been suspended. Please contact support.");
        return;
      }
      toast.success("Welcome back!");
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
      } else if (res.user?.role === "coach") {
        toast.success("Registration submitted! Your coach account needs admin approval.");
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
    <div className="h-screen bg-card flex flex-col md:flex-row selection:bg-brand-600 selection:text-white overflow-hidden">
      {/* Left Column / Split Screen Visual */}
      <div className="hidden md:flex flex-col md:w-1/2 h-full relative p-12 overflow-hidden items-start justify-between bg-slate-900">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80" alt="Athletic" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-slate-900/10 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent" />
        </div>
        
        <ul className="space-y-4 z-10">
          <li><Logo size="lg" className="text-brand-400" /></li>
        </ul>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="z-10 mt-auto">
          <h2 className="font-display text-5xl lg:text-7xl font-black uppercase text-white leading-[0.9] tracking-tighter">
            Enter <br/> The Court.
          </h2>
          <p className="mt-8 text-lg font-bold text-slate-200 max-w-sm uppercase tracking-widest">
            The standard for athletic facilities and competitive play.
          </p>
        </motion.div>
      </div>

      {/* Right Column / Auth Form */}
      <div className="w-full md:w-1/2 h-full flex flex-col p-6 md:p-12 relative overflow-y-auto no-scrollbar">
        <style dangerouslySetInnerHTML={{ __html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
        <div className="w-full max-w-md mx-auto min-h-full flex flex-col relative py-2 md:py-8">
          <div className="w-full flex justify-start pb-8">
            <button onClick={() => navigate("/")} data-testid="auth-back-btn"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-brand-600 transition-colors md:-ml-4">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="w-full my-auto pb-8">

            <div className="md:hidden text-center mb-8">
              <Logo size="md" className="text-brand-600" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Sports Facility OS</p>
            </div>

            <Tabs defaultValue="login" data-testid="auth-tabs" className="w-full">
              <TabsList className="w-full bg-secondary rounded-[24px] h-12 mb-6 p-1">
                <TabsTrigger value="login" className="w-1/2 rounded-2xl font-black uppercase tracking-widest text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all h-full" data-testid="login-tab">Log In</TabsTrigger>
                <TabsTrigger value="register" className="w-1/2 rounded-2xl font-black uppercase tracking-widest text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all h-full" data-testid="register-tab">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Email Address</Label>
                    <Input type="email" required value={loginData.email}
                      onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))}
                      className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                      placeholder="you@example.com" data-testid="login-email-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
                    <Input type="password" required value={loginData.password}
                      onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))}
                      className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                      placeholder="Enter password" data-testid="login-password-input" />
                  </div>
                  <Button type="submit" disabled={loading} data-testid="login-submit-btn"
                    className="w-full h-12 bg-brand-600 rounded-full text-white font-black uppercase tracking-widest text-xs hover:bg-brand-700 shadow-md shadow-brand-600/20 transition-colors mt-6">
                    {loading ? "Authenticating..." : "Sign In"}
                  </Button>
                </form>

                {/* Quick Dev Login */}
                <div className="mt-8 pt-6 border-t border-dashed border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3 text-center">Quick Login (Dev)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEV_ACCOUNTS.map((acc) => {
                      const Icon = acc.icon;
                      return (
                        <button key={acc.email} onClick={() => handleDevLogin(acc)}
                          disabled={devLoading !== null}
                          className={`${acc.color} text-white rounded-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50`}>
                          {devLoading === acc.email ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                          {acc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Full Name</Label>
                    <Input required value={regData.name}
                      onChange={e => setRegData(p => ({ ...p, name: e.target.value }))}
                      className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                      placeholder="Your name" data-testid="register-name-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
                    <Input type="email" required value={regData.email}
                      onChange={e => setRegData(p => ({ ...p, email: e.target.value }))}
                      className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                      placeholder="you@example.com" data-testid="register-email-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
                    <Input type="password" required value={regData.password}
                      onChange={e => setRegData(p => ({ ...p, password: e.target.value }))}
                      className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                      placeholder="Min 8 chars, uppercase, lowercase, number" data-testid="register-password-input"
                      minLength={8} />
                    {regData.password && regData.password.length > 0 && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(regData.password) && (
                      <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Must be 8+ chars with uppercase, lowercase, and number</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Profile Type</Label>
                    <Select value={regData.role} onValueChange={v => setRegData(p => ({ ...p, role: v, coach_type: v === "coach" ? p.coach_type : "" }))}>
                      <SelectTrigger className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground" data-testid="register-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[24px] border border-border/40 shadow-lg">
                        <SelectItem value="player" className="text-sm font-bold">Lobbian (Player)</SelectItem>
                        <SelectItem value="venue_owner" className="text-sm font-bold">Venue Owner</SelectItem>
                        <SelectItem value="coach" className="text-sm font-bold">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Phone (optional)</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 h-12 bg-secondary border border-r-0 border-border/40 rounded-l-[24px] text-sm font-bold text-muted-foreground select-none">+91</span>
                      <Input value={regData.phone}
                        onChange={e => setRegData(p => ({ ...p, phone: cleanPhone(e.target.value) }))}
                        className="h-12 bg-card border border-border/40 rounded-l-none rounded-r-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground flex-1"
                        placeholder="98765 43210" data-testid="register-phone-input" maxLength={10} />
                    </div>
                  </div>

                  {regData.role === "venue_owner" && (
                    <div className="pt-4 space-y-4 border-t border-border/20">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Business Name</Label>
                        <Input value={regData.business_name}
                          onChange={e => setRegData(p => ({ ...p, business_name: e.target.value }))}
                          className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                          placeholder="Your sports facility name" data-testid="register-business-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">GST Number (optional)</Label>
                        <Input value={regData.gst_number}
                          onChange={e => setRegData(p => ({ ...p, gst_number: e.target.value }))}
                          className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground"
                          placeholder="29AABCR1234F1Z5" data-testid="register-gst-number" />
                      </div>
                      <div className="p-3 bg-brand-50 border-l-4 border-brand-600 rounded-r-lg text-[10px] font-bold uppercase tracking-widest text-brand-700" data-testid="pending-notice">
                        Venue owner accounts require admin verification.
                      </div>
                    </div>
                  )}

                  {regData.role === "coach" && (
                    <div className="pt-4 space-y-4 border-t border-border/20">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Coach Type</Label>
                        <Select value={regData.coach_type} onValueChange={v => setRegData(p => ({ ...p, coach_type: v }))}>
                          <SelectTrigger className="h-12 bg-card border border-border/40 rounded-[24px] focus-visible:ring-0 focus-visible:border-brand-500 shadow-sm text-sm font-bold text-foreground" data-testid="register-coach-type">
                            <SelectValue placeholder="Select coach type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[24px] border border-border/40 shadow-lg">
                            <SelectItem value="individual" className="text-sm font-bold">
                              Individual Coach
                            </SelectItem>
                            <SelectItem value="academy" className="text-sm font-bold">
                              Academy
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {regData.coach_type === "individual" && (
                          <p className="text-[10px] text-muted-foreground font-medium">1-on-1 or small group coaching sessions</p>
                        )}
                        {regData.coach_type === "academy" && (
                          <p className="text-[10px] text-muted-foreground font-medium">Run a sports academy with batches, students & fees</p>
                        )}
                      </div>
                      <div className="p-3 bg-brand-50 border-l-4 border-brand-600 rounded-r-lg text-[10px] font-bold uppercase tracking-widest text-brand-700" data-testid="coach-pending-notice">
                        Coach accounts require admin verification.
                      </div>
                    </div>
                  )}

                  <Button type="submit" disabled={loading} data-testid="register-submit-btn"
                    className="w-full h-12 bg-brand-600 rounded-full text-white font-black uppercase tracking-widest text-xs hover:bg-brand-700 shadow-md shadow-brand-600/20 transition-colors mt-6">
                    {loading ? "Creating..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
