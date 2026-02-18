import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Spacing from '../../styles/spacing';

export default function Card({ children, style, padding = true }) {
  return (
    <View style={[styles.card, padding && styles.padding, style]}>
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
});
