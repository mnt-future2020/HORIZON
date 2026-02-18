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
};

export default function Badge({ children, variant = 'default', style }) {
  const v = variantMap[variant] || variantMap.default;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderWidth: v.border ? 1 : 0, borderColor: v.border || Colors.transparent }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
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
