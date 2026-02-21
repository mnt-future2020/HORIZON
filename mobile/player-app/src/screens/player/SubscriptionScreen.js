import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { subscriptionAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '0',
    color: Colors.mutedForeground,
    bg: Colors.secondary,
    features: [
      'Basic venue booking',
      'Limited matchmaking',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 299,
    priceLabel: '299',
    color: Colors.sky,
    bg: Colors.skyLight,
    features: [
      'Unlimited bookings',
      'Full matchmaking',
      'Analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 799,
    priceLabel: '799',
    color: Colors.amber,
    bg: Colors.amberLight,
    features: [
      'Everything in Basic',
      'Priority support',
      'Advanced analytics',
      'IoT access',
    ],
  },
];

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [dunning, setDunning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [resolvingPayment, setResolvingPayment] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [planRes, dunningRes] = await Promise.all([
        subscriptionAPI.myPlan().catch(() => ({ data: null })),
        subscriptionAPI.dunningStatus().catch(() => ({ data: null })),
      ]);

      const planData = planRes.data?.plan || planRes.data || {};
      setCurrentPlan(planData);

      const dunningData = dunningRes.data;
      if (dunningData && (dunningData.has_issue || dunningData.retry_count > 0)) {
        setDunning(dunningData);
      } else {
        setDunning(null);
      }
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getCurrentPlanId = () => {
    if (!currentPlan) return 'free';
    const name = (currentPlan.name || currentPlan.plan || currentPlan.plan_id || 'free').toLowerCase();
    if (name.includes('pro')) return 'pro';
    if (name.includes('basic')) return 'basic';
    return 'free';
  };

  const handleUpgrade = async (planId) => {
    const plan = PLANS.find(p => p.id === planId);
    Alert.alert(
      'Upgrade Plan',
      `Upgrade to ${plan.name} for \u20B9${plan.priceLabel}/mo?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            setUpgrading(planId);
            try {
              await subscriptionAPI.upgrade({ plan_id: planId });
              Alert.alert('Success', `You are now on the ${plan.name} plan!`);
              loadData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to upgrade plan.');
            } finally {
              setUpgrading(null);
            }
          },
        },
      ]
    );
  };

  const handleResolvePayment = async () => {
    setResolvingPayment(true);
    try {
      await subscriptionAPI.resolvePayment();
      Alert.alert('Payment Resolved', 'Your payment issue has been resolved successfully.');
      setDunning(null);
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to resolve payment. Please try again or contact support.');
    } finally {
      setResolvingPayment(false);
    }
  };

  const currentPlanId = getCurrentPlanId();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Subscription</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Current Plan Card */}
        <Card style={styles.currentPlanCard}>
          <Text style={styles.currentPlanLabel}>CURRENT PLAN</Text>
          <View style={styles.currentPlanRow}>
            <Text style={styles.currentPlanName}>
              {PLANS.find(p => p.id === currentPlanId)?.name || 'Free'}
            </Text>
            <Badge variant={currentPlanId === 'pro' ? 'amber' : currentPlanId === 'basic' ? 'sky' : 'secondary'}>
              Active
            </Badge>
          </View>
          {currentPlan?.features && Array.isArray(currentPlan.features) ? (
            <View style={styles.featuresList}>
              {currentPlan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.featuresList}>
              {(PLANS.find(p => p.id === currentPlanId)?.features || []).map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.currentPlanPrice}>
            {currentPlanId === 'free' ? 'Free' : `\u20B9${PLANS.find(p => p.id === currentPlanId)?.priceLabel}/mo`}
          </Text>
        </Card>

        {/* Dunning Section */}
        {dunning && (
          <Card style={styles.dunningCard}>
            <View style={styles.dunningHeader}>
              <Text style={styles.dunningIcon}>⚠️</Text>
              <Text style={styles.dunningTitle}>Payment Issue</Text>
            </View>
            <Text style={styles.dunningDesc}>
              There is an issue with your payment method. Please resolve it to continue enjoying your subscription.
            </Text>
            <View style={styles.dunningDetails}>
              <View style={styles.dunningDetailRow}>
                <Text style={styles.dunningDetailLabel}>Retry Attempts</Text>
                <Text style={styles.dunningDetailValue}>{dunning.retry_count || 0}</Text>
              </View>
              {dunning.grace_period_remaining != null && (
                <View style={styles.dunningDetailRow}>
                  <Text style={styles.dunningDetailLabel}>Grace Period</Text>
                  <Text style={[styles.dunningDetailValue, { color: Colors.amber }]}>
                    {dunning.grace_period_remaining} days remaining
                  </Text>
                </View>
              )}
              {dunning.grace_period_end && (
                <View style={styles.dunningDetailRow}>
                  <Text style={styles.dunningDetailLabel}>Grace Period Ends</Text>
                  <Text style={[styles.dunningDetailValue, { color: Colors.destructive }]}>
                    {new Date(dunning.grace_period_end).toLocaleDateString('en-IN')}
                  </Text>
                </View>
              )}
            </View>
            <Button
              variant="primary"
              onPress={handleResolvePayment}
              loading={resolvingPayment}
              style={{ marginTop: Spacing.md }}
            >
              Resolve Payment
            </Button>
          </Card>
        )}

        {/* Plan Cards */}
        <Text style={styles.sectionTitle}>Available Plans</Text>

        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlanId);

          return (
            <Card
              key={plan.id}
              style={[
                styles.planCard,
                isCurrent && { borderColor: plan.color, borderWidth: 2 },
              ]}
            >
              <View style={styles.planHeader}>
                <View style={[styles.planIconBox, { backgroundColor: plan.bg }]}>
                  <Text style={[styles.planIcon, { color: plan.color }]}>
                    {plan.id === 'free' ? '🆓' : plan.id === 'basic' ? '⚡' : '👑'}
                  </Text>
                </View>
                <View style={styles.planHeaderInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={[styles.planPrice, { color: plan.color }]}>
                    {plan.price === 0 ? 'Free' : `\u20B9${plan.priceLabel}`}
                    {plan.price > 0 && <Text style={styles.planPricePeriod}>/mo</Text>}
                  </Text>
                </View>
                {isCurrent && (
                  <Badge variant={plan.id === 'pro' ? 'amber' : plan.id === 'basic' ? 'sky' : 'secondary'}>
                    Current
                  </Badge>
                )}
              </View>

              <View style={styles.planFeatures}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.planFeatureRow}>
                    <Text style={[styles.planFeatureCheck, { color: plan.color }]}>✓</Text>
                    <Text style={styles.planFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {!isCurrent && !isDowngrade && (
                <Button
                  variant="primary"
                  onPress={() => handleUpgrade(plan.id)}
                  loading={upgrading === plan.id}
                  style={{ marginTop: Spacing.md }}
                >
                  Upgrade to {plan.name}
                </Button>
              )}
            </Card>
          );
        })}

        <View style={{ height: Spacing.xl3 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  currentPlanCard: { marginBottom: Spacing.xl, borderColor: Colors.primary, borderWidth: 1 },
  currentPlanLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm },
  currentPlanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  currentPlanName: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  currentPlanPrice: { fontSize: Typography.lg, fontFamily: Typography.fontBodyBold, color: Colors.primary, marginTop: Spacing.sm },
  featuresList: { gap: Spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  featureCheck: { fontSize: Typography.sm, color: Colors.primary },
  featureText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.foreground },

  dunningCard: { marginBottom: Spacing.xl, borderColor: Colors.amber, borderWidth: 1 },
  dunningHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  dunningIcon: { fontSize: 20 },
  dunningTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.amber },
  dunningDesc: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 20, marginBottom: Spacing.md },
  dunningDetails: { gap: Spacing.sm },
  dunningDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dunningDetailLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  dunningDetailValue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },

  planCard: { marginBottom: Spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  planIconBox: { width: 44, height: 44, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center' },
  planIcon: { fontSize: 20 },
  planHeaderInfo: { flex: 1 },
  planName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  planPrice: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack },
  planPricePeriod: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  planFeatures: { marginTop: Spacing.md, gap: Spacing.xs },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planFeatureCheck: { fontSize: Typography.sm },
  planFeatureText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
});
