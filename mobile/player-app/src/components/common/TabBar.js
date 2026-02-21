import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function TabBar({ tabs, activeTab, onTabChange, style }) {
  return (
    <View style={[styles.tabBar, style]}>
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        const active = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onTabChange(key)}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Spacing.radiusSm,
  },
  tabActive: {
    backgroundColor: Colors.card,
  },
  tabText: {
    fontSize: 10,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.foreground,
  },
});
