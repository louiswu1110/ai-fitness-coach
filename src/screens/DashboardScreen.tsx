import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';

export default function DashboardScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>你好 👋</Text>
            <Text style={[styles.title, { color: colors.text }]}>AI 健身教練</Text>
          </View>
          <TouchableOpacity style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>?</Text>
          </TouchableOpacity>
        </View>

        {/* Health Score Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroLabel}>今日健康分數</Text>
          <Text style={styles.heroScore}>--</Text>
          <Text style={styles.heroSubtext}>開始記錄來獲得你的健康分數</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.softPink }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>卡路里</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.softBlue }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>0 分</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>運動</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.softYellow }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>--</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>體重</Text>
          </View>
        </View>

        {/* AI Suggestion */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>AI 今日建議</Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
            歡迎使用 AI 健身教練！先到設定頁綁定你的 Gemini API Key，就能開始使用 AI 功能。
          </Text>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>快速動作</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: '📸', label: '記錄飲食', color: colors.softPink },
            { icon: '💪', label: '開始訓練', color: colors.softBlue },
            { icon: '⚖️', label: '量體重', color: colors.softYellow },
            { icon: '🤖', label: '問 AI', color: colors.softPurple },
          ].map((action, i) => (
            <TouchableOpacity key={i} style={[styles.actionCard, { backgroundColor: action.color }]}>
              <Text style={{ fontSize: 28 }}>{action.icon}</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
            </TouchableOpacity>
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
  greeting: { fontSize: FontSize.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700' },
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
  actionCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, flexBasis: '47%', flexGrow: 1 },
  actionLabel: { fontSize: FontSize.md, fontWeight: '600' },
});
