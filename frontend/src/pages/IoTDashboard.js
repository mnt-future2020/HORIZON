import { useState, useEffect, useCallback } from "react";
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
  Activity, DollarSign, TrendingDown, Loader2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const TYPE_LABELS = { floodlight: "Floodlight", led_panel: "LED Panel", ambient: "Ambient", emergency: "Emergency" };
const TYPE_COLORS = {
  floodlight: "text-amber-400 bg-amber-500/15",
  led_panel: "text-sky-400 bg-sky-500/15",
  ambient: "text-violet-400 bg-violet-500/15",
  emergency: "text-red-400 bg-red-500/15",
};

function DeviceCard({ device, onControl, onEdit, onDelete }) {
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
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl p-4 border-l-4 transition-all ${
        !isOnline ? "border-l-muted-foreground/30 opacity-50" :
        isOn ? "border-l-amber-400" : "border-l-muted-foreground/50"
      }`} data-testid={`device-card-${device.id}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isOn ? "bg-amber-500/20" : "bg-secondary/50"}`}>
            <Lightbulb className={`h-4 w-4 ${isOn ? "text-amber-400" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{device.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge className={`text-[9px] ${typeColor} border-0 px-1.5 py-0`}>{TYPE_LABELS[device.device_type]}</Badge>
              {isOnline ? (
                <span className="flex items-center gap-0.5 text-[9px] text-emerald-400"><Wifi className="h-2.5 w-2.5" />Online</span>
              ) : (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><WifiOff className="h-2.5 w-2.5" />Offline</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(device)} data-testid={`edit-device-${device.id}`}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(device.id)} data-testid={`delete-device-${device.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Switch checked={isOn} onCheckedChange={handleToggle} disabled={!isOnline}
            data-testid={`toggle-device-${device.id}`} />
          <span className="text-xs text-muted-foreground">{device.power_watts}W</span>
        </div>
        {isOn && isOnline && (
          <div className="flex items-center gap-2 w-28">
            <Sun className="h-3 w-3 text-muted-foreground shrink-0" />
            <Slider value={[brightness]} min={1} max={100} step={5}
              onValueCommit={handleBrightness} className="flex-1"
              data-testid={`brightness-${device.id}`} />
            <span className="text-[10px] text-muted-foreground w-7 text-right">{brightness}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span>{device.protocol?.toUpperCase()}</span>
        {device.ip_address && <span>{device.ip_address}</span>}
        {device.auto_schedule && <span className="text-primary flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />Auto</span>}
      </div>
    </motion.div>
  );
}

function ZoneCard({ zone, onControl, onEdit, onDelete }) {
  return (
    <div className="glass-card rounded-xl p-4" data-testid={`zone-card-${zone.id}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h4 className="font-bold text-sm">{zone.name}</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {zone.turf_number ? `Turf ${zone.turf_number}` : "Common"} &bull; {zone.device_count || 0} devices
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold"
            onClick={() => onControl(zone.id, { action: "on" })} data-testid={`zone-on-${zone.id}`}>
            <Power className="h-3 w-3 mr-1 text-emerald-400" /> All On
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold"
            onClick={() => onControl(zone.id, { action: "off" })} data-testid={`zone-off-${zone.id}`}>
            <Moon className="h-3 w-3 mr-1" /> All Off
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(zone.id)} data-testid={`delete-zone-${zone.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {zone.description && <p className="text-xs text-muted-foreground">{zone.description}</p>}
    </div>
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
  const [deviceForm, setDeviceForm] = useState({
    name: "", device_type: "floodlight", protocol: "mqtt", ip_address: "",
    power_watts: 500, turf_number: 1, zone_id: "",
  });
  const [zoneForm, setZoneForm] = useState({ name: "", turf_number: 1, description: "" });

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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">IoT Control</span>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Smart <span className="text-primary">Lighting</span>
          </h1>
        </div>
        <Button size="sm" variant="outline" className="font-bold text-xs h-8 shrink-0"
          onClick={handleSync} data-testid="sync-btn">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Bookings
        </Button>
      </div>

      {/* Venue selector */}
      {venues.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2 -mx-1 px-1">
          {venues.map(v => (
            <Button key={v.id} size="sm" variant={selectedVenue?.id === v.id ? "default" : "outline"}
              onClick={() => setSelectedVenue(v)} className={`shrink-0 text-xs ${selectedVenue?.id === v.id ? "bg-primary text-primary-foreground" : ""}`}>
              {v.name}
            </Button>
          ))}
        </div>
      )}

      {/* Live stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-card rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-lg sm:text-xl font-display font-black">{onlineCount}<span className="text-xs text-muted-foreground font-normal">/{devices.length}</span></div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground">Online</div>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <div>
              <div className="text-lg sm:text-xl font-display font-black">{activeCount}</div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground">Active</div>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-400" />
            <div>
              <div className="text-lg sm:text-xl font-display font-black">{(totalPower / 1000).toFixed(1)}<span className="text-xs text-muted-foreground font-normal">kW</span></div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground">Draw</div>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg sm:text-xl font-display font-black">{"\u20B9"}{s.avg_daily_cost || 0}</div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground">Avg/Day</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="devices" data-testid="iot-tabs">
        <TabsList className="bg-secondary/50 mb-5 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="devices" className="font-bold text-xs">Devices</TabsTrigger>
          <TabsTrigger value="zones" className="font-bold text-xs" data-testid="tab-zones">Zones</TabsTrigger>
          <TabsTrigger value="energy" className="font-bold text-xs" data-testid="tab-energy">Energy</TabsTrigger>
          <TabsTrigger value="schedule" className="font-bold text-xs" data-testid="tab-schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm sm:text-base">Devices ({devices.length})</h3>
            <Button size="sm" onClick={() => openDeviceDialog()} className="bg-primary text-primary-foreground font-bold text-xs h-8"
              data-testid="add-device-btn"><Plus className="h-3.5 w-3.5 mr-1" /> Add Device</Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Lightbulb className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No devices registered</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {devices.map(d => (
                <DeviceCard key={d.id} device={d} onControl={handleControlDevice}
                  onEdit={openDeviceDialog} onDelete={handleDeleteDevice} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm sm:text-base">Zones ({zones.length})</h3>
            <Button size="sm" onClick={() => setZoneDialogOpen(true)} className="bg-primary text-primary-foreground font-bold text-xs h-8"
              data-testid="add-zone-btn"><Plus className="h-3.5 w-3.5 mr-1" /> Add Zone</Button>
          </div>
          {zones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Layers className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No zones configured</p></div>
          ) : (
            <div className="space-y-3">
              {zones.map(z => (
                <ZoneCard key={z.id} zone={z} onControl={handleControlZone}
                  onEdit={() => {}} onDelete={handleDeleteZone} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Energy Tab */}
        <TabsContent value="energy">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm sm:text-base">Energy Analytics</h3>
            <Select value={period} onValueChange={(v) => setPeriod(v)}>
              <SelectTrigger className="w-24 h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {energy ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-card rounded-lg p-3">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground">Total kWh</div>
                  <div className="text-xl font-display font-black text-primary mt-1">{s.period_kwh}</div>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground">Total Cost</div>
                  <div className="text-xl font-display font-black text-foreground mt-1">{"\u20B9"}{s.period_cost}</div>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground">Avg Daily kWh</div>
                  <div className="text-xl font-display font-black text-sky-400 mt-1">{s.avg_daily_kwh}</div>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground">Avg Daily Cost</div>
                  <div className="text-xl font-display font-black text-amber-400 mt-1">{"\u20B9"}{s.avg_daily_cost}</div>
                </div>
              </div>

              {energy.daily?.length > 0 && (
                <>
                  <div className="glass-card rounded-lg p-4 sm:p-5">
                    <h4 className="font-display font-bold text-sm mb-3">Energy Consumption (kWh)</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={energy.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 9 }} width={35} />
                        <Tooltip contentStyle={{ background: "hsl(222.2, 47.4%, 11.2%)", border: "1px solid hsl(217.2, 32.6%, 17.5%)", borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="kwh" fill="hsl(160, 84%, 39.4%)" fillOpacity={0.15} stroke="hsl(160, 84%, 39.4%)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="glass-card rounded-lg p-4 sm:p-5">
                    <h4 className="font-display font-bold text-sm mb-3">Daily Cost ({"\u20B9"})</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={energy.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fill: "hsl(215, 20.2%, 65.1%)", fontSize: 9 }} width={35} />
                        <Tooltip contentStyle={{ background: "hsl(222.2, 47.4%, 11.2%)", border: "1px solid hsl(217.2, 32.6%, 17.5%)", borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="cost" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><BarChart3 className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No energy data</p></div>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm sm:text-base">Today's Lighting Schedule</h3>
            <Button size="sm" variant="outline" className="text-xs h-8 font-bold" onClick={handleSync} data-testid="sync-schedule-btn">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync
            </Button>
          </div>
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-3" />
              <p className="text-sm">No bookings today</p>
              <p className="text-xs mt-1">Lights will auto-activate when bookings are made</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-lg p-3 flex items-center gap-3" data-testid={`schedule-${i}`}>
                  <div className="shrink-0 w-20 text-center">
                    <div className="text-xs font-mono font-bold text-primary">{s.slot_start}</div>
                    <div className="text-[9px] text-muted-foreground">{s.slot_end}</div>
                  </div>
                  <div className="h-8 w-px bg-border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.zone_name}</div>
                    <div className="text-[10px] text-muted-foreground">{s.host_name} &bull; {s.sport}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] text-emerald-400 flex items-center gap-0.5"><Sun className="h-2.5 w-2.5" />{s.lights_on}</div>
                    <div className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Moon className="h-2.5 w-2.5" />{s.lights_off}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Device Dialog */}
      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingDevice ? "Edit" : "Register"} Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Device Name</Label>
              <Input value={deviceForm.name} onChange={e => setDeviceForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Turf 1 - North Flood" className="mt-1 bg-background border-border" data-testid="device-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={deviceForm.device_type} onValueChange={v => setDeviceForm(p => ({ ...p, device_type: v }))}>
                  <SelectTrigger className="mt-1 bg-background border-border" data-testid="device-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floodlight">Floodlight</SelectItem>
                    <SelectItem value="led_panel">LED Panel</SelectItem>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Protocol</Label>
                <Select value={deviceForm.protocol} onValueChange={v => setDeviceForm(p => ({ ...p, protocol: v }))}>
                  <SelectTrigger className="mt-1 bg-background border-border" data-testid="device-protocol-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="zigbee">Zigbee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">IP Address</Label>
                <Input value={deviceForm.ip_address} onChange={e => setDeviceForm(p => ({ ...p, ip_address: e.target.value }))}
                  placeholder="192.168.1.100" className="mt-1 bg-background border-border" data-testid="device-ip-input" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Power (Watts)</Label>
                <Input type="number" value={deviceForm.power_watts} onChange={e => setDeviceForm(p => ({ ...p, power_watts: Number(e.target.value) }))}
                  className="mt-1 bg-background border-border" data-testid="device-watts-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Turf Number</Label>
                <Input type="number" value={deviceForm.turf_number} onChange={e => setDeviceForm(p => ({ ...p, turf_number: Number(e.target.value) }))}
                  className="mt-1 bg-background border-border" data-testid="device-turf-input" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Zone</Label>
                <Select value={deviceForm.zone_id} onValueChange={v => setDeviceForm(p => ({ ...p, zone_id: v }))}>
                  <SelectTrigger className="mt-1 bg-background border-border" data-testid="device-zone-select"><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No zone</SelectItem>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveDevice} data-testid="save-device-btn">
              {editingDevice ? "Update Device" : "Register Device"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Create Zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Zone Name</Label>
              <Input value={zoneForm.name} onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Turf 3 Main" className="mt-1 bg-background border-border" data-testid="zone-name-input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Turf Number (optional)</Label>
              <Input type="number" value={zoneForm.turf_number} onChange={e => setZoneForm(p => ({ ...p, turf_number: Number(e.target.value) }))}
                className="mt-1 bg-background border-border" data-testid="zone-turf-input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={zoneForm.description} onChange={e => setZoneForm(p => ({ ...p, description: e.target.value }))}
                className="mt-1 bg-background border-border" data-testid="zone-desc-input" />
            </div>
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveZone} data-testid="save-zone-btn">
              Create Zone
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
