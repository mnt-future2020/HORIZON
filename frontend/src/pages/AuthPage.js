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
import { ArrowLeft } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({ name: "", email: "", password: "", role: "player", phone: "", business_name: "", gst_number: "" });

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
    <div className="h-screen bg-white flex flex-col md:flex-row selection:bg-emerald-600 selection:text-white overflow-hidden">
      {/* Left Column / Split Screen Visual */}
      <div className="hidden md:flex flex-col md:w-1/2 h-full relative p-12 overflow-hidden items-start justify-between bg-slate-900">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80" alt="Athletic" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-slate-900/10 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent" />
        </div>
        
        <ul className="space-y-4 z-10">
          <li className="font-display font-black text-4xl tracking-tighter uppercase text-emerald-400">LOBBI</li>
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
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors md:-ml-4">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="w-full my-auto pb-8">

            <div className="md:hidden text-center mb-8">
              <h1 className="font-display text-4xl font-black tracking-tighter uppercase text-emerald-700">LOBBI</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sports Facility OS</p>
            </div>

            <Tabs defaultValue="login" data-testid="auth-tabs" className="w-full">
              <TabsList className="w-full bg-slate-100 rounded-xl h-12 mb-6 p-1">
                <TabsTrigger value="login" className="w-1/2 rounded-lg font-black uppercase tracking-widest text-xs data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-lg transition-all h-full" data-testid="login-tab">Log In</TabsTrigger>
                <TabsTrigger value="register" className="w-1/2 rounded-lg font-black uppercase tracking-widest text-xs data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-lg transition-all h-full" data-testid="register-tab">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email Address</Label>
                    <Input type="email" required value={loginData.email}
                      onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="you@example.com" data-testid="login-email-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Password</Label>
                    <Input type="password" required value={loginData.password}
                      onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="Enter password" data-testid="login-password-input" />
                  </div>
                  <Button type="submit" disabled={loading} data-testid="login-submit-btn"
                    className="w-full h-12 bg-emerald-600 rounded-xl text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors mt-6">
                    {loading ? "Authenticating..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Full Name</Label>
                    <Input required value={regData.name}
                      onChange={e => setRegData(p => ({ ...p, name: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="Your name" data-testid="register-name-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</Label>
                    <Input type="email" required value={regData.email}
                      onChange={e => setRegData(p => ({ ...p, email: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="you@example.com" data-testid="register-email-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Password</Label>
                    <Input type="password" required value={regData.password}
                      onChange={e => setRegData(p => ({ ...p, password: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="Min 8 chars, uppercase, lowercase, number" data-testid="register-password-input"
                      minLength={8} />
                    {regData.password && regData.password.length > 0 && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(regData.password) && (
                      <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Must be 8+ chars with uppercase, lowercase, and number</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Profile Type</Label>
                    <Select value={regData.role} onValueChange={v => setRegData(p => ({ ...p, role: v }))}>
                      <SelectTrigger className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900" data-testid="register-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-2 border-slate-200 shadow-lg">
                        <SelectItem value="player" className="text-sm font-bold">Lobbian (Player)</SelectItem>
                        <SelectItem value="venue_owner" className="text-sm font-bold">Venue Owner</SelectItem>
                        <SelectItem value="coach" className="text-sm font-bold">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone (optional)</Label>
                    <Input value={regData.phone}
                      onChange={e => setRegData(p => ({ ...p, phone: e.target.value }))}
                      className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                      placeholder="+91 98765 43210" data-testid="register-phone-input" />
                  </div>

                  {regData.role === "venue_owner" && (
                    <div className="pt-4 space-y-4 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Business Name</Label>
                        <Input value={regData.business_name}
                          onChange={e => setRegData(p => ({ ...p, business_name: e.target.value }))}
                          className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                          placeholder="Your sports facility name" data-testid="register-business-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">GST Number (optional)</Label>
                        <Input value={regData.gst_number}
                          onChange={e => setRegData(p => ({ ...p, gst_number: e.target.value }))}
                          className="h-12 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-emerald-500 shadow-none text-sm font-bold text-slate-900"
                          placeholder="29AABCR1234F1Z5" data-testid="register-gst-number" />
                      </div>
                      <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg text-[10px] font-bold uppercase tracking-widest text-emerald-700" data-testid="pending-notice">
                        Venue owner accounts require admin verification.
                      </div>
                    </div>
                  )}

                  {regData.role === "coach" && (
                    <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg text-[10px] font-bold uppercase tracking-widest text-emerald-700 mt-3" data-testid="coach-pending-notice">
                      Coach accounts require admin verification.
                    </div>
                  )}

                  <Button type="submit" disabled={loading} data-testid="register-submit-btn"
                    className="w-full h-12 bg-emerald-600 rounded-xl text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors mt-6">
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
