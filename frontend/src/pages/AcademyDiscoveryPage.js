import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { academyAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  GraduationCap, Search, MapPin, IndianRupee, Users,
  Calendar, Clock, Loader2, CheckCircle
} from "lucide-react";

const SPORTS = ["all", "football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table_tennis", "swimming"];
const ACADEMY_IMG = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80";

function AcademyCard({ academy, onSelect, delay = 0 }) {
  const slots = Math.max(0, (academy.max_students || 50) - (academy.current_students || 0));
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={() => onSelect(academy)}
      className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-[1.02] hover:shadow-glow-sm transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-lg font-black text-foreground truncate group-hover:text-primary transition-colors">
              {academy.name}
            </h3>
            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{academy.sport}</Badge>
          </div>
          {academy.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{academy.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <IndianRupee className="h-3 w-3" /> ₹{academy.monthly_fee}/mo
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {academy.current_students}/{academy.max_students}
            </span>
            {academy.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {academy.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {academy.schedule}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Coach: <span className="font-bold text-foreground">{academy.coach_name}</span></span>
        <Badge variant={slots > 0 ? "default" : "destructive"} className="text-[10px]">
          {slots > 0 ? `${slots} slots available` : "Full"}
        </Badge>
      </div>
    </motion.div>
  );
}

export default function AcademyDiscoveryPage() {
  const { user } = useAuth();
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState(new Set());

  const loadAcademies = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (sportFilter !== "all") params.sport = sportFilter;
      const res = await academyAPI.list(params);
      setAcademies(res.data?.academies || res.data || []);
    } catch { setAcademies([]); }
    finally { setLoading(false); }
  }, [sportFilter]);

  useEffect(() => { loadAcademies(); }, [loadAcademies]);

  const filtered = academies.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      return a.name?.toLowerCase().includes(q) ||
        a.sport?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q) ||
        a.coach_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleEnroll = async () => {
    if (!selected) return;
    setEnrolling(true);
    try {
      const res = await academyAPI.enroll(selected.id, {});
      if (res.data?.payment_gateway === "test") {
        // Test mode — auto-confirm
        await academyAPI.testConfirmEnrollment(selected.id);
        toast.success("Enrolled successfully!");
        setEnrolledIds(prev => new Set([...prev, selected.id]));
      } else if (res.data?.razorpay_order_id) {
        // Razorpay payment flow
        const options = {
          key: res.data.razorpay_key_id,
          amount: selected.monthly_fee * 100,
          currency: "INR",
          name: "Lobbi",
          description: `${selected.name} - Monthly Fee`,
          order_id: res.data.razorpay_order_id,
          handler: async (response) => {
            try {
              await academyAPI.verifyEnrollment(selected.id, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment verified! Enrolled successfully!");
              setEnrolledIds(prev => new Set([...prev, selected.id]));
            } catch { toast.error("Payment verification failed"); }
          },
          prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: "#10B981" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.success("Enrollment initiated!");
      }
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Enrollment failed");
    } finally { setEnrolling(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-black mb-2">
          <GraduationCap className="inline h-7 w-7 mr-2 text-primary" />
          Academies
        </h1>
        <p className="text-sm text-muted-foreground">Browse and enroll in sports academies near you</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search academies, coaches, sports..."
            className="pl-10 bg-background border-border" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {SPORTS.map(s => (
            <button key={s} onClick={() => setSportFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                sportFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>{s === "all" ? "All Sports" : s.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a, i) => (
            <AcademyCard key={a.id} academy={a} onSelect={setSelected} delay={i * 0.05} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3" />
          <p className="font-bold">No academies found</p>
          <p className="text-sm mt-1">Try changing your filters</p>
        </div>
      )}

      {/* Enrollment Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="glass-card rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Sport</p>
                  <p className="font-bold capitalize">{selected.sport}</p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Monthly Fee</p>
                  <p className="font-bold text-primary">₹{selected.monthly_fee}</p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Coach</p>
                  <p className="font-bold">{selected.coach_name}</p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Available Slots</p>
                  <p className="font-bold">{Math.max(0, (selected.max_students || 50) - (selected.current_students || 0))}</p>
                </div>
                <div className="glass-card rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Schedule</p>
                  <p className="font-bold">{selected.schedule}</p>
                </div>
                {selected.location && (
                  <div className="glass-card rounded-lg p-3 col-span-2">
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-bold flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.location}</p>
                  </div>
                )}
              </div>
              {enrolledIds.has(selected.id) ? (
                <div className="flex items-center justify-center gap-2 py-3 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-bold">Already Enrolled</span>
                </div>
              ) : (
                <Button className="w-full bg-primary text-primary-foreground font-bold"
                  onClick={handleEnroll} disabled={enrolling || (selected.current_students >= selected.max_students)}>
                  {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
                  {enrolling ? "Processing..." : `Enroll — ₹${selected.monthly_fee}/month`}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
