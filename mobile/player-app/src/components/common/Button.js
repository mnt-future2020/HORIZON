import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
}) {
  const styles = getStyles(variant, size, disabled);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, style]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? Colors.primaryForeground : Colors.primary} />
      ) : (
        <View style={styles.inner}>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text style={[styles.text, textStyle]}>{children}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getStyles(variant, size, disabled) {
  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const px = size === 'sm' ? Spacing.md : size === 'lg' ? Spacing.xl : Spacing.base;
  const fontSize = size === 'sm' ? Typography.sm : size === 'lg' ? Typography.md : Typography.base;

  const bg = {
    primary: Colors.primary,
    secondary: Colors.secondary,
    ghost: Colors.transparent,
    outline: Colors.transparent,
    destructive: Colors.destructive,
  }[variant] || Colors.primary;

  const textColor = {
    primary: Colors.primaryForeground,
    secondary: Colors.foreground,
    ghost: Colors.foreground,
    outline: Colors.foreground,
    destructive: Colors.white,
  }[variant] || Colors.primaryForeground;

  const borderColor = variant === 'outline' ? Colors.border : Colors.transparent;

  return StyleSheet.create({
    button: {
      backgroundColor: disabled ? Colors.muted : bg,
      borderRadius: Spacing.radiusMd,
      height,
      paddingHorizontal: px,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: variant === 'outline' ? 1 : 0,
      borderColor,
      opacity: disabled ? 0.5 : 1,
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      color: disabled ? Colors.mutedForeground : textColor,
      fontSize,
      fontFamily: Typography.fontBodyBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  });
}
