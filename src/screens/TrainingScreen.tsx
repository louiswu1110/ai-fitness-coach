import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../utils/useColorScheme';
import { FontSize } from '../utils/theme';

export default function TrainingScreen() {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.empty, { color: colors.textSecondary }]}>功能開發中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: FontSize.lg },
});
