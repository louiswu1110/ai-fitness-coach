import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';
import { getStoredUser, UserInfo } from '../services/auth';
import SettingsScreen from './SettingsScreen';

export default function DashboardScreen({ onLogout }: { onLogout?: () => void }) {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    getStoredUser().then(setUser);
  }, [showSettings]);

  if (showSettings) {
    return (
      <SettingsScreen
        onClose={() => setShowSettings(false)}
        onLogout={() => { setShowSettings(false); onLogout?.(); }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header with user info */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 18 }}>
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                {user ? `Hi, ${user.name}` : '你好'} 👋
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>AI 健身教練</Text>
            </View>
          </View>
          <Pressable
            style={[styles.settingsBtn, { backgroundColor: colors.primary + '20' }]}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* Health Score Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroLabel}>今日健康分數</Text>
          <Text style={styles.heroScore}>--</Text>
          <Text style={styles.heroSubtext}>開始記錄來獲得你的健康分數</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { value: '0', label: '卡路里', bg: colors.softPink },
            { value: '0 分', label: '運動', bg: colors.softBlue },
            { value: '--', label: '體重', bg: colors.softYellow },
          ].map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* AI Suggestion */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>AI 今日建議</Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
            歡迎使用 AI 健身教練！登入 Google 後即可使用所有 AI 功能。
          </Text>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>快速動作</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: '📸', label: '記錄飲食', color: colors.softPink, tab: '飲食' },
            { icon: '💪', label: '開始訓練', color: colors.softBlue, tab: '訓練' },
            { icon: '⚖️', label: '量體重', color: colors.softYellow, tab: '身體' },
            { icon: '🤖', label: '問 AI', color: colors.softPurple, tab: '教練' },
          ].map((action, i) => (
            <Pressable
              key={i}
              style={[styles.actionCard, { backgroundColor: action.color }]}
              onPress={() => navigation.navigate(action.tab)}
            >
              <Text style={{ fontSize: 28 }}>{action.icon}</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: FontSize.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800' },
  settingsBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', cursor: 'pointer' as any },
  heroCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.md },
  heroScore: { color: '#fff', fontSize: 56, fontWeight: '800', marginVertical: Spacing.sm },
  heroSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, marginTop: 4 },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  cardBody: { fontSize: FontSize.md, lineHeight: 22 },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, flexBasis: '47%', flexGrow: 1, cursor: 'pointer' as any },
  actionLabel: { fontSize: FontSize.md, fontWeight: '600' },
});
