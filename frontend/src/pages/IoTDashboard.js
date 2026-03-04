import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { iotAPI, venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Power,
  Zap,
  Wifi,
  Plus,
  Trash2,
  Pencil,
  BarChart3,
  Clock,
  Calendar,
  RefreshCw,
  Layers,
  Sun,
  Moon,
  IndianRupee,
  ChevronRight,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { IoTSkeleton } from "@/components/SkeletonLoader";

/* ─── Constants ─────────────────────────────────────────────────────── */
const TYPE_LABELS = {
  floodlight: "Floodlight",
  led_panel: "LED Panel",
  ambient: "Ambient",
  emergency: "Emergency",
};
const TYPE_COLORS = {
  floodlight: "text-amber-600 bg-amber-500/10",
  led_panel: "text-sky-600 bg-sky-500/10",
  ambient: "text-violet-600 bg-violet-500/10",
  emergency: "text-red-600 bg-red-500/10",
};

/* ─── Stat Tile (native app style) ──────────────────────────────────── */
function StatTile({ icon: Icon, label, value, sub, index, accent = "brand" }) {
  const colors = {
    brand: { icon: "text-brand-600 bg-brand-600/10", dot: "bg-brand-600" },
    green: { icon: "text-green-600 bg-green-500/10", dot: "bg-green-500" },
    amber: { icon: "text-amber-600 bg-amber-500/10", dot: "bg-amber-500" },
    rupee: {
      icon: "text-emerald-600 bg-emerald-500/10",
      dot: "bg-emerald-500",
    },
  };
  const c = colors[accent] || colors.brand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.icon}`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

/* ─── Device Card (native list-row style on mobile) ─────────────────── */
function DeviceCard({ device, onControl, onEdit, onDelete, index }) {
  const [brightness, setBrightness] = useState(device.brightness || 0);
  const isOn = device.status === "on";
  const isOnline = device.is_online;
  const typeColor = TYPE_COLORS[device.device_type] || TYPE_COLORS.ambient;

  const handleToggle = () =>
    onControl(device.id, { action: isOn ? "off" : "on" });
  const handleBrightness = (val) => {
    setBrightness(val[0]);
    onControl(device.id, { action: "brightness", brightness: val[0] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-card rounded-2xl border border-border/40 overflow-hidden shadow-sm transition-colors ${
        !isOnline ? "opacity-50" : ""
      }`}
      data-testid={`device-card-${device.id}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Bulb icon */}
        <div
          className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
            isOn ? "bg-brand-600/10" : "bg-secondary/30"
          }`}
        >
          <Lightbulb
            className={`w-5 h-5 transition-colors ${
              isOn ? "text-brand-600" : "text-muted-foreground/30"
            }`}
          />
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {device.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${typeColor}`}
            >
              {TYPE_LABELS[device.device_type]}
            </span>
            <span
              className={`flex items-center gap-1 text-[11px] font-medium ${
                isOnline ? "text-green-600" : "text-muted-foreground/50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Power toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={isOn}
            onCheckedChange={handleToggle}
            disabled={!isOnline}
            className="data-[state=checked]:bg-brand-600 h-6 w-11"
            data-testid={`toggle-device-${device.id}`}
          />
        </div>

        {/* Actions (edit / delete) */}
        <div className="flex items-center shrink-0">
          <button
            aria-label="Edit device"
            onClick={() => onEdit(device)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
            data-testid={`edit-device-${device.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            aria-label="Delete device"
            onClick={() => onDelete(device.id)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors"
            data-testid={`delete-device-${device.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Brightness row (expanded when on) */}
      <AnimatePresence>
        {isOn && isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-secondary/10">
              <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <Slider
                value={[brightness]}
                min={1}
                max={100}
                step={5}
                onValueCommit={handleBrightness}
                className="flex-1"
                data-testid={`brightness-${device.id}`}
              />
              <span className="text-xs font-mono font-bold text-brand-600 w-9 text-right shrink-0">
                {brightness}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: protocol + energy + auto */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/30 bg-secondary/5 text-[11px] text-muted-foreground/60 font-medium">
        <span className="uppercase tracking-wider">{device.protocol}</span>
        {device.ip_address && (
          <span className="font-mono">{device.ip_address}</span>
        )}
        <span className="ml-auto font-semibold">{device.power_watts}W</span>
        {device.auto_schedule && (
          <span className="flex items-center gap-1 text-brand-600">
            <Clock className="w-3 h-3" /> Auto
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Zone Card (native section card) ───────────────────────────────── */
function ZoneCard({ zone, onControl, onDelete, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden"
      data-testid={`zone-card-${zone.id}`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-11 h-11 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{zone.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">
              {zone.turf_number ? `Turf ${zone.turf_number}` : "Common Area"}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-brand-600 font-medium">
              {zone.device_count || 0} devices
            </span>
          </div>
          {zone.description && (
            <p className="text-[11px] text-muted-foreground/60 italic mt-0.5 truncate">
              {zone.description}
            </p>
          )}
        </div>
        <button
          aria-label="Delete zone"
          onClick={() => onDelete(zone.id)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
          data-testid={`delete-zone-${zone.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-px bg-border/30">
        <button
          onClick={() => onControl(zone.id, { action: "on" })}
          className="flex items-center justify-center gap-2 py-3.5 bg-brand-600 text-white text-sm font-semibold active:bg-brand-700 transition-colors"
          data-testid={`zone-on-${zone.id}`}
        >
          <Power className="w-4 h-4" /> All On
        </button>
        <button
          onClick={() => onControl(zone.id, { action: "off" })}
          className="flex items-center justify-center gap-2 py-3.5 bg-card text-foreground text-sm font-medium active:bg-secondary/50 transition-colors"
          data-testid={`zone-off-${zone.id}`}
        >
          <Moon className="w-4 h-4" /> All Off
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Native bottom-sheet / dialog wrapper ───────────────────────────── */
function AppSheet({ open, onClose, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="
          !fixed !bottom-0 !top-auto !translate-y-0 !translate-x-0 !left-0 !right-0
          w-full max-w-full rounded-t-[24px] rounded-b-none bg-card p-0 shadow-2xl border-border/40
          max-h-[92vh] overflow-y-auto data-[state=open]:animate-none
          sm:!top-[50%] sm:!bottom-auto sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]
          sm:!w-full sm:!max-w-[480px] sm:!rounded-[24px]
        "
      >
        {/* Handle bar (mobile sheet indicator) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <DialogTitle className="text-base font-bold text-foreground">
            {title}
          </DialogTitle>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {/* Safe area bottom padding for iOS */}
        <div
          className="pb-safe sm:pb-0"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ─── Form Fields ────────────────────────────────────────────────────── */
function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

const inputCls =
  "h-12 rounded-xl bg-secondary/20 border-border/40 px-4 text-sm font-medium focus-visible:ring-brand-600/30";
const selectTriggerCls =
  "h-12 rounded-xl bg-secondary/20 border-border/40 px-4 text-sm font-medium";

/* ─── Main Dashboard ─────────────────────────────────────────────────── */
export default function IoTDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [devices, setDevices] = useState([]);
  const [zones, setZones] = useState([]);
  const [energy, setEnergy] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "devices",
  );
  const [period, setPeriod] = useState(searchParams.get("period") || "7d");
  const pendingVenueIdRef = useRef(searchParams.get("venue") || null);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [mqttStatus, setMqttStatus] = useState(null);
  const wsRef = useRef(null);
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    device_type: "floodlight",
    protocol: "mqtt",
    ip_address: "",
    power_watts: 500,
    turf_number: 1,
    zone_id: "",
  });
  const [zoneForm, setZoneForm] = useState({
    name: "",
    turf_number: 1,
    description: "",
  });

  useEffect(() => {
    iotAPI
      .mqttStatus()
      .then((r) => setMqttStatus(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = backendUrl.replace(/^http/, "ws") + "/api/iot/ws";
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "device_control" || msg.type === "device_status") {
            setDevices((prev) =>
              prev.map((d) =>
                d.id === msg.device_id || d.id === msg.data?.device_id
                  ? {
                      ...d,
                      ...msg.data,
                      status: msg.status || msg.data?.status || d.status,
                      brightness:
                        msg.brightness ?? msg.data?.brightness ?? d.brightness,
                    }
                  : d,
              ),
            );
          }
        } catch {
          /* ignore */
        }
      };
      wsRef.current = ws;
    } catch {
      /* ignore */
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const loadVenues = useCallback(async () => {
    try {
      const res =
        user?.role === "super_admin"
          ? await venueAPI.list()
          : await venueAPI.getOwnerVenues();
      const v = res.data || [];
      setVenues(v);
      if (v.length > 0) {
        const pendingId = pendingVenueIdRef.current;
        pendingVenueIdRef.current = null;
        setSelectedVenue(
          v.find((x) => String(x.id) === String(pendingId)) || v[0],
        );
      }
    } catch {
      /* ignore */
    }
  }, [user?.role]);

  const loadData = useCallback(
    async (venueId) => {
      if (!venueId) return;
      setLoading(true);
      try {
        const [dRes, zRes, eRes, sRes] = await Promise.all([
          iotAPI.listDevices(venueId).catch(() => ({ data: [] })),
          iotAPI.listZones(venueId).catch(() => ({ data: [] })),
          iotAPI.energy(venueId, period).catch(() => ({ data: null })),
          iotAPI.schedules(venueId).catch(() => ({ data: { schedules: [] } })),
        ]);
        setDevices(dRes.data || []);
        setZones(zRes.data || []);
        setEnergy(eRes.data);
        setSchedules(sRes.data?.schedules || []);
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);
  useEffect(() => {
    if (selectedVenue) loadData(selectedVenue.id);
  }, [selectedVenue, loadData]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (activeTab !== "devices") p.set("tab", activeTab);
    if (period !== "7d") p.set("period", period);
    if (selectedVenue) p.set("venue", String(selectedVenue.id));
    setSearchParams(p, { replace: true });
  }, [activeTab, period, selectedVenue, setSearchParams]);

  /* Handlers */
  const handleControlDevice = async (deviceId, ctrl) => {
    try {
      const res = await iotAPI.controlDevice(deviceId, ctrl);
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? res.data : d)));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Control failed");
    }
  };

  const handleControlZone = async (zoneId, ctrl) => {
    try {
      await iotAPI.controlZone(zoneId, ctrl);
      toast.success(
        `Zone ${ctrl.action === "on" ? "activated" : "deactivated"}`,
      );
      if (selectedVenue) loadData(selectedVenue.id);
    } catch {
      toast.error("Zone control failed");
    }
  };

  const openDeviceDialog = (device = null) => {
    setEditingDevice(device);
    setDeviceForm(
      device
        ? {
            name: device.name,
            device_type: device.device_type,
            protocol: device.protocol,
            ip_address: device.ip_address || "",
            power_watts: device.power_watts,
            turf_number: device.turf_number || 1,
            zone_id: device.zone_id || "",
          }
        : {
            name: "",
            device_type: "floodlight",
            protocol: "mqtt",
            ip_address: "",
            power_watts: 500,
            turf_number: 1,
            zone_id: "",
          },
    );
    setDeviceDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    if (!selectedVenue) return;
    const data = {
      ...deviceForm,
      venue_id: selectedVenue.id,
      zone_id: deviceForm.zone_id || null,
    };
    try {
      if (editingDevice) {
        await iotAPI.updateDevice(editingDevice.id, data);
        toast.success("Device updated");
      } else {
        await iotAPI.createDevice(data);
        toast.success("Device registered");
      }
      setDeviceDialogOpen(false);
      loadData(selectedVenue.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleDeleteDevice = async (id) => {
    try {
      await iotAPI.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      toast.success("Device removed");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleSaveZone = async () => {
    if (!selectedVenue) return;
    try {
      await iotAPI.createZone({ ...zoneForm, venue_id: selectedVenue.id });
      toast.success("Zone created");
      setZoneDialogOpen(false);
      loadData(selectedVenue.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleDeleteZone = async (id) => {
    try {
      await iotAPI.deleteZone(id);
      setZones((prev) => prev.filter((z) => z.id !== id));
      toast.success("Zone deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleSync = async () => {
    if (!selectedVenue) return;
    try {
      const res = await iotAPI.syncBookings(selectedVenue.id);
      toast.success(res.data.message);
    } catch {
      toast.error("Sync failed");
    }
  };

  const s = energy?.summary || {};
  const onlineCount = devices.filter((d) => d.is_online).length;
  const activeCount = devices.filter((d) => d.status === "on").length;
  const totalPower = devices
    .filter((d) => d.status === "on")
    .reduce((a, d) => a + d.power_watts, 0);

  if (loading && devices.length === 0) return <IoTSkeleton />;

  if (!selectedVenue && !loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
          <Lightbulb className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No venues found. Create a venue first.
        </p>
      </div>
    );

  const tooltipStyle = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 14,
      fontSize: 12,
      padding: "8px 12px",
    },
    itemStyle: { fontWeight: 700 },
    labelStyle: {
      color: "hsl(var(--muted-foreground))",
      marginBottom: 4,
      fontWeight: 600,
      fontSize: 11,
    },
  };

  const TABS = [
    { value: "devices", label: "Devices" },
    { value: "zones", label: "Zones", testId: "tab-zones" },
    { value: "energy", label: "Energy", testId: "tab-energy" },
    { value: "schedule", label: "Schedule", testId: "tab-schedule" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto" data-testid="iot-dashboard">
      {/* ── Page Header (app-like) ── */}
      <div className="flex items-center justify-between px-0 pt-8 pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            IoT Control Center
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            Smart <span className="text-brand-600">Lighting</span>
          </h1>
          {mqttStatus && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${mqttStatus.connected ? "bg-green-500" : "bg-muted-foreground"}`}
              />
              <span
                className={`text-xs font-semibold ${mqttStatus.connected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {mqttStatus.connected ? "MQTT Connected" : "Disconnected"}
              </span>
              {mqttStatus.broker && (
                <span className="text-xs text-muted-foreground/50 hidden sm:inline">
                  · {mqttStatus.broker}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleSync}
          data-testid="sync-btn"
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-card border border-border/40 text-sm font-semibold text-foreground hover:bg-secondary/40 active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>

      {/* ── Venue chips ── */}
      {venues.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar mb-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVenue(v)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition-all ${
                selectedVenue?.id === v.id
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-card border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Stat tiles 2×2 on mobile, 4-col on lg ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile
          icon={Wifi}
          label="Online"
          value={`${onlineCount}/${devices.length}`}
          sub="Devices online"
          index={0}
          accent="brand"
        />
        <StatTile
          icon={Lightbulb}
          label="Active"
          value={activeCount}
          sub="Lights on"
          index={1}
          accent="green"
        />
        <StatTile
          icon={Zap}
          label="Power"
          value={`${(totalPower / 1000).toFixed(1)} kW`}
          sub="Live demand"
          index={2}
          accent="amber"
        />
        <StatTile
          icon={IndianRupee}
          label="Daily Cost"
          value={`₹${s.avg_daily_cost || 0}`}
          sub="Est. avg spend"
          index={3}
          accent="rupee"
        />
      </div>

      {/* ── Scrollable tab bar ── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-testid="iot-tabs"
      >
        <div
          className="overflow-x-auto no-scrollbar mb-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex bg-secondary/30 border border-border/40 rounded-xl p-1 w-max min-w-full sm:min-w-0">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                data-testid={tab.testId}
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 flex-1 sm:flex-none h-9 px-4 sm:px-6 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  activeTab === tab.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Devices ── */}
        <TabsContent value="devices">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-bold text-foreground">
              Registered Devices
            </p>
            <button
              onClick={() => openDeviceDialog()}
              data-testid="add-device-btn"
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold shadow-sm shadow-brand-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="glass-premium rounded-[32px] border border-white/5 py-20 text-center text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="admin-heading text-foreground mb-2">Coming Soon</p>
              <p className="admin-label opacity-60">IoT device management will be available shortly</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {devices.map((d, idx) => (
                <DeviceCard
                  key={d.id}
                  device={d}
                  onControl={handleControlDevice}
                  onEdit={openDeviceDialog}
                  onDelete={handleDeleteDevice}
                  index={idx}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Zones ── */}
        <TabsContent value="zones">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-bold text-foreground">Control Zones</p>
            <button
              onClick={() => setZoneDialogOpen(true)}
              data-testid="add-zone-btn"
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold shadow-sm shadow-brand-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border/40">
              <div className="w-14 h-14 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
                <Layers className="w-7 h-7 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/60">
                No zones configured
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {zones.map((z, idx) => (
                <ZoneCard
                  key={z.id}
                  zone={z}
                  onControl={handleControlZone}
                  onEdit={() => {}}
                  onDelete={handleDeleteZone}
                  index={idx}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Energy ── */}
        <TabsContent value="energy">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <p className="text-base font-bold text-foreground">
              Energy Analytics
            </p>
            <div className="flex bg-secondary/30 border border-border/40 rounded-xl p-1 w-fit">
              {["7d", "30d"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    period === p
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>

          {energy ? (
            <div className="space-y-4">
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total kWh", val: s.period_kwh },
                  { label: "Total Cost", val: `₹${s.period_cost}` },
                  { label: "Avg Daily kWh", val: s.avg_daily_kwh },
                  { label: "Avg Daily Cost", val: `₹${s.avg_daily_cost}` },
                ].map((st, i) => (
                  <motion.div
                    key={st.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {st.label}
                    </p>
                    <p className="text-xl font-bold text-brand-600">{st.val}</p>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              {energy.daily?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    {
                      title: "Consumption (kWh)",
                      dataKey: "kwh",
                      stroke: "#10b981",
                      accent: "brand",
                    },
                    {
                      title: "Daily Cost (₹)",
                      dataKey: "cost",
                      stroke: "#f59e0b",
                      accent: "amber",
                    },
                  ].map(({ title, dataKey, stroke }) => (
                    <div
                      key={dataKey}
                      className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm"
                    >
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 pl-1 border-l-2 border-brand-500">
                        {title}
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        {dataKey === "kwh" ? (
                          <AreaChart data={energy.daily}>
                            <defs>
                              <linearGradient
                                id="cKwh"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={stroke}
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={stroke}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="hsl(var(--border))"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                              tickFormatter={(d) => d.slice(5)}
                              axisLine={false}
                              tickLine={false}
                              dy={6}
                            />
                            <YAxis
                              tick={{
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                              width={32}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle.contentStyle}
                              itemStyle={{
                                ...tooltipStyle.itemStyle,
                                color: stroke,
                              }}
                              labelStyle={tooltipStyle.labelStyle}
                            />
                            <Area
                              type="monotone"
                              dataKey={dataKey}
                              stroke={stroke}
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#cKwh)"
                              animationDuration={1000}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={energy.daily}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="hsl(var(--border))"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                              tickFormatter={(d) => d.slice(5)}
                              axisLine={false}
                              tickLine={false}
                              dy={6}
                            />
                            <YAxis
                              tick={{
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                              width={32}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle.contentStyle}
                              itemStyle={{
                                ...tooltipStyle.itemStyle,
                                color: stroke,
                              }}
                              labelStyle={tooltipStyle.labelStyle}
                              cursor={{ fill: "hsl(var(--secondary) / 0.4)" }}
                            />
                            <Bar
                              dataKey={dataKey}
                              fill={stroke}
                              radius={[5, 5, 0, 0]}
                              barSize={20}
                              animationDuration={1000}
                            />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border/40">
              <BarChart3 className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/60">
                No energy data yet
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Schedule ── */}
        <TabsContent value="schedule">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-bold text-foreground">
              Lighting Schedule
            </p>
            <button
              onClick={handleSync}
              data-testid="sync-schedule-btn"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-card border border-border/40 text-sm font-medium active:scale-95 transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border/40 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
                <Calendar className="w-7 h-7 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/70">
                No bookings today
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1 max-w-[220px] leading-relaxed">
                Lights auto-activate from booking confirmations
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((sch, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden"
                  data-testid={`schedule-${i}`}
                >
                  {/* Mobile: stacked rows */}
                  <div className="flex items-stretch">
                    {/* Time column */}
                    <div className="flex flex-col items-center justify-center px-4 py-4 bg-brand-600/5 border-r border-brand-600/10 w-20 shrink-0">
                      <span className="text-sm font-bold text-brand-600 leading-none">
                        {sch.slot_start}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60 mt-1 leading-none">
                        {sch.slot_end}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 px-3 py-3">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {sch.zone_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/70">
                          {sch.host_name}
                        </span>
                        <span className="text-[11px] font-medium text-brand-600 bg-brand-600/8 px-1.5 py-0.5 rounded-md">
                          {sch.sport}
                        </span>
                      </div>
                    </div>
                    {/* Power indicators */}
                    <div className="flex flex-col justify-center gap-1.5 px-3 py-3 shrink-0 text-right">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 justify-end">
                        <Sun className="w-3 h-3" />
                        {sch.lights_on}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/50 justify-end">
                        <Moon className="w-3 h-3" />
                        {sch.lights_off}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Device Sheet ── */}
      <AppSheet
        open={deviceDialogOpen}
        onClose={setDeviceDialogOpen}
        title={editingDevice ? "Edit Device" : "Register Device"}
      >
        <div className="space-y-4">
          <FormField label="Device Name">
            <Input
              value={deviceForm.name}
              onChange={(e) =>
                setDeviceForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="e.g. North Floodlight 01"
              className={inputCls}
              data-testid="device-name-input"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <Select
                value={deviceForm.device_type}
                onValueChange={(v) =>
                  setDeviceForm((p) => ({ ...p, device_type: v }))
                }
              >
                <SelectTrigger
                  className={selectTriggerCls}
                  data-testid="device-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-card">
                  <SelectItem value="floodlight">Floodlight</SelectItem>
                  <SelectItem value="led_panel">LED Panel</SelectItem>
                  <SelectItem value="ambient">Ambient</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Protocol">
              <Select
                value={deviceForm.protocol}
                onValueChange={(v) =>
                  setDeviceForm((p) => ({ ...p, protocol: v }))
                }
              >
                <SelectTrigger
                  className={selectTriggerCls}
                  data-testid="device-protocol-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-card">
                  <SelectItem value="mqtt">MQTT</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="zigbee">Zigbee</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="IP Address">
              <Input
                value={deviceForm.ip_address}
                onChange={(e) =>
                  setDeviceForm((p) => ({ ...p, ip_address: e.target.value }))
                }
                placeholder="192.168.1.1"
                className={`${inputCls} font-mono`}
                data-testid="device-ip-input"
              />
            </FormField>
            <FormField label="Power (W)">
              <Input
                type="number"
                value={deviceForm.power_watts}
                onChange={(e) =>
                  setDeviceForm((p) => ({
                    ...p,
                    power_watts: Number(e.target.value),
                  }))
                }
                className={inputCls}
                data-testid="device-watts-input"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Turf #">
              <Input
                type="number"
                value={deviceForm.turf_number}
                onChange={(e) =>
                  setDeviceForm((p) => ({
                    ...p,
                    turf_number: Number(e.target.value),
                  }))
                }
                className={inputCls}
                data-testid="device-turf-input"
              />
            </FormField>
            <FormField label="Zone">
              <Select
                value={deviceForm.zone_id}
                onValueChange={(v) =>
                  setDeviceForm((p) => ({ ...p, zone_id: v }))
                }
              >
                <SelectTrigger
                  className={selectTriggerCls}
                  data-testid="device-zone-select"
                >
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-card">
                  <SelectItem value="none">No zone</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <button
            onClick={handleSaveDevice}
            data-testid="save-device-btn"
            className="w-full h-13 py-3.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all"
          >
            {editingDevice ? "Update Device" : "Register Device"}
          </button>
        </div>
      </AppSheet>

      {/* ── Add Zone Sheet ── */}
      <AppSheet
        open={zoneDialogOpen}
        onClose={setZoneDialogOpen}
        title="Create Zone"
      >
        <div className="space-y-4">
          <FormField label="Zone Name">
            <Input
              value={zoneForm.name}
              onChange={(e) =>
                setZoneForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="e.g. Main Turf North"
              className={inputCls}
              data-testid="zone-name-input"
            />
          </FormField>
          <FormField label="Turf Number">
            <Input
              type="number"
              value={zoneForm.turf_number}
              onChange={(e) =>
                setZoneForm((p) => ({
                  ...p,
                  turf_number: Number(e.target.value),
                }))
              }
              className={inputCls}
              data-testid="zone-turf-input"
            />
          </FormField>
          <FormField label="Description">
            <Input
              value={zoneForm.description}
              onChange={(e) =>
                setZoneForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Brief description..."
              className={inputCls}
              data-testid="zone-desc-input"
            />
          </FormField>
          <button
            onClick={handleSaveZone}
            data-testid="save-zone-btn"
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all"
          >
            Create Zone
          </button>
        </div>
      </AppSheet>
    </div>
  );
}
