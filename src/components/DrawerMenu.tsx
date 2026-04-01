import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSettings: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  userPicture?: string;
}

const DRAWER_WIDTH = 280;

export default function DrawerMenu({
  visible,
  onClose,
  onNavigate,
  onSettings,
  onLogout,
  userName,
  userEmail,
  userPicture,
}: Props) {
  const colors = useThemeColors();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const isVisible = useRef(false);

  useEffect(() => {
    if (visible) {
      isVisible.current = true;
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    } else if (isVisible.current) {
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
        isVisible.current = false;
      });
    }
  }, [visible]);

  // Don't render anything if never opened
  if (!visible && !isVisible.current) return null;

  const menuItems: { icon: keyof typeof Ionicons.glyphMap; label: string; tab: string }[] = [
    { icon: 'home-outline', label: '總覽', tab: '總覽' },
    { icon: 'body-outline', label: '身體組成', tab: '身體' },
    { icon: 'restaurant-outline', label: '飲食記錄', tab: '飲食' },
    { icon: 'barbell-outline', label: '訓練記錄', tab: '訓練' },
    { icon: 'sparkles-outline', label: 'AI 教練', tab: '教練' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: colors.surface, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* User Info */}
        <View style={[styles.userSection, { backgroundColor: colors.primary }]}>
          {userPicture ? (
            <Image source={{ uri: userPicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={28} color="#fff" />
            </View>
          )}
          <Text style={styles.userName} numberOfLines={1}>
            {userName || '使用者'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {userEmail || ''}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable
              key={item.tab}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: colors.border + '60' },
              ]}
              onPress={() => {
                onNavigate(item.tab);
                onClose();
              }}
            >
              <Ionicons name={item.icon} size={22} color={colors.text} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          ))}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { backgroundColor: colors.border + '60' },
            ]}
            onPress={() => {
              onSettings();
              onClose();
            }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>設定</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { backgroundColor: colors.border + '60' },
            ]}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.menuLabel, { color: colors.error }]}>登出</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 2, height: 0 },
    elevation: 10,
  },
  userSection: {
    padding: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: Spacing.sm,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  userName: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.sm,
  },
  menuList: {
    padding: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  menuLabel: {
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
});
