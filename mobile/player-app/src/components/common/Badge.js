import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const variantMap = {
  default: { bg: Colors.primaryLight, text: Colors.primary },
  secondary: { bg: Colors.secondary, text: Colors.mutedForeground },
  destructive: { bg: Colors.destructiveLight, text: Colors.destructive },
  amber: { bg: Colors.amberLight, text: Colors.amber },
  violet: { bg: Colors.violetLight, text: Colors.violet },
  sky: { bg: Colors.skyLight, text: Colors.sky },
  outline: { bg: Colors.transparent, text: Colors.foreground, border: Colors.border },
  // Sport-specific
  sport: { bg: Colors.amberLight, text: Colors.amber, border: Colors.amber },
  // Role-specific variants
  player: { bg: Colors.emeraldLight, text: Colors.emerald, border: Colors.emerald },
  owner: { bg: Colors.violetLight, text: Colors.violet, border: Colors.violet },
  coach: { bg: Colors.amberLight, text: Colors.amber, border: Colors.amber },
  admin: { bg: Colors.roseLight, text: Colors.rose, border: Colors.rose },
  // Status
  live: { bg: Colors.roseLight, text: Colors.rose, border: Colors.rose },
  emerald: { bg: Colors.emeraldLight, text: Colors.emerald },
  rose: { bg: Colors.roseLight, text: Colors.rose },
  indigo: { bg: Colors.indigoLight, text: Colors.indigo },
};

export default function Badge({ children, variant = 'default', style }) {
  const v = variantMap[variant] || variantMap.default;
  return (
    <View style={[
      styles.badge,
      { backgroundColor: v.bg },
      v.border ? { borderWidth: 1, borderColor: v.border } : null,
      style,
    ]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Spacing.radiusFull,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
