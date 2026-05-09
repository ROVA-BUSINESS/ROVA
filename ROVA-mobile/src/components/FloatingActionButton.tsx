import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, font } from '../lib/theme';

export default function FloatingActionButton() {
  const [expanded, setExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const translateY = (index: number) =>
    animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -index * 60 - 20],
    });

  const ActionButton = ({ icon, label, index }: { icon: keyof typeof Ionicons.glyphMap; label: string; index: number }) => (
    <Animated.View style={[styles.actionItem, { transform: [{ translateY: translateY(index) }], opacity: animation }]}>
      <Text style={styles.actionLabel}>{label}</Text>
      <TouchableOpacity style={styles.miniFab}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Menu Items */}
      <ActionButton icon="document-text" label="Create Invoice" index={3} />
      <ActionButton icon="camera" label="Snap Receipt" index={2} />
      <ActionButton icon="cash" label="Add Expense" index={1} />

      {/* Main FAB */}
      <TouchableOpacity activeOpacity={0.8} onPress={toggleMenu}>
        <Animated.View style={[styles.fab, { transform: [{ rotate: rotation }] }]}>
          <Ionicons name="add" size={32} color={colors.white} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 45, // Elevated above bottom tabs
    alignSelf: 'center',
    zIndex: 100,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.card,
  },
  actionItem: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    right: 5,
  },
  actionLabel: {
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
    fontSize: font.sm,
    fontWeight: '500',
    ...shadow.soft,
  },
  miniFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.soft,
  },
});
