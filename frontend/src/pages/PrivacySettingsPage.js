import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { complianceAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Shield, Download, Trash2, Bell, FileText, Loader2,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function PrivacySettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [consents, setConsents] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [erasureDialog, setErasureDialog] = useState(false);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [consentRes, prefsRes, logRes] = await Promise.all([
        complianceAPI.getConsent().catch(() => ({ data: { consents: [] } })),
        complianceAPI.getNotificationPrefs().catch(() => ({ data: {} })),
        complianceAPI.getAuditLog(20).catch(() => ({ data: [] })),
      ]);
      setConsents(consentRes.data?.consents || []);
      setNotifPrefs(prefsRes.data || {});
      setAuditLog(logRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleConsent = async (category, currentValue) => {
    try {
      await complianceAPI.updateConsent({ category, granted: !currentValue });
      setConsents((prev) =>
        prev.map((c) =>
          c.category === category ? { ...c, granted: !currentValue } : c
        )
      );
      toast.success(`${category} consent ${!currentValue ? "granted" : "revoked"}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update consent");
    }
  };

  const toggleNotifPref = async (channel, currentValue) => {
    const updated = { ...notifPrefs, [channel]: !currentValue };
    try {
      await complianceAPI.updateNotificationPrefs(updated);
      setNotifPrefs(updated);
      toast.success(`${channel} notifications ${!currentValue ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update preferences");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await complianceAPI.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `horizon-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleErasure = async () => {
    setErasing(true);
    try {
      await complianceAPI.requestErasure({ confirm: true, reason: "User requested deletion" });
      toast.success("Your data has been anonymized. Account deactivated.");
      setErasureDialog(false);
      // Log out and redirect since account is now deactivated
      logout();
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to process erasure");
    } finally {
      setErasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-display-sm font-black tracking-athletic mb-2">
            Privacy & Data
          </h1>
          <p className="text-muted-foreground mb-8">
            Manage your privacy settings, consent preferences, and personal data.
          </p>
        </motion.div>

        <Tabs defaultValue="consent">
          <TabsList className="mb-6 bg-muted/50 p-1">
            <TabsTrigger value="consent" className="font-bold text-xs uppercase">
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Consent
            </TabsTrigger>
            <TabsTrigger value="notifications" className="font-bold text-xs uppercase">
              <Bell className="h-3.5 w-3.5 mr-1.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="data" className="font-bold text-xs uppercase">
              <Download className="h-3.5 w-3.5 mr-1.5" /> My Data
            </TabsTrigger>
            <TabsTrigger value="audit" className="font-bold text-xs uppercase">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Consent Tab */}
          <TabsContent value="consent">
            <div className="space-y-3">
              {consents.map((c, idx) => (
                <motion.div
                  key={c.category}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-card"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold capitalize">{c.category}</h3>
                      {c.required && (
                        <Badge variant="secondary" className="text-[10px]">Required</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                  </div>
                  <button
                    onClick={() => !c.required && toggleConsent(c.category, c.granted)}
                    disabled={c.required}
                    className={`transition-colors ${c.required ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {c.granted ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Notification Preferences Tab */}
          <TabsContent value="notifications">
            <div className="space-y-3">
              {[
                { key: "email", label: "Email", desc: "Receive notifications via email" },
                { key: "sms", label: "SMS", desc: "Receive notifications via SMS" },
                { key: "push", label: "Push", desc: "Receive push notifications" },
                { key: "in_app", label: "In-App", desc: "In-app notifications (always on)" },
              ].map((ch, idx) => (
                <motion.div
                  key={ch.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-card"
                >
                  <div>
                    <h3 className="font-display font-bold">{ch.label}</h3>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                  <button
                    onClick={() => ch.key !== "in_app" && toggleNotifPref(ch.key, notifPrefs[ch.key])}
                    disabled={ch.key === "in_app"}
                    className={ch.key === "in_app" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  >
                    {notifPrefs[ch.key] !== false ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data">
            <div className="space-y-6">
              {/* Export */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl border-2 border-border/50 bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg">Export Your Data</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Download all your personal data including profile, bookings, reviews,
                      notifications, and payment records.
                    </p>
                    <Button
                      variant="athletic-outline"
                      size="sm"
                      className="mt-4"
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      {exporting ? "Exporting..." : "Export as JSON"}
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Delete Account */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-6 rounded-xl border-2 border-destructive/30 bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <Trash2 className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg text-destructive">
                      Delete Account & Data
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently anonymize your personal data. Your booking history will be
                      retained with anonymized identity for compliance.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-4"
                      onClick={() => setErasureDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Request Data Erasure
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            {auditLog.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No audit records yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLog.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/50"
                  >
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm font-bold">{log.action}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(log.timestamp).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Erasure Confirmation Dialog */}
      <Dialog open={erasureDialog} onOpenChange={setErasureDialog}>
        <DialogContent className="bg-card border-2 border-destructive/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-black text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Erasure
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This action is <strong>irreversible</strong>. The following will happen:
            </p>
            <ul className="text-sm space-y-1.5 text-muted-foreground">
              <li>- Personal info (name, email, phone) will be anonymized</li>
              <li>- Booking history retained with anonymized identity</li>
              <li>- Reviews will show anonymous author</li>
              <li>- Notifications will be deleted</li>
              <li>- Your account will be deactivated</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setErasureDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleErasure}
                disabled={erasing}
              >
                {erasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {erasing ? "Processing..." : "Yes, Delete My Data"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
