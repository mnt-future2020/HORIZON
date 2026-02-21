import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { notificationAPI } from '../../api';
import FilterChips from '../../components/common/FilterChips';
import EmptyState from '../../components/common/EmptyState';
import Card from '../../components/common/Card';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'booking', label: 'Bookings' },
  { key: 'social', label: 'Social' },
  { key: 'system', label: 'System' },
];

function getNotificationIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('booking') || t.includes('book')) return '📅';
  if (t.includes('social') || t.includes('follow') || t.includes('like') || t.includes('comment')) return '👤';
  if (t.includes('venue')) return '🏟️';
  if (t.includes('match') || t.includes('game')) return '⚔️';
  return '🔔';
}

function getNotificationType(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('booking') || t.includes('book')) return 'booking';
  if (t.includes('social') || t.includes('follow') || t.includes('like') || t.includes('comment')) return 'social';
  if (t.includes('venue')) return 'venue';
  if (t.includes('match') || t.includes('game')) return 'match';
  return 'system';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.list();
      const data = res.data;
      const items = Array.isArray(data) ? data : data?.notifications || [];
      setNotifications(items);
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'unread') return notifications.filter(n => !n.read && !n.is_read);
    return notifications.filter(n => getNotificationType(n.type) === activeFilter);
  }, [notifications, activeFilter]);

  const handleTap = async (notification) => {
    // Mark as read
    if (!notification.read && !notification.is_read) {
      try {
        await notificationAPI.markRead(notification.id);
        setNotifications(prev => prev.map(n =>
          n.id === notification.id ? { ...n, read: true, is_read: true } : n
        ));
      } catch (err) {
        // Silently fail
      }
    }

    // Navigate based on type
    const type = getNotificationType(notification.type);
    if (type === 'booking') {
      navigation.navigate('Bookings');
    } else if (type === 'social') {
      if (notification.related_id || notification.user_id) {
        navigation.navigate('PlayerCard', { userId: notification.related_id || notification.user_id });
      }
    } else if (type === 'venue') {
      if (notification.related_id || notification.venue_id) {
        navigation.navigate('VenueDetail', { venueId: notification.related_id || notification.venue_id });
      }
    } else if (type === 'match') {
      navigation.navigate('Matchmaking');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true, is_read: true })));
    } catch (err) {
      // Silently fail
    }
  };

  const unreadCount = notifications.filter(n => !n.read && !n.is_read).length;

  const getEmptyMessage = () => {
    if (activeFilter === 'unread') return { title: 'All caught up!', subtitle: 'No unread notifications' };
    if (activeFilter === 'booking') return { title: 'No booking notifications', subtitle: 'Booking updates will appear here' };
    if (activeFilter === 'social') return { title: 'No social notifications', subtitle: 'Social activity will appear here' };
    if (activeFilter === 'system') return { title: 'No system notifications', subtitle: 'System alerts will appear here' };
    return { title: 'No notifications yet', subtitle: 'You\'ll see notifications here as you use Horizon' };
  };

  const renderNotification = ({ item }) => {
    const isUnread = !item.read && !item.is_read;
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        activeOpacity={0.75}
      >
        <Card style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
          <View style={styles.notifRow}>
            <View style={[styles.iconBox, isUnread && styles.iconBoxUnread]}>
              <Text style={styles.iconText}>{icon}</Text>
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                  {item.title || 'Notification'}
                </Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMessage} numberOfLines={2}>
                {item.message || item.body || ''}
              </Text>
              <Text style={styles.notifTime}>
                {timeAgo(item.created_at || item.timestamp)}
              </Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const empty = getEmptyMessage();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Filter Chips */}
      <FilterChips
        items={FILTERS}
        selected={activeFilter}
        onSelect={setActiveFilter}
        style={{ marginBottom: Spacing.md }}
      />

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={empty.title}
          subtitle={empty.subtitle}
          style={{ marginTop: Spacing.xl3 }}
        />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.base,
  },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  markAllBtn: { width: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary },

  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },

  notifCard: { padding: Spacing.md, marginBottom: 0 },
  notifCardUnread: { borderColor: Colors.primary, borderLeftWidth: 3 },
  notifRow: { flexDirection: 'row', gap: Spacing.md },
  iconBox: {
    width: 40, height: 40, borderRadius: Spacing.radiusMd,
    backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  iconBoxUnread: { backgroundColor: Colors.primaryLight },
  iconText: { fontSize: 18 },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  notifTitle: { flex: 1, fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.foreground },
  notifTitleUnread: { fontFamily: Typography.fontBodyBold },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.sm,
  },
  notifMessage: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 16, marginBottom: Spacing.xs },
  notifTime: { fontSize: 10, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
});
