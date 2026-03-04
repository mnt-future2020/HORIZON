import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { complianceAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, useReducedMotion } from "framer-motion";
import {
  Shield,
  Download,
  Trash2,
  Bell,
  FileText,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  Eye,
  Lock,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const TABS = [
  { id: "consent", label: "Consent", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "My Data", icon: Download },
  { id: "audit", label: "Audit Log", icon: FileText },
];

const NOTIF_CHANNELS = [
  {
    key: "email",
    label: "Email Notifications",
    desc: "Booking confirmations, receipts, and important updates",
    icon: "mail",
  },
  {
    key: "sms",
    label: "SMS Alerts",
    desc: "Time-sensitive alerts for bookings and reminders",
    icon: "phone",
  },
  {
    key: "push",
    label: "Push Notifications",
    desc: "Real-time updates on your device",
    icon: "bell",
  },
  {
    key: "in_app",
    label: "In-App Notifications",
    desc: "Activity feed and in-app alerts (always active)",
    icon: "inbox",
    locked: true,
  },
];

export default function PrivacySettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [tab, setTab] = useState("consent");
  const [consents, setConsents] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [erasureDialog, setErasureDialog] = useState(false);
  const [erasing, setErasing] = useState(false);

  const anim = (props) => (shouldReduceMotion ? {} : props);

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
          c.category === category ? { ...c, granted: !currentValue } : c,
        ),
      );
      toast.success(
        `${category} consent ${!currentValue ? "granted" : "revoked"}`,
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update consent");
    }
  };

  const toggleNotifPref = async (channel, currentValue) => {
    const updated = { ...notifPrefs, [channel]: !currentValue };
    try {
      await complianceAPI.updateNotificationPrefs(updated);
      setNotifPrefs(updated);
      toast.success(
        `${channel} notifications ${!currentValue ? "enabled" : "disabled"}`,
      );
    } catch {
      toast.error("Failed to update preferences");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await complianceAPI.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
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
      await complianceAPI.requestErasure({
        confirm: true,
        reason: "User requested deletion",
      });
      toast.success("Your data has been anonymized. Account deactivated.");
      setErasureDialog(false);
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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
        {/* Header */}
        <motion.div
          {...anim({
            initial: { opacity: 0, y: 15 },
            animate: { opacity: 1, y: 0 },
          })}
          className="mb-8"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Settings
          </span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Privacy & <span className="text-primary">Data</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
            Control your consent preferences, notification channels, and
            personal data.
          </p>
        </motion.div>

        {/* Custom Pill Tabs */}
        <div
          className="flex gap-1 bg-secondary/20 p-1 rounded-[28px] mb-6 overflow-x-auto"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-[22px] text-xs font-bold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap px-3
                ${
                  tab === t.id
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-muted-foreground hover:text-foreground"
                }
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Consent Tab */}
        {tab === "consent" && (
          <div id="panel-consent" role="tabpanel" className="space-y-3">
            {consents.length === 0 ? (
              <EmptyState
                icon={Shield}
                message="No consent categories configured"
              />
            ) : (
              consents.map((c, idx) => (
                <motion.div
                  key={c.category}
                  {...anim({
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: idx * 0.04 },
                  })}
                  className="group rounded-[24px] bg-card border border-border/40 shadow-sm p-4 sm:p-5 transition-colors duration-200 hover:border-border/60"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl flex-shrink-0 ${c.granted ? "bg-brand-600/10" : "bg-secondary/30"} transition-colors duration-200`}
                      >
                        <Shield
                          className={`h-4.5 w-4.5 ${c.granted ? "text-brand-600" : "text-muted-foreground"} transition-colors duration-200`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-sm capitalize">
                            {c.category}
                          </h3>
                          {c.required && (
                            <Badge className="text-[10px] h-4 px-1.5 bg-secondary border border-border/40 text-muted-foreground">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {c.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        !c.required && toggleConsent(c.category, c.granted)
                      }
                      disabled={c.required}
                      aria-label={`${c.granted ? "Revoke" : "Grant"} ${c.category} consent`}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors duration-200
                        ${c.required ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-secondary/20"}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50`}
                    >
                      {c.granted ? (
                        <ToggleRight className="h-7 w-7 text-brand-600" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {tab === "notifications" && (
          <div id="panel-notifications" role="tabpanel" className="space-y-3">
            {NOTIF_CHANNELS.map((ch, idx) => {
              const isActive = notifPrefs[ch.key] !== false;
              return (
                <motion.div
                  key={ch.key}
                  {...anim({
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: idx * 0.04 },
                  })}
                  className="group rounded-[24px] bg-card border border-border/40 shadow-sm p-4 sm:p-5 transition-colors duration-200 hover:border-border/60"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl flex-shrink-0 ${isActive ? "bg-brand-600/10" : "bg-secondary/30"} transition-colors duration-200`}
                      >
                        <Bell
                          className={`h-4.5 w-4.5 ${isActive ? "text-brand-600" : "text-muted-foreground"} transition-colors duration-200`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-sm">
                            {ch.label}
                          </h3>
                          {ch.locked && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {ch.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        !ch.locked &&
                        toggleNotifPref(ch.key, notifPrefs[ch.key])
                      }
                      disabled={ch.locked}
                      aria-label={`${isActive ? "Disable" : "Enable"} ${ch.label}`}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors duration-200
                        ${ch.locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-secondary/20"}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50`}
                    >
                      {isActive ? (
                        <ToggleRight className="h-7 w-7 text-brand-600" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Data Tab */}
        {tab === "data" && (
          <div id="panel-data" role="tabpanel" className="space-y-4">
            {/* Export Card */}
            <motion.div
              {...anim({
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
              })}
              className="rounded-[24px] bg-card border border-border/40 shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-brand-600/10 border border-border/40 flex-shrink-0">
                  <Download className="h-5 w-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base">
                    Export Your Data
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Download all your personal data including profile, bookings,
                    reviews, notifications, and payment records as a JSON file.
                  </p>
                  <Button
                    className="mt-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl h-10 px-5 shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {exporting ? "Exporting..." : "Export as JSON"}
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Privacy Info Card */}
            <motion.div
              {...anim({
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.06 },
              })}
              className="rounded-[24px] bg-card border border-border/40 shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-border/40 flex-shrink-0">
                  <Eye className="h-5 w-5 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base">
                    What Data We Store
                  </h3>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1.5 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                      Profile information (name, email, phone)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                      Booking history and payment records
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                      Reviews, ratings, and activity data
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                      Notification preferences and consent records
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Delete Card */}
            <motion.div
              {...anim({
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.12 },
              })}
              className="rounded-[24px] bg-card border border-red-500/20 shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base text-red-400">
                    Delete Account & Data
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Permanently anonymize your personal data. Booking history
                    will be retained with anonymized identity for compliance
                    purposes.
                  </p>
                  <Button
                    variant="destructive"
                    className="mt-4 rounded-xl h-10 px-5 active:scale-[0.98] transition-all cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setErasureDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Request Data Erasure
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && (
          <div id="panel-audit" role="tabpanel">
            {auditLog.length === 0 ? (
              <EmptyState
                icon={Clock}
                message="No audit records yet"
                sub="Privacy-related actions will appear here"
              />
            ) : (
              <div className="space-y-2">
                {auditLog.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    {...anim({
                      initial: { opacity: 0, x: -8 },
                      animate: { opacity: 1, x: 0 },
                      transition: { delay: idx * 0.03 },
                    })}
                    className="flex items-center gap-3 p-3.5 rounded-[16px] border border-border/40 bg-card transition-colors duration-200 hover:border-border/60"
                  >
                    <div className="p-2 rounded-lg bg-brand-600/10 flex-shrink-0">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm font-bold block truncate">
                        {log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Erasure Confirmation Dialog */}
      <Dialog open={erasureDialog} onOpenChange={setErasureDialog}>
        <DialogContent className="bg-card border border-red-500/20 max-w-[95vw] sm:max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-red-400 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              Confirm Data Erasure
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This action is{" "}
              <strong className="text-foreground">irreversible</strong>. The
              following will happen:
            </p>
            <ul className="text-sm space-y-2.5">
              {[
                "Personal info (name, email, phone) will be anonymized",
                "Booking history retained with anonymized identity",
                "Reviews will show anonymous author",
                "Notifications will be deleted",
                "Your account will be deactivated",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-muted-foreground"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 pt-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11 cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                onClick={() => setErasureDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl h-11 active:scale-[0.98] transition-all cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                onClick={handleErasure}
                disabled={erasing}
              >
                {erasing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {erasing ? "Processing..." : "Yes, Delete My Data"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="text-center py-16">
      <div className="p-4 rounded-2xl bg-secondary/20 inline-flex mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
    </div>
  );
}
