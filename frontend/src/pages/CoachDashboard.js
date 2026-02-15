import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { academyAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { GraduationCap, Users, IndianRupee, Clock, Plus, Trash2, UserPlus } from "lucide-react";

export default function CoachDashboard() {
  const { user } = useAuth();
  const [academies, setAcademies] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", sport: "badminton", description: "", monthly_fee: 2000,
    location: "", max_students: 50, schedule: "",
  });
  const [studentForm, setStudentForm] = useState({ name: "", email: "", phone: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await academyAPI.list();
      const myAcademies = (res.data || []).filter(a => a.coach_id === user?.id);
      setAcademies(myAcademies);
      if (myAcademies.length > 0 && !selectedAcademy) {
        const detail = await academyAPI.get(myAcademies[0].id);
        setSelectedAcademy(detail.data);
      } else if (selectedAcademy) {
        const detail = await academyAPI.get(selectedAcademy.id);
        setSelectedAcademy(detail.data);
      }
    } catch {
      setAcademies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    try {
      const res = await academyAPI.create(form);
      toast.success("Academy created!");
      setCreateOpen(false);
      setSelectedAcademy(res.data);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleAddStudent = async () => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.addStudent(selectedAcademy.id, studentForm);
      toast.success("Student added!");
      setAddStudentOpen(false);
      setStudentForm({ name: "", email: "", phone: "" });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!selectedAcademy) return;
    try {
      await academyAPI.removeStudent(selectedAcademy.id, studentId);
      toast.success("Student removed");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const academy = selectedAcademy;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="coach-dashboard">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Coach Dashboard</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Welcome, <span className="text-primary">{user?.name}</span>
          </h1>
        </div>
        {!academy && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground font-bold text-xs h-9" data-testid="create-academy-btn">
                <Plus className="h-4 w-4 mr-1" /> Create Academy
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="font-display">Create Academy</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Academy Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="academy-name-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Sport</Label>
                  <Input value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="academy-sport-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Description</Label>
                  <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="academy-desc-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Monthly Fee</Label>
                    <Input type="number" value={form.monthly_fee} onChange={e => setForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))}
                      className="mt-1 bg-background border-border" data-testid="academy-fee-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Max Students</Label>
                    <Input type="number" value={form.max_students} onChange={e => setForm(p => ({ ...p, max_students: Number(e.target.value) }))}
                      className="mt-1 bg-background border-border" data-testid="academy-max-input" /></div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Location</Label>
                  <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    className="mt-1 bg-background border-border" data-testid="academy-location-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Schedule</Label>
                  <Input value={form.schedule} onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))}
                    placeholder="Mon/Wed/Fri 5-7 PM" className="mt-1 bg-background border-border" data-testid="academy-schedule-input" /></div>
                <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreate} data-testid="submit-academy-btn">Create Academy</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {academy ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Academy Info */}
          <div className="glass-card rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{academy.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{academy.description}</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">{academy.sport}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />
                <span className="text-sm"><span className="font-bold">{academy.current_students}</span>/{academy.max_students} students</span></div>
              <div className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold">{"\u20B9"}{academy.monthly_fee}/mo</span></div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-sky-400" />
                <span className="text-sm text-muted-foreground">{academy.schedule}</span></div>
              <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-violet-400" />
                <span className="text-sm text-muted-foreground">{academy.location}</span></div>
            </div>
          </div>

          {/* Revenue Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass-card rounded-lg p-4">
              <div className="text-xs text-muted-foreground font-mono uppercase">Monthly Revenue</div>
              <div className="text-xl font-display font-black text-primary mt-1">
                {"\u20B9"}{((academy.current_students || 0) * academy.monthly_fee).toLocaleString()}
              </div>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="text-xs text-muted-foreground font-mono uppercase">Active</div>
              <div className="text-xl font-display font-black text-foreground mt-1">
                {academy.students?.filter(s => s.subscription_status === "active").length || 0}
              </div>
            </div>
            <div className="glass-card rounded-lg p-4">
              <div className="text-xs text-muted-foreground font-mono uppercase">Pending</div>
              <div className="text-xl font-display font-black text-amber-400 mt-1">
                {academy.students?.filter(s => s.subscription_status === "pending").length || 0}
              </div>
            </div>
          </div>

          {/* Students */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Students</h3>
            <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8" data-testid="add-student-btn">
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-sm">
                <DialogHeader><DialogTitle className="font-display">Add Student</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="student-name-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Email</Label>
                    <Input type="email" value={studentForm.email} onChange={e => setStudentForm(p => ({ ...p, email: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="student-email-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={studentForm.phone} onChange={e => setStudentForm(p => ({ ...p, phone: e.target.value }))}
                      className="mt-1 bg-background border-border" data-testid="student-phone-input" /></div>
                  <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleAddStudent} data-testid="submit-student-btn">Add Student</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {academy.students?.length > 0 ? (
            <div className="glass-card rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-mono text-xs">Name</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Email</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Phone</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academy.students.map(s => (
                    <TableRow key={s.id} className="border-border">
                      <TableCell className="font-medium text-sm">{s.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.phone}</TableCell>
                      <TableCell>
                        <Badge variant={s.subscription_status === "active" ? "default" : "secondary"} className="text-[10px]">
                          {s.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveStudent(s.id)} data-testid={`remove-student-${s.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 glass-card rounded-lg text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No students yet</p>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="text-center py-20">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">No Academy Yet</h2>
          <p className="text-sm text-muted-foreground mb-6">Create your academy to start managing students and subscriptions.</p>
          <Button className="bg-primary text-primary-foreground font-bold" onClick={() => setCreateOpen(true)} data-testid="create-academy-empty-btn">
            <Plus className="h-4 w-4 mr-2" /> Create Academy
          </Button>
        </div>
      )}
    </div>
  );
}
