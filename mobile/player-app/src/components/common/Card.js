import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Spacing from '../../styles/spacing';

export default function Card({ children, style, padding = true, variant = 'default' }) {
  return (
    <View style={[styles.card, padding && styles.padding, variant === 'elevated' && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padding: {
    padding: Spacing.base,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderColor: 'rgba(255,255,255,0.04)',
  },
});
