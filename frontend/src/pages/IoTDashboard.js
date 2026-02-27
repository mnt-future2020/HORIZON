import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { iotAPI, venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Lightbulb, Power, Zap, Wifi, WifiOff, Plus, Trash2, Pencil,
  BarChart3, Clock, Calendar, RefreshCw, Layers, Sun, Moon,
  Activity, DollarSign, TrendingDown, Loader2, Radio, IndianRupee
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { IoTSkeleton } from "@/components/SkeletonLoader";

const TYPE_LABELS = { floodlight: "Floodlight", led_panel: "LED Panel", ambient: "Ambient", emergency: "Emergency" };
const TYPE_COLORS = {
  floodlight: "text-amber-400 bg-amber-500/15",
  led_panel: "text-sky-400 bg-sky-500/15",
  ambient: "text-violet-400 bg-violet-500/15",
  emergency: "text-red-400 bg-red-500/15",
};

const IoTStatCard = ({ icon: Icon, label, value, sub, index, colorClass = "text-brand-600", bgClass = "bg-brand-600/10" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    whileHover={{ y: -5, borderColor: "rgba(var(--brand-600), 0.2)" }}
    className="bg-card rounded-[32px] p-7 border border-border/60 shadow-sm overflow-hidden relative group h-full flex flex-col justify-between transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-6 relative z-10">
      <div className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.25em] drop-shadow-sm">{label}</div>
      <div className={`p-3.5 rounded-2xl ${bgClass} flex items-center justify-center border border-border/40`}>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </div>
    </div>

    <div className="relative z-10">
      <div className="text-4xl font-black tracking-tight font-display mb-1.5 text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground/70 font-bold uppercase tracking-wider">{sub}</div>}
    </div>

    <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out`} />
  </motion.div>
);



function DeviceCard({ device, onControl, onEdit, onDelete, index }) {
  const [brightness, setBrightness] = useState(device.brightness || 0);
  const isOn = device.status === "on";
  const isOnline = device.is_online;
  const typeColor = TYPE_COLORS[device.device_type] || TYPE_COLORS.ambient;

  const handleToggle = () => {
    onControl(device.id, { action: isOn ? "off" : "on" });
  };

  const handleBrightness = (val) => {
    setBrightness(val[0]);
    onControl(device.id, { action: "brightness", brightness: val[0] });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, borderColor: "rgba(var(--brand-600), 0.2)" }}
      className={`bg-card rounded-[28px] p-6 border border-border/40 shadow-sm transition-all duration-300 relative overflow-hidden group ${
        !isOnline ? "opacity-50 grayscale" : ""
      }`} data-testid={`device-card-${device.id}`}>
      
      <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 border border-border/40 ${
            isOn ? "bg-brand-500/10 shadow-sm" : "bg-secondary/20"
          }`}>
            <Lightbulb className={`h-7 w-7 transition-colors duration-500 ${isOn ? "text-brand-500" : "text-muted-foreground/30"}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-[15px] tracking-tight text-foreground/90 truncate">{device.name}</h4>
            <div className="flex items-center gap-2.5 mt-1.5 font-display">
              <Badge className={`text-[10px] font-black uppercase tracking-widest ${typeColor} border-0 px-2.5 py-1 rounded-lg`}>
                {TYPE_LABELS[device.device_type]}
              </Badge>
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-brand-600 uppercase">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-600" /> ONLINE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
                   OFFLINE
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary/20"
            onClick={() => onEdit(device)} data-testid={`edit-device-${device.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5"
            onClick={() => onDelete(device.id)} data-testid={`delete-device-${device.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Switch 
            checked={isOn} 
            onCheckedChange={handleToggle} 
            disabled={!isOnline}
            className="data-[state=checked]:bg-brand-600 h-6 w-11 transition-all"
            data-testid={`toggle-device-${device.id}`} 
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-muted-foreground/60 tracking-widest uppercase mb-0.5">Energy</span>
            <span className="text-sm font-black text-foreground/90">{device.power_watts}W</span>
          </div>
        </div>
        {isOn && isOnline && (
          <div className="flex items-center gap-4 w-36 bg-secondary/20 px-4 py-2.5 rounded-[20px] border border-border/40 transition-all duration-300">
            <Sun className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            <Slider value={[brightness]} min={1} max={100} step={5}
              onValueCommit={handleBrightness} 
              className="flex-1"
              data-testid={`brightness-${device.id}`} />
            <span className="text-xs font-black font-mono text-brand-500 w-8 text-right">{brightness}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-6 pt-5 border-t border-border/40 text-[10px] font-black tracking-[0.15em] text-muted-foreground/50 uppercase relative z-10">
        <span className="px-2.5 py-1 rounded-lg bg-secondary/10 border border-border/40">{device.protocol}</span>
        {device.ip_address && <span className="opacity-80 font-mono tracking-normal">{device.ip_address}</span>}
        {device.auto_schedule && (
          <span className="text-brand-600 font-bold flex items-center gap-1.5 ml-auto uppercase tracking-widest text-[10px]">
            <Clock className="h-3 w-3" /> AUTO ACTIVE
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ZoneCard({ zone, onControl, onEdit, onDelete, index }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ x: 5, borderColor: "rgba(var(--brand-600), 0.15)" }}
      className="bg-card rounded-[24px] p-6 border border-border/40 flex items-center justify-between gap-6 group shadow-sm transition-all duration-300" 
      data-testid={`zone-card-${zone.id}`}
    >
      <div className="flex items-center gap-6 min-w-0">
        <div className="h-16 w-16 rounded-[20px] bg-brand-600/10 flex items-center justify-center shrink-0 border border-border/40 transition-all duration-500">
          <Layers className="h-8 w-8 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h4 className="font-black text-xl tracking-tight text-foreground/90">{zone.name}</h4>
          <div className="flex items-center gap-3 mt-2 font-display">
            <Badge className="bg-secondary/20 text-[10px] font-black tracking-[0.15em] uppercase text-muted-foreground/80 px-3 py-1 border border-border/40 rounded-lg">
              {zone.turf_number ? `TURF ${zone.turf_number}` : "COMMON AREA"}
            </Badge>
            <span className="text-[11px] font-black tracking-widest text-brand-600 uppercase">
              {zone.device_count || 0} DEVICES
            </span>
          </div>
          {zone.description && <p className="text-sm text-muted-foreground/60 mt-2.5 italic truncate font-medium">{zone.description}</p>}
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        <Button 
          size="sm" 
          onClick={() => onControl(zone.id, { action: "on" })} 
          className="bg-brand-600 hover:bg-brand-500 text-white font-black text-[11px] tracking-widest uppercase h-11 px-7 rounded-2xl shadow-md shadow-brand-600/10 active:scale-95 transition-all outline-none border-0"
          data-testid={`zone-on-${zone.id}`}
        >
          <Power className="h-4 w-4 mr-2.5" /> ALL ON
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => onControl(zone.id, { action: "off" })} 
          className="bg-background border-border/60 hover:border-brand-600 text-foreground font-black text-[11px] tracking-widest uppercase h-11 px-7 rounded-2xl active:scale-95 transition-all outline-none"
          data-testid={`zone-off-${zone.id}`}
        >
          <Moon className="h-4 w-4 mr-2.5" /> ALL OFF
        </Button>
        <Button size="icon" variant="ghost" className="h-11 w-11 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-full transition-colors"
          onClick={() => onDelete(zone.id)} data-testid={`delete-zone-${zone.id}`}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function IoTDashboard() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [devices, setDevices] = useState([]);
  const [zones, setZones] = useState([]);
  const [energy, setEnergy] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [mqttStatus, setMqttStatus] = useState(null);
  const wsRef = useRef(null);
  const [deviceForm, setDeviceForm] = useState({
    name: "", device_type: "floodlight", protocol: "mqtt", ip_address: "",
    power_watts: 500, turf_number: 1, zone_id: "",
  });
  const [zoneForm, setZoneForm] = useState({ name: "", turf_number: 1, description: "" });

  // Fetch MQTT status
  useEffect(() => {
    iotAPI.mqttStatus().then(r => setMqttStatus(r.data)).catch(() => {});
  }, []);

  // WebSocket for real-time updates
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
            setDevices(prev => prev.map(d =>
              d.id === msg.device_id || d.id === msg.data?.device_id
                ? { ...d, ...msg.data, status: msg.status || msg.data?.status || d.status, brightness: msg.brightness ?? msg.data?.brightness ?? d.brightness }
                : d
            ));
          }
        } catch { /* ignore */ }
      };
      wsRef.current = ws;
    } catch { /* ignore */ }
    return () => { if (ws) ws.close(); };
  }, []);

  const loadVenues = useCallback(async () => {
    try {
      const res = user?.role === "super_admin"
        ? await venueAPI.list()
        : await venueAPI.getOwnerVenues();
      const v = res.data || [];
      setVenues(v);
      if (v.length > 0 && !selectedVenue) setSelectedVenue(v[0]);
    } catch { /* ignore */ }
  }, [user?.role, selectedVenue]);

  const loadData = useCallback(async (venueId) => {
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
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadVenues(); }, [loadVenues]);
  useEffect(() => { if (selectedVenue) loadData(selectedVenue.id); }, [selectedVenue, loadData]);

  const handleControlDevice = async (deviceId, ctrl) => {
    try {
      const res = await iotAPI.controlDevice(deviceId, ctrl);
      setDevices(prev => prev.map(d => d.id === deviceId ? res.data : d));
    } catch (err) { toast.error(err.response?.data?.detail || "Control failed"); }
  };

  const handleControlZone = async (zoneId, ctrl) => {
    try {
      await iotAPI.controlZone(zoneId, ctrl);
      toast.success(`Zone ${ctrl.action === "on" ? "activated" : "deactivated"}`);
      if (selectedVenue) loadData(selectedVenue.id);
    } catch (err) { toast.error("Zone control failed"); }
  };

  const openDeviceDialog = (device = null) => {
    setEditingDevice(device);
    if (device) {
      setDeviceForm({
        name: device.name, device_type: device.device_type, protocol: device.protocol,
        ip_address: device.ip_address || "", power_watts: device.power_watts,
        turf_number: device.turf_number || 1, zone_id: device.zone_id || "",
      });
    } else {
      setDeviceForm({ name: "", device_type: "floodlight", protocol: "mqtt", ip_address: "", power_watts: 500, turf_number: 1, zone_id: "" });
    }
    setDeviceDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    if (!selectedVenue) return;
    const data = { ...deviceForm, venue_id: selectedVenue.id, zone_id: deviceForm.zone_id || null };
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
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleDeleteDevice = async (id) => {
    try {
      await iotAPI.deleteDevice(id);
      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success("Device removed");
    } catch { toast.error("Delete failed"); }
  };

  const handleSaveZone = async () => {
    if (!selectedVenue) return;
    try {
      await iotAPI.createZone({ ...zoneForm, venue_id: selectedVenue.id });
      toast.success("Zone created");
      setZoneDialogOpen(false);
      loadData(selectedVenue.id);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleDeleteZone = async (id) => {
    try {
      await iotAPI.deleteZone(id);
      setZones(prev => prev.filter(z => z.id !== id));
      toast.success("Zone deleted");
    } catch { toast.error("Delete failed"); }
  };

  const handleSync = async () => {
    if (!selectedVenue) return;
    try {
      const res = await iotAPI.syncBookings(selectedVenue.id);
      toast.success(res.data.message);
    } catch { toast.error("Sync failed"); }
  };

  const s = energy?.summary || {};
  const onlineCount = devices.filter(d => d.is_online).length;
  const activeCount = devices.filter(d => d.status === "on").length;
  const totalPower = devices.filter(d => d.status === "on").reduce((acc, d) => acc + d.power_watts, 0);

  // Show skeleton during initial load
  if (loading && devices.length === 0) {
    return <IoTSkeleton />;
  }

  if (!selectedVenue && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No venues found. Create a venue first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="iot-dashboard">
      <div className="flex items-start justify-between gap-3 mb-10">
        <div className="min-w-0">
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60"
          >
            IoT Control Center
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl md:text-5xl font-black tracking-tight mt-2 text-foreground"
          >
            Smart <span className="text-brand-600">Lighting</span>
          </motion.h1>
          {mqttStatus && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 mt-4 bg-brand-600/5 w-fit px-4 py-2 rounded-full border border-brand-600/20" 
              data-testid="mqtt-status"
            >
              <div className={`h-2 w-2 rounded-full ${mqttStatus.connected ? "bg-brand-600" : "bg-muted-foreground"}`} />
              <span className={`text-[10px] font-black uppercase tracking-wider ${mqttStatus.connected ? "text-brand-600" : "text-muted-foreground"}`}>
                {mqttStatus.connected ? "MQTT Connected" : "Connection Lost"}
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-bold ml-1 border-l border-border/40 pl-2">
                {mqttStatus.broker}
              </span>
            </motion.div>
          )}
        </div>
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.2 }}
        >
          <Button size="lg" variant="outline" className="bg-card border-border/40 font-black text-xs h-12 px-6 rounded-2xl hover:bg-brand-600/5 hover:text-brand-600 hover:border-brand-600/30 transition-all active:scale-95 shadow-sm"
            onClick={handleSync} data-testid="sync-btn">
            <RefreshCw className="h-4 w-4 mr-2" /> SYNC BOOKINGS
          </Button>
        </motion.div>
      </div>

      {/* Venue selector */}
      {venues.length > 1 && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
          {venues.map(v => (
            <Button key={v.id} size="sm" 
              variant={selectedVenue?.id === v.id ? "default" : "outline"}
              onClick={() => setSelectedVenue(v)} 
              className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-5 h-9 rounded-xl transition-all ${
                selectedVenue?.id === v.id 
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" 
                  : "bg-card border-border/40 hover:border-brand-600/40 shadow-sm"
              }`}
            >
              {v.name}
            </Button>
          ))}
        </div>
      )}

      {/* Live stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <IoTStatCard 
          icon={Wifi} 
          label="Network Status" 
          value={`${onlineCount}/${devices.length}`} 
          sub="DEVICES ONLINE"
          index={0}
          colorClass="text-brand-600"
          bgClass="bg-brand-600/10"
        />
        <IoTStatCard 
          icon={Lightbulb} 
          label="Active Control" 
          value={activeCount} 
          sub="LIGHTS POWERED"
          index={1}
          colorClass="text-brand-600"
          bgClass="bg-brand-600/10"
        />
        <IoTStatCard 
          icon={Zap} 
          label="Energy Draw" 
          value={(totalPower / 1000).toFixed(1)} 
          sub="KW CURRENT DEMAND"
          index={2}
          colorClass="text-brand-600"
          bgClass="bg-brand-600/10"
        />
        <IoTStatCard 
          icon={IndianRupee} 
          label="Estimated Cost" 
          value={`₹${s.avg_daily_cost || 0}`} 
          sub="AVG DAILY SPEND"
          index={3}
          colorClass="text-brand-600"
          bgClass="bg-brand-600/10"
        />
      </div>

      <Tabs defaultValue="devices" data-testid="iot-tabs">
        <TabsList className="bg-white/5 border border-white/5 p-1 rounded-2xl h-12 mb-8 gap-1">
          <TabsTrigger value="devices" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white font-black text-[10px] tracking-widest uppercase rounded-xl h-full px-6 transition-all">Devices</TabsTrigger>
          <TabsTrigger value="zones" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white font-black text-[10px] tracking-widest uppercase rounded-xl h-full px-6 transition-all" data-testid="tab-zones">Zones</TabsTrigger>
          <TabsTrigger value="energy" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white font-black text-[10px] tracking-widest uppercase rounded-xl h-full px-6 transition-all" data-testid="tab-energy">Energy</TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-brand-600 data-[state=active]:text-white font-black text-[10px] tracking-widest uppercase rounded-xl h-full px-6 transition-all" data-testid="tab-schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-black text-xl tracking-tight text-foreground">Registered Devices</h3>
            <Button size="sm" onClick={() => openDeviceDialog()} className="bg-brand-600 hover:bg-brand-500 text-white font-black text-[10px] tracking-widest uppercase h-10 px-6 rounded-xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all"
              data-testid="add-device-btn"><Plus className="h-4 w-4 mr-2" /> ADD DEVICE</Button>
          </div>
          {devices.length === 0 ? (
            <div className="glass-premium rounded-[32px] border border-white/5 py-20 text-center text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-black tracking-widest uppercase opacity-40">No devices found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((d, idx) => (
                <DeviceCard key={d.id} device={d} onControl={handleControlDevice}
                  onEdit={openDeviceDialog} onDelete={handleDeleteDevice} index={idx} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-black text-xl tracking-tight text-foreground">Control Zones</h3>
            <Button size="sm" onClick={() => setZoneDialogOpen(true)} className="bg-brand-600 hover:bg-brand-500 text-white font-black text-[10px] tracking-widest uppercase h-10 px-6 rounded-xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all"
              data-testid="add-zone-btn"><Plus className="h-4 w-4 mr-2" /> ADD ZONE</Button>
          </div>
          {zones.length === 0 ? (
            <div className="glass-premium rounded-[32px] border border-white/5 py-20 text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-black tracking-widest uppercase opacity-40">No zones configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {zones.map((z, idx) => (
                <ZoneCard key={z.id} zone={z} onControl={handleControlZone}
                  onEdit={() => {}} onDelete={handleDeleteZone} index={idx} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Energy Tab */}
        <TabsContent value="energy">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display font-black text-xl tracking-tight text-foreground">Energy Analytics</h3>
            <div className="bg-white/5 border border-white/5 p-1 rounded-xl flex items-center gap-1">
              {["7d", "30d"].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    period === p ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {p === "7d" ? "LAST 7 DAYS" : "LAST 30 DAYS"}
                </button>
              ))}
            </div>
          </div>

          {energy ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total kWh", val: s.period_kwh, color: "text-brand-600" },
                  { label: "Total Cost", val: `₹${s.period_cost}`, color: "text-brand-600" },
                  { label: "Avg Daily kWh", val: s.avg_daily_kwh, color: "text-brand-600" },
                  { label: "Avg Daily Cost", val: `₹${s.avg_daily_cost}`, color: "text-brand-600" }
                ].map((stat, i) => (
                  <motion.div 
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-3xl p-7 border border-border/40 shadow-sm flex flex-col justify-between group h-full transition-all duration-300 hover:y-[-4px] hover:border-brand-600/20"
                  >
                    <div className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/80 mb-4 drop-shadow-sm group-hover:text-foreground/70 transition-colors">{stat.label}</div>
                    <div className={`text-3xl font-black font-display tracking-tight ${stat.color}`}>{stat.val}</div>
                  </motion.div>
                ))}
              </div>

              {energy.daily?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card rounded-[32px] p-8 border border-border/40 shadow-sm"
                  >
                    <h4 className="font-display font-black text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-8 border-l-2 border-brand-500 pl-4">Energy Consumption (kWh)</h4>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={energy.daily}>
                        <defs>
                          <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800 }} width={40} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: "rgba(15, 20, 25, 0.98)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, backdropFilter: "blur(20px)", padding: "12px 16px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }} 
                          itemStyle={{ color: "#10b981", fontWeight: 900, textTransform: "uppercase" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontWeight: 700 }}
                        />
                        <Area type="monotone" dataKey="kwh" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorKwh)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-premium rounded-[32px] p-8 border border-white/5 shadow-xl"
                  >
                    <h4 className="font-display font-black text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-8 border-l-2 border-amber-500 pl-4">Daily Cost ({"\u20B9"})</h4>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={energy.daily}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800 }} width={40} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: "rgba(15, 20, 25, 0.98)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, backdropFilter: "blur(20px)", padding: "12px 16px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          itemStyle={{ color: "#f59e0b", fontWeight: 900, textTransform: "uppercase" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontWeight: 700 }}
                        />
                        <Bar dataKey="cost" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={28} animationDuration={1500} />
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-[32px] border border-border/40 py-20 text-center text-muted-foreground/60 shadow-sm">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-black tracking-widest uppercase opacity-40">No energy data collected</p>
            </div>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display font-black text-xl tracking-tight text-foreground">Lighting Schedule</h3>
            <Button size="sm" variant="outline" className="bg-card border-border/40 font-black text-[10px] tracking-widest h-10 px-6 rounded-xl transition-all hover:bg-secondary/20 shadow-sm" onClick={handleSync} data-testid="sync-schedule-btn">
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> RE-SYNC
            </Button>
          </div>
          {schedules.length === 0 ? (
            <div className="bg-card rounded-[32px] border border-border/40 py-24 text-center group shadow-sm">
              <div className="relative w-max mx-auto mb-8 text-muted-foreground/10 group-hover:text-brand-600/20 transition-colors duration-700">
                <Calendar className="h-20 w-20" />
              </div>
              <p className="text-base font-black tracking-tight text-foreground/60">No bookings scheduled today</p>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-600/60 mt-4 max-w-[280px] mx-auto leading-relaxed">Lights auto-activate based on real-time booking confirmation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2, borderColor: "rgba(var(--brand-600), 0.15)" }}
                  className="bg-card rounded-[22px] p-5 border border-border/40 flex items-center gap-8 shadow-sm transition-all duration-300 group" data-testid={`schedule-${i}`}>
                  <div className="shrink-0 w-28 flex flex-col items-center border-r border-border/40 pr-4">
                    <div className="text-[15px] font-black text-brand-600 font-display tracking-tight leading-none mb-1.5">{s.slot_start}</div>
                    <div className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] leading-none">{s.slot_end}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-black tracking-tight text-foreground/90 truncate mb-1">{s.zone_name}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-muted-foreground/70 uppercase tracking-widest">{s.host_name}</span>
                      <div className="h-1.5 w-1.5 rounded-full bg-border" />
                      <span className="text-[11px] font-black text-brand-600/90 uppercase tracking-[0.15em]">{s.sport}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <div className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Power Status</div>
                      <div className="flex items-center gap-5">
                        <div className="text-xs font-black text-brand-600 flex items-center gap-2 uppercase transition-all group-hover:scale-110"><Sun className="h-4 w-4" /> ON: {s.lights_on}</div>
                        <div className="text-xs font-black text-muted-foreground/40 flex items-center gap-2 uppercase"><Moon className="h-4 w-4" /> OFF: {s.lights_off}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Device Dialog */}
      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border/40 p-0 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="p-8 pb-4">
            <DialogTitle className="text-3xl font-black tracking-tight font-display mb-1 flex items-center gap-2">
              <span className="text-foreground">{editingDevice ? "Edit" : "Register"}</span> <span className="text-brand-600">Device</span>
            </DialogTitle>
          </div>
          <div className="p-8 pt-2 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Device Name</Label>
              <Input value={deviceForm.name} onChange={e => setDeviceForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. North Floodlight 01" className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base focus-visible:ring-brand-600/30" data-testid="device-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Type</Label>
                <Select value={deviceForm.device_type} onValueChange={v => setDeviceForm(p => ({ ...p, device_type: v }))}>
                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="device-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 bg-card">
                    <SelectItem value="floodlight" className="font-bold">Floodlight</SelectItem>
                    <SelectItem value="led_panel" className="font-bold">LED Panel</SelectItem>
                    <SelectItem value="ambient" className="font-bold">Ambient</SelectItem>
                    <SelectItem value="emergency" className="font-bold">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Protocol</Label>
                <Select value={deviceForm.protocol} onValueChange={v => setDeviceForm(p => ({ ...p, protocol: v }))}>
                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="device-protocol-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 bg-card">
                    <SelectItem value="mqtt" className="font-bold">MQTT</SelectItem>
                    <SelectItem value="http" className="font-bold">HTTP</SelectItem>
                    <SelectItem value="zigbee" className="font-bold">Zigbee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">IP Address</Label>
                <Input value={deviceForm.ip_address} onChange={e => setDeviceForm(p => ({ ...p, ip_address: e.target.value }))}
                  placeholder="192.168.1.1" className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base font-mono" data-testid="device-ip-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Power (Watts)</Label>
                <div className="relative">
                  <Input type="number" value={deviceForm.power_watts} onChange={e => setDeviceForm(p => ({ ...p, power_watts: Number(e.target.value) }))}
                    className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="device-watts-input" />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[11px] font-black text-muted-foreground/30">W</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Turf Number</Label>
                <Input type="number" value={deviceForm.turf_number} onChange={e => setDeviceForm(p => ({ ...p, turf_number: Number(e.target.value) }))}
                  className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="device-turf-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Zone Assignment</Label>
                <Select value={deviceForm.zone_id} onValueChange={v => setDeviceForm(p => ({ ...p, zone_id: v }))}>
                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="device-zone-select"><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 bg-card">
                    <SelectItem value="none" className="font-bold opacity-40 italic">No zone</SelectItem>
                    {zones.map(z => <SelectItem key={z.id} value={z.id} className="font-bold">{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full h-16 bg-brand-600 hover:bg-brand-500 text-white font-black text-sm tracking-widest uppercase rounded-2xl shadow-xl shadow-brand-600/20 active:scale-[0.98] transition-all mt-4 border-0" onClick={handleSaveDevice} data-testid="save-device-btn">
              {editingDevice ? "UPDATE DEVICE" : "REGISTER DEVICE"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border/40 p-0 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="p-8 pb-4">
            <DialogTitle className="text-3xl font-black tracking-tight font-display mb-1 flex items-center gap-2">
              <span className="text-foreground">Create</span> <span className="text-brand-600">Zone</span>
            </DialogTitle>
          </div>
          <div className="p-8 pt-2 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Zone Name</Label>
              <Input value={zoneForm.name} onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Turf North" className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="zone-name-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Turf Number</Label>
              <Input type="number" value={zoneForm.turf_number} onChange={e => setZoneForm(p => ({ ...p, turf_number: Number(e.target.value) }))}
                className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="zone-turf-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-muted-foreground/90 uppercase tracking-[0.2em] ml-1">Description</Label>
              <Input value={zoneForm.description} onChange={e => setZoneForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description..." className="h-14 rounded-2xl bg-secondary/20 border-border/40 px-6 font-bold text-base" data-testid="zone-desc-input" />
            </div>
            <Button className="w-full h-16 bg-brand-600 hover:bg-brand-500 text-white font-black text-sm tracking-widest uppercase rounded-2xl shadow-xl shadow-brand-600/20 active:scale-[0.98] transition-all mt-4 border-0" onClick={handleSaveZone} data-testid="save-zone-btn">
              CREATE ZONE
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
