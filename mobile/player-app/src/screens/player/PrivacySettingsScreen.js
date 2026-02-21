import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Switch, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { complianceAPI } from '../../api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import TabBar from '../../components/common/TabBar';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'consent', label: 'Consent' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'mydata', label: 'My Data' },
];

function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function ToggleRow({ label, description, value, onValueChange, disabled = false }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={[styles.toggleLabel, disabled && styles.toggleLabelDisabled]}>{label}</Text>
        {description ? <Text style={styles.toggleDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.secondary, true: Colors.primary }}
        thumbColor={value ? Colors.white : Colors.mutedForeground}
        ios_backgroundColor={Colors.secondary}
      />
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('consent');

  // Consent state
  const [consent, setConsent] = useState({
    analytics: false,
    marketing: false,
    location: false,
    essential: true,
  });
  const [consentLoading, setConsentLoading] = useState(true);
  const [consentSaving, setConsentSaving] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    sms: false,
    push: true,
    in_app: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  // My Data state
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Load consent
  const loadConsent = useCallback(async () => {
    setConsentLoading(true);
    try {
      const res = await complianceAPI.getConsent();
      const data = res.data?.consent || res.data || {};
      setConsent({
        analytics: data.analytics ?? false,
        marketing: data.marketing ?? false,
        location: data.location ?? false,
        essential: true,
      });
    } catch (err) {
      // Silently fail
    } finally {
      setConsentLoading(false);
    }
  }, []);

  // Load notification prefs
  const loadNotifPrefs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await complianceAPI.getNotificationPrefs();
      const data = res.data?.preferences || res.data || {};
      setNotifPrefs({
        email: data.email ?? true,
        sms: data.sms ?? false,
        push: data.push ?? true,
        in_app: data.in_app ?? true,
      });
    } catch (err) {
      // Silently fail
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Load audit log
  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await complianceAPI.getAuditLog(20);
      const data = res.data;
      const items = Array.isArray(data) ? data : data?.log || data?.entries || [];
      setAuditLog(items);
    } catch (err) {
      // Silently fail
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'consent') loadConsent();
    else if (activeTab === 'notifications') loadNotifPrefs();
    else if (activeTab === 'mydata') loadAuditLog();
  }, [activeTab, loadConsent, loadNotifPrefs, loadAuditLog]);

  // Save consent
  const handleSaveConsent = async () => {
    setConsentSaving(true);
    try {
      await complianceAPI.updateConsent({
        analytics: consent.analytics,
        marketing: consent.marketing,
        location: consent.location,
      });
      Alert.alert('Saved', 'Your consent preferences have been updated.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save consent preferences.');
    } finally {
      setConsentSaving(false);
    }
  };

  // Save notification prefs
  const handleSaveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      await complianceAPI.updateNotificationPrefs(notifPrefs);
      Alert.alert('Saved', 'Your notification preferences have been updated.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save notification preferences.');
    } finally {
      setNotifSaving(false);
    }
  };

  // Export data
  const handleExportData = async () => {
    setExporting(true);
    try {
      await complianceAPI.exportData();
      Alert.alert('Data Export Requested', 'Your data export has been requested. You will receive an email with a download link once it is ready.');
    } catch (err) {
      Alert.alert('Error', 'Failed to request data export.');
    } finally {
      setExporting(false);
    }
  };

  // Delete account
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. Type "DELETE" below to confirm, then tap Delete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (deleteConfirmText.trim().toUpperCase() === 'DELETE') {
              performDeletion();
            } else {
              Alert.alert('Confirmation Required', 'Please type "DELETE" in the text field to confirm account deletion.');
            }
          },
        },
      ]
    );
  };

  const performDeletion = async () => {
    setDeleting(true);
    try {
      await complianceAPI.requestErasure({ confirm: true });
      Alert.alert('Account Deleted', 'Your account and all associated data will be permanently deleted.', [
        { text: 'OK', onPress: () => logout() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to delete account. Please contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Data</Text>
        <View style={{ width: 60 }} />
      </View>

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Consent Tab */}
      {activeTab === 'consent' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner} showsVerticalScrollIndicator={false}>
          {consentLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <>
              <Card>
                <Text style={styles.cardTitle}>Data Consent</Text>
                <Text style={styles.cardDesc}>
                  Control how your data is used across Horizon.
                </Text>

                <ToggleRow
                  label="Essential"
                  description="Required for the app to function properly"
                  value={true}
                  onValueChange={() => {}}
                  disabled={true}
                />

                <View style={styles.separator} />

                <ToggleRow
                  label="Analytics"
                  description="Help us improve the app with usage data"
                  value={consent.analytics}
                  onValueChange={(val) => setConsent(prev => ({ ...prev, analytics: val }))}
                />

                <View style={styles.separator} />

                <ToggleRow
                  label="Marketing"
                  description="Receive personalized offers and promotions"
                  value={consent.marketing}
                  onValueChange={(val) => setConsent(prev => ({ ...prev, marketing: val }))}
                />

                <View style={styles.separator} />

                <ToggleRow
                  label="Location"
                  description="Enable location-based venue recommendations"
                  value={consent.location}
                  onValueChange={(val) => setConsent(prev => ({ ...prev, location: val }))}
                />

                <Button
                  onPress={handleSaveConsent}
                  loading={consentSaving}
                  style={{ marginTop: Spacing.xl }}
                >
                  Save Preferences
                </Button>
              </Card>
            </>
          )}
        </ScrollView>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner} showsVerticalScrollIndicator={false}>
          {notifLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <Card>
              <Text style={styles.cardTitle}>Notification Preferences</Text>
              <Text style={styles.cardDesc}>
                Choose how you want to receive notifications.
              </Text>

              <ToggleRow
                label="Email"
                description="Receive notifications via email"
                value={notifPrefs.email}
                onValueChange={(val) => setNotifPrefs(prev => ({ ...prev, email: val }))}
              />

              <View style={styles.separator} />

              <ToggleRow
                label="SMS"
                description="Receive notifications via text message"
                value={notifPrefs.sms}
                onValueChange={(val) => setNotifPrefs(prev => ({ ...prev, sms: val }))}
              />

              <View style={styles.separator} />

              <ToggleRow
                label="Push Notifications"
                description="Receive push notifications on your device"
                value={notifPrefs.push}
                onValueChange={(val) => setNotifPrefs(prev => ({ ...prev, push: val }))}
              />

              <View style={styles.separator} />

              <ToggleRow
                label="In-App"
                description="Show notifications inside the app"
                value={notifPrefs.in_app}
                onValueChange={(val) => setNotifPrefs(prev => ({ ...prev, in_app: val }))}
              />

              <Button
                onPress={handleSaveNotifPrefs}
                loading={notifSaving}
                style={{ marginTop: Spacing.xl }}
              >
                Save Preferences
              </Button>
            </Card>
          )}
        </ScrollView>
      )}

      {/* My Data Tab */}
      {activeTab === 'mydata' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner} showsVerticalScrollIndicator={false}>
          {/* Export Data */}
          <Card>
            <Text style={styles.cardTitle}>Export Data</Text>
            <Text style={styles.cardDesc}>
              Download a copy of all your personal data stored on Horizon.
            </Text>
            <Button
              variant="secondary"
              onPress={handleExportData}
              loading={exporting}
              style={{ marginTop: Spacing.sm }}
            >
              Export My Data
            </Button>
          </Card>

          {/* Delete Account */}
          <Card style={styles.deleteCard}>
            <Text style={[styles.cardTitle, { color: Colors.destructive }]}>Delete Account</Text>
            <Text style={styles.cardDesc}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <View style={styles.deleteInputRow}>
              <TextInput
                style={styles.deleteInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder='Type "DELETE" to confirm'
                placeholderTextColor={Colors.mutedForeground}
                autoCapitalize="characters"
              />
            </View>
            <Button
              variant="destructive"
              onPress={handleDeleteAccount}
              loading={deleting}
              disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
              style={{ marginTop: Spacing.md }}
            >
              Delete My Account
            </Button>
          </Card>

          {/* Audit Log */}
          <View style={styles.auditSection}>
            <Text style={styles.sectionTitle}>Audit Log</Text>
            {auditLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : auditLog.length === 0 ? (
              <Card style={styles.auditEmpty}>
                <Text style={styles.auditEmptyText}>No audit log entries</Text>
              </Card>
            ) : (
              <Card padding={false}>
                {auditLog.map((entry, idx) => (
                  <View
                    key={entry.id || idx}
                    style={[styles.auditRow, idx < auditLog.length - 1 && styles.auditRowBorder]}
                  >
                    <View style={styles.auditDot} />
                    <View style={styles.auditContent}>
                      <Text style={styles.auditAction}>
                        {entry.action || entry.event || entry.description || 'Action'}
                      </Text>
                      <Text style={styles.auditTime}>
                        {formatTimestamp(entry.timestamp || entry.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </View>

          <View style={{ height: Spacing.xl3 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
  },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  tabContent: { flex: 1 },
  tabContentInner: { padding: Spacing.base, paddingBottom: Spacing.xl3 },

  centerBox: { paddingVertical: Spacing.xl3, alignItems: 'center' },

  cardTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.xs },
  cardDesc: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginBottom: Spacing.md, lineHeight: 20 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  toggleInfo: { flex: 1, marginRight: Spacing.md },
  toggleLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  toggleLabelDisabled: { color: Colors.mutedForeground },
  toggleDesc: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  separator: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  deleteCard: { marginTop: Spacing.md, borderColor: Colors.destructive },
  deleteInputRow: { marginTop: Spacing.sm },
  deleteInput: {
    backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.foreground, height: 44,
  },

  auditSection: { marginTop: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },

  auditEmpty: { alignItems: 'center', paddingVertical: Spacing.xl },
  auditEmptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },

  auditRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.md },
  auditRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  auditContent: { flex: 1 },
  auditAction: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  auditTime: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
});
