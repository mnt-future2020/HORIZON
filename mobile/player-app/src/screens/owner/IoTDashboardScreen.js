import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useAuth } from '../../contexts/AuthContext';
import { venueAPI, iotAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import TabBar from '../../components/common/TabBar';
import FilterChips from '../../components/common/FilterChips';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'devices', label: 'Devices' },
  { key: 'zones', label: 'Zones' },
  { key: 'energy', label: 'Energy' },
];

const ENERGY_PERIODS = ['Today', 'Week', 'Month'];

function DeviceCard({ device, onToggle, onBrightnessChange }) {
  const isOnline = device.status === 'online';
  const isOn = device.is_on !== false && isOnline;

  return (
    <Card style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>{device.name}</Text>
          <Badge variant={isOnline ? 'default' : 'destructive'} style={{ marginTop: Spacing.xs }}>
            {device.status || 'offline'}
          </Badge>
        </View>
        <Switch
          value={isOn}
          onValueChange={() => onToggle(device.id, isOn ? 'off' : 'on')}
          trackColor={{ false: Colors.secondary, true: Colors.primaryLight }}
          thumbColor={isOn ? Colors.primary : Colors.mutedForeground}
          disabled={!isOnline}
        />
      </View>

      {/* Brightness */}
      <View style={styles.brightnessSection}>
        <View style={styles.brightnessLabelRow}>
          <Text style={styles.brightnessLabel}>Brightness</Text>
          <Text style={styles.brightnessValue}>{device.brightness ?? 0}%</Text>
        </View>
        <View style={styles.brightnessBarBg}>
          <View style={[styles.brightnessBarFill, { width: `${device.brightness ?? 0}%` }]} />
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={device.brightness ?? 0}
          onSlidingComplete={(val) => onBrightnessChange(device.id, Math.round(val))}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.secondary}
          thumbTintColor={Colors.primary}
          disabled={!isOnline}
        />
      </View>

      {device.zone_name && (
        <Text style={styles.deviceZone}>Zone: {device.zone_name}</Text>
      )}
      {device.mqtt_topic && (
        <Text style={styles.deviceTopic}>Topic: {device.mqtt_topic}</Text>
      )}
    </Card>
  );
}

function ZoneCard({ zone, onToggle, onBrightnessChange }) {
  const isOn = zone.is_on !== false;

  return (
    <Card style={styles.zoneCard}>
      <View style={styles.zoneHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.zoneName}>{zone.name}</Text>
          <Text style={styles.zoneDeviceCount}>
            {zone.device_count || 0} device{(zone.device_count || 0) !== 1 ? 's' : ''}
          </Text>
        </View>
        <Switch
          value={isOn}
          onValueChange={() => onToggle(zone.id, isOn ? 'off' : 'on')}
          trackColor={{ false: Colors.secondary, true: Colors.primaryLight }}
          thumbColor={isOn ? Colors.primary : Colors.mutedForeground}
        />
      </View>
      <View style={styles.brightnessSection}>
        <View style={styles.brightnessLabelRow}>
          <Text style={styles.brightnessLabel}>Zone Brightness</Text>
          <Text style={styles.brightnessValue}>{zone.brightness ?? 0}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={zone.brightness ?? 0}
          onSlidingComplete={(val) => onBrightnessChange(zone.id, Math.round(val))}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.secondary}
          thumbTintColor={Colors.primary}
        />
      </View>
      {zone.description ? (
        <Text style={styles.zoneDesc}>{zone.description}</Text>
      ) : null}
    </Card>
  );
}

function EnergyStatCard({ label, value, textIcon, bg, valueColor }) {
  return (
    <Card style={styles.energyStatCard}>
      <View style={[styles.energyStatIcon, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 14 }}>{textIcon}</Text>
      </View>
      <Text style={[styles.energyStatValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.energyStatLabel}>{label}</Text>
    </Card>
  );
}

export default function IoTDashboardScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('devices');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Venue
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);

  // Devices
  const [devices, setDevices] = useState([]);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ name: '', mqtt_topic: '', zone_id: '' });
  const [deviceSaving, setDeviceSaving] = useState(false);

  // Zones
  const [zones, setZones] = useState([]);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', description: '' });
  const [zoneSaving, setZoneSaving] = useState(false);

  // Energy
  const [energyPeriod, setEnergyPeriod] = useState('Today');
  const [energyData, setEnergyData] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  const loadVenues = async () => {
    try {
      const res = await venueAPI.getOwnerVenues();
      const v = res.data || [];
      setVenues(v);
      if (v.length > 0 && !selectedVenueId) {
        setSelectedVenueId(v[0].id);
      }
    } catch {
      setVenues([]);
    }
  };

  const loadDevices = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const res = await iotAPI.listDevices(selectedVenueId);
      setDevices(res.data || []);
    } catch {
      setDevices([]);
    }
  }, [selectedVenueId]);

  const loadZones = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const res = await iotAPI.listZones(selectedVenueId);
      setZones(res.data || []);
    } catch {
      setZones([]);
    }
  }, [selectedVenueId]);

  const loadEnergy = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const periodMap = { 'Today': 'day', 'Week': 'week', 'Month': 'month' };
      const res = await iotAPI.energy(selectedVenueId, periodMap[energyPeriod] || 'day');
      setEnergyData(res.data);
    } catch {
      setEnergyData(null);
    }
  }, [selectedVenueId, energyPeriod]);

  const loadData = async () => {
    try {
      await loadVenues();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedVenueId) {
      loadDevices();
      loadZones();
      loadEnergy();
    }
  }, [selectedVenueId, loadDevices, loadZones, loadEnergy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData().then(() => {
      loadDevices();
      loadZones();
      loadEnergy();
    });
  };

  // Device controls
  const handleDeviceToggle = async (deviceId, action) => {
    try {
      await iotAPI.controlDevice(deviceId, { action });
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, is_on: action === 'on' } : d
      ));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to control device');
    }
  };

  const handleDeviceBrightness = async (deviceId, brightness) => {
    try {
      await iotAPI.controlDevice(deviceId, { action: 'on', brightness });
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, brightness, is_on: true } : d
      ));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to set brightness');
    }
  };

  const handleAddDevice = async () => {
    if (!deviceForm.name) {
      Alert.alert('Validation', 'Device name is required.');
      return;
    }
    setDeviceSaving(true);
    try {
      await iotAPI.createDevice({
        venue_id: selectedVenueId,
        name: deviceForm.name,
        mqtt_topic: deviceForm.mqtt_topic || undefined,
        zone_id: deviceForm.zone_id || undefined,
      });
      setDeviceModalVisible(false);
      setDeviceForm({ name: '', mqtt_topic: '', zone_id: '' });
      loadDevices();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add device');
    } finally {
      setDeviceSaving(false);
    }
  };

  // Zone controls
  const handleZoneToggle = async (zoneId, action) => {
    try {
      await iotAPI.controlZone(zoneId, { action });
      setZones(prev => prev.map(z =>
        z.id === zoneId ? { ...z, is_on: action === 'on' } : z
      ));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to control zone');
    }
  };

  const handleZoneBrightness = async (zoneId, brightness) => {
    try {
      await iotAPI.controlZone(zoneId, { action: 'on', brightness });
      setZones(prev => prev.map(z =>
        z.id === zoneId ? { ...z, brightness, is_on: true } : z
      ));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to set zone brightness');
    }
  };

  const handleAddZone = async () => {
    if (!zoneForm.name) {
      Alert.alert('Validation', 'Zone name is required.');
      return;
    }
    setZoneSaving(true);
    try {
      await iotAPI.createZone({
        venue_id: selectedVenueId,
        name: zoneForm.name,
        description: zoneForm.description || undefined,
      });
      setZoneModalVisible(false);
      setZoneForm({ name: '', description: '' });
      loadZones();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create zone');
    } finally {
      setZoneSaving(false);
    }
  };

  // Sync bookings
  const handleSyncBookings = async () => {
    if (!selectedVenueId) return;
    setSyncing(true);
    try {
      await iotAPI.syncBookings(selectedVenueId);
      Alert.alert('Synced', 'Lighting schedules have been synced with bookings.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to sync bookings');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderDevices = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Devices ({devices.length})</Text>
        <Button size="sm" onPress={() => setDeviceModalVisible(true)}>Add Device</Button>
      </View>
      {devices.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCA1'} title="No devices" subtitle="Add IoT lighting devices to manage them remotely." actionLabel="Add Device" onAction={() => setDeviceModalVisible(true)} />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {devices.map((d, i) => (
            <DeviceCard
              key={d.id || i}
              device={d}
              onToggle={handleDeviceToggle}
              onBrightnessChange={handleDeviceBrightness}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderZones = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Zones ({zones.length})</Text>
        <Button size="sm" onPress={() => setZoneModalVisible(true)}>Create Zone</Button>
      </View>
      {zones.length === 0 ? (
        <EmptyState icon={'\uD83C\uDFDF\uFE0F'} title="No zones" subtitle="Create lighting zones to control groups of devices." actionLabel="Create Zone" onAction={() => setZoneModalVisible(true)} />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {zones.map((z, i) => (
            <ZoneCard
              key={z.id || i}
              zone={z}
              onToggle={handleZoneToggle}
              onBrightnessChange={handleZoneBrightness}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderEnergy = () => (
    <View>
      {/* Period Filter */}
      <FilterChips
        items={ENERGY_PERIODS}
        selected={energyPeriod}
        onSelect={(p) => setEnergyPeriod(p)}
        style={{ marginBottom: Spacing.md }}
      />

      {/* Stats */}
      <View style={styles.energyStatsGrid}>
        <EnergyStatCard
          label="TOTAL KWH"
          value={energyData?.total_kwh != null ? `${energyData.total_kwh.toFixed(1)}` : '0'}
          textIcon={'\u26A1'}
          bg={Colors.primaryLight}
          valueColor={Colors.primary}
        />
        <EnergyStatCard
          label="EST. COST"
          value={`\u20B9${(energyData?.estimated_cost || 0).toLocaleString('en-IN')}`}
          textIcon={'\uD83D\uDCB0'}
          bg={Colors.amberLight}
          valueColor={Colors.amber}
        />
        <EnergyStatCard
          label="ACTIVE HRS"
          value={energyData?.active_hours != null ? `${energyData.active_hours.toFixed(1)}` : '0'}
          textIcon={'\u23F0'}
          bg={Colors.skyLight}
          valueColor={Colors.sky}
        />
        <EnergyStatCard
          label="DEVICES ON"
          value={energyData?.devices_online || devices.filter(d => d.status === 'online').length}
          textIcon={'\uD83D\uDCA1'}
          bg={Colors.violetLight}
          valueColor={Colors.violet}
        />
      </View>

      {/* Zone breakdown */}
      <Text style={styles.sectionTitle}>Energy by Zone</Text>
      {energyData?.zone_breakdown && energyData.zone_breakdown.length > 0 ? (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {energyData.zone_breakdown.map((zb, i) => (
            <Card key={i} style={styles.zoneBreakdownCard}>
              <View style={styles.zoneBreakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneBreakdownName}>{zb.zone_name || `Zone ${i + 1}`}</Text>
                  <Text style={styles.zoneBreakdownMeta}>{zb.kwh?.toFixed(1) || 0} kWh</Text>
                </View>
                <Text style={styles.zoneBreakdownCost}>{'\u20B9'}{(zb.cost || 0).toLocaleString('en-IN')}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={'\uD83D\uDCCA'} title="No energy data" subtitle="Energy usage will appear once devices are active." />
      )}

      {/* Sync Bookings */}
      <Button
        variant="secondary"
        onPress={handleSyncBookings}
        loading={syncing}
        style={{ marginTop: Spacing.xl }}
      >
        Sync Bookings to Schedules
      </Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>SMART LIGHTING</Text>
          <Text style={styles.headerTitle}>IoT Dashboard</Text>
        </View>

        {/* Venue Selector */}
        {venues.length > 1 && (
          <TouchableOpacity
            style={styles.venuePicker}
            onPress={() => setVenuePickerOpen(true)}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.venuePickerLabel}>VENUE</Text>
              <Text style={styles.venuePickerValue} numberOfLines={1}>
                {selectedVenue?.name || 'Select venue'}
              </Text>
            </View>
            <Text style={styles.venuePickerArrow}>{'\u25BC'}</Text>
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'devices' && renderDevices()}
          {activeTab === 'zones' && renderZones()}
          {activeTab === 'energy' && renderEnergy()}
        </View>
      </ScrollView>

      {/* Venue Picker Modal */}
      <ModalSheet visible={venuePickerOpen} onClose={() => setVenuePickerOpen(false)} title="Select Venue">
        {venues.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.venueOption, selectedVenueId === v.id && styles.venueOptionActive]}
            onPress={() => { setSelectedVenueId(v.id); setVenuePickerOpen(false); }}
          >
            <Text style={styles.venueOptionName}>{v.name}</Text>
            {selectedVenueId === v.id && <Text style={{ color: Colors.primary, fontSize: 18 }}>{'\u2713'}</Text>}
          </TouchableOpacity>
        ))}
      </ModalSheet>

      {/* Add Device Modal */}
      <ModalSheet visible={deviceModalVisible} onClose={() => setDeviceModalVisible(false)} title="Add Device">
        <Input
          label="Device Name"
          value={deviceForm.name}
          onChangeText={(v) => setDeviceForm(prev => ({ ...prev, name: v }))}
          placeholder="e.g. Court 1 - Main Light"
        />
        <Input
          label="MQTT Topic (optional)"
          value={deviceForm.mqtt_topic}
          onChangeText={(v) => setDeviceForm(prev => ({ ...prev, mqtt_topic: v }))}
          placeholder="e.g. venue/court1/light"
        />
        {zones.length > 0 && (
          <View>
            <Text style={styles.formLabel}>Assign to Zone</Text>
            <View style={styles.zoneSelectRow}>
              <TouchableOpacity
                style={[styles.zoneSelectBtn, !deviceForm.zone_id && styles.zoneSelectBtnActive]}
                onPress={() => setDeviceForm(prev => ({ ...prev, zone_id: '' }))}
              >
                <Text style={[styles.zoneSelectText, !deviceForm.zone_id && styles.zoneSelectTextActive]}>None</Text>
              </TouchableOpacity>
              {zones.map(z => (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.zoneSelectBtn, deviceForm.zone_id === z.id && styles.zoneSelectBtnActive]}
                  onPress={() => setDeviceForm(prev => ({ ...prev, zone_id: z.id }))}
                >
                  <Text style={[styles.zoneSelectText, deviceForm.zone_id === z.id && styles.zoneSelectTextActive]}>
                    {z.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <Button onPress={handleAddDevice} loading={deviceSaving} style={{ marginTop: Spacing.md }}>
          Add Device
        </Button>
      </ModalSheet>

      {/* Create Zone Modal */}
      <ModalSheet visible={zoneModalVisible} onClose={() => setZoneModalVisible(false)} title="Create Zone">
        <Input
          label="Zone Name"
          value={zoneForm.name}
          onChangeText={(v) => setZoneForm(prev => ({ ...prev, name: v }))}
          placeholder="e.g. Court Area A"
        />
        <Input
          label="Description (optional)"
          value={zoneForm.description}
          onChangeText={(v) => setZoneForm(prev => ({ ...prev, description: v }))}
          placeholder="Optional description"
          multiline
        />
        <Button onPress={handleAddZone} loading={zoneSaving} style={{ marginTop: Spacing.md }}>
          Create Zone
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl * 3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { marginTop: Spacing.base, marginBottom: Spacing.lg },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },

  // Venue picker
  venuePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  venuePickerLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  venuePickerValue: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: 2 },
  venuePickerArrow: { fontSize: 12, color: Colors.mutedForeground, marginLeft: Spacing.sm },

  venueOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  venueOptionActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl, borderRadius: Spacing.radiusMd },
  venueOptionName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  tabContent: { marginTop: Spacing.sm },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  // Device
  deviceCard: { padding: Spacing.md },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  deviceName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  deviceZone: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.sky, marginTop: Spacing.sm },
  deviceTopic: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  brightnessSection: { marginBottom: Spacing.xs },
  brightnessLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  brightnessLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  brightnessValue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  brightnessBarBg: { height: 4, backgroundColor: Colors.secondary, borderRadius: 2, marginBottom: Spacing.xs },
  brightnessBarFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  slider: { width: '100%', height: 30 },

  // Zone
  zoneCard: { padding: Spacing.md },
  zoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  zoneName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  zoneDeviceCount: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  zoneDesc: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: Spacing.sm },

  // Energy
  energyStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  energyStatCard: { width: '47.5%', padding: Spacing.md },
  energyStatIcon: { width: 36, height: 36, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  energyStatValue: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  energyStatLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  zoneBreakdownCard: { padding: Spacing.md },
  zoneBreakdownRow: { flexDirection: 'row', alignItems: 'center' },
  zoneBreakdownName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  zoneBreakdownMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  zoneBreakdownCost: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.amber },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  zoneSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  zoneSelectBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  zoneSelectBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  zoneSelectText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  zoneSelectTextActive: { color: Colors.primary },
});
