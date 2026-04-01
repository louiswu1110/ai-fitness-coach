import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';
import { insertRecord, getRecordsByDate, deleteRecord } from '../services/database';
import { geminiService } from '../services/gemini';

interface MealRecord {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: string; // JSON string of FoodItem[]
  note?: string;
}

interface FoodItem {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  portion?: string;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_CONFIG: Record<MealType, { emoji: string; label: string }> = {
  breakfast: { emoji: '🌅', label: '早餐' },
  lunch: { emoji: '☀️', label: '午餐' },
  dinner: { emoji: '🌙', label: '晚餐' },
  snack: { emoji: '🍪', label: '點心' },
};

export default function DietScreen() {
  const colors = useThemeColors();
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  // Form state
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      const rows = await getRecordsByDate('meal_records', new Date());
      setRecords(rows as MealRecord[]);
    } catch (e) {
      console.error('載入飲食記錄失敗', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Compute daily totals
  const dailyTotals = records.reduce(
    (acc, rec) => {
      try {
        const foods: FoodItem[] = JSON.parse(rec.foods);
        foods.forEach((f) => {
          acc.calories += f.calories || 0;
          acc.protein += f.protein || 0;
          acc.carbs += f.carbs || 0;
          acc.fat += f.fat || 0;
        });
      } catch { /* skip bad data */ }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const getMealRecords = (type: MealType): MealRecord[] =>
    records.filter((r) => r.mealType === type);

  const parseFoods = (json: string): FoodItem[] => {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const resetForm = () => {
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const handleSave = async () => {
    if (!foodName.trim()) {
      Alert.alert('錯誤', '請輸入食物名稱');
      return;
    }
    const cal = parseFloat(calories);
    if (isNaN(cal) || cal < 0) {
      Alert.alert('錯誤', '請輸入有效的卡路里');
      return;
    }

    const food: FoodItem = {
      name: foodName.trim(),
      calories: cal,
      protein: protein ? parseFloat(protein) : undefined,
      carbs: carbs ? parseFloat(carbs) : undefined,
      fat: fat ? parseFloat(fat) : undefined,
    };

    const record: MealRecord = {
      id: Crypto.randomUUID(),
      date: new Date().toISOString(),
      mealType: selectedMealType,
      foods: JSON.stringify([food]),
    };

    try {
      await insertRecord('meal_records', record);
      setModalVisible(false);
      resetForm();
      await loadRecords();
    } catch (e) {
      Alert.alert('錯誤', '儲存失敗，請稍後再試');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('確認刪除', '確定要刪除這筆記錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await deleteRecord('meal_records', id);
          await loadRecords();
        },
      },
    ]);
  };

  const handleAIRecognize = async () => {
    const isReady = await geminiService.ensureInitialized();
    if (!isReady) {
      Alert.alert('未設定 API Key', '請先到設定頁面設定 Gemini API Key');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    setAiLoading(true);
    try {
      const aiResult = await geminiService.analyzeFood(result.assets[0].base64);

      if (aiResult.error) {
        Alert.alert('辨識失敗', aiResult.error as string);
        return;
      }

      const foods: FoodItem[] = (aiResult.foods as any[])?.map((f: any) => ({
        name: f.name,
        calories: f.calories || 0,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        portion: f.portion,
      })) ?? [];

      if (foods.length === 0) {
        Alert.alert('辨識結果', '未能辨識出食物，請嘗試手動新增');
        return;
      }

      const summary = foods.map((f) => `${f.name} (${f.calories} kcal)`).join('\n');

      Alert.alert(
        'AI 辨識結果',
        `辨識到以下食物：\n\n${summary}\n\n總計：${aiResult.totalCalories || foods.reduce((s, f) => s + f.calories, 0)} kcal`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '儲存為午餐',
            onPress: () => saveAIResult(foods, 'lunch'),
          },
          {
            text: '儲存為晚餐',
            onPress: () => saveAIResult(foods, 'dinner'),
          },
        ],
      );
    } catch (e) {
      Alert.alert('錯誤', 'AI 辨識失敗，請稍後再試');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAIResult = async (foods: FoodItem[], mealType: MealType) => {
    const record: MealRecord = {
      id: Crypto.randomUUID(),
      date: new Date().toISOString(),
      mealType,
      foods: JSON.stringify(foods),
      note: 'AI 辨識',
    };

    try {
      await insertRecord('meal_records', record);
      await loadRecords();
    } catch (e) {
      Alert.alert('錯誤', '儲存失敗');
    }
  };

  const renderMacroItem = (label: string, value: number, unit: string) => (
    <View style={styles.macroItem}>
      <Text style={styles.macroValue}>{Math.round(value)}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );

  const renderMealSection = (type: MealType) => {
    const config = MEAL_CONFIG[type];
    const meals = getMealRecords(type);
    const totalCal = meals.reduce((sum, m) => {
      const foods = parseFoods(m.foods);
      return sum + foods.reduce((s, f) => s + f.calories, 0);
    }, 0);

    return (
      <View
        key={type}
        style={[styles.mealSection, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.mealHeader}>
          <Text style={styles.mealEmoji}>{config.emoji}</Text>
          <Text style={[styles.mealTitle, { color: colors.text }]}>{config.label}</Text>
          {totalCal > 0 && (
            <Text style={[styles.mealCal, { color: colors.textSecondary }]}>
              {Math.round(totalCal)} kcal
            </Text>
          )}
        </View>

        {meals.length === 0 ? (
          <Text style={[styles.mealEmpty, { color: colors.textHint }]}>尚未記錄</Text>
        ) : (
          meals.map((meal) => (
            <TouchableOpacity
              key={meal.id}
              onLongPress={() => handleDelete(meal.id)}
              activeOpacity={0.7}
            >
              {parseFoods(meal.foods).map((food, idx) => (
                <View key={idx} style={styles.foodRow}>
                  <Text style={[styles.foodName, { color: colors.text }]}>{food.name}</Text>
                  <Text style={[styles.foodCal, { color: colors.textSecondary }]}>
                    {food.calories} kcal
                  </Text>
                </View>
              ))}
              {meal.note ? (
                <Text style={[styles.mealNote, { color: colors.textHint }]}>{meal.note}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[styles.title, { color: colors.text }]}>飲食紀錄</Text>

        {/* Daily Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryTitle}>今日攝取</Text>
          <View style={styles.macroRow}>
            {renderMacroItem('卡路里', dailyTotals.calories, 'kcal')}
            {renderMacroItem('蛋白質', dailyTotals.protein, 'g')}
            {renderMacroItem('碳水', dailyTotals.carbs, 'g')}
            {renderMacroItem('脂肪', dailyTotals.fat, 'g')}
          </View>
        </View>

        {/* Meal Sections */}
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(renderMealSection)}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>手動新增</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={handleAIRecognize}
            activeOpacity={0.8}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="camera-outline" size={22} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>
              {aiLoading ? '辨識中...' : '📸 AI 辨識'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Manual Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>新增餐食</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Meal Type Selector */}
              <Text style={[styles.formLabel, { color: colors.text }]}>餐別</Text>
              <View style={styles.mealTypeRow}>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.mealTypeButton,
                      {
                        backgroundColor:
                          selectedMealType === type ? colors.primary : colors.inputBg,
                        borderColor: selectedMealType === type ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedMealType(type)}
                  >
                    <Text style={{ fontSize: FontSize.lg }}>{MEAL_CONFIG[type].emoji}</Text>
                    <Text
                      style={[
                        styles.mealTypeLabel,
                        { color: selectedMealType === type ? '#fff' : colors.text },
                      ]}
                    >
                      {MEAL_CONFIG[type].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Food Name */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  食物名稱 <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={foodName}
                  onChangeText={setFoodName}
                  placeholder="例：雞胸肉便當"
                  placeholderTextColor={colors.textHint}
                />
              </View>

              {/* Calories */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  卡路里 (kcal) <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="例：550"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Protein */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>蛋白質 (g)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="選填"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Carbs */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>碳水化合物 (g)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="選填"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Fat */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>脂肪 (g)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="選填"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>儲存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.md },

  // Summary Card
  summaryCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.md },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroValue: { color: '#fff', fontSize: FontSize.xxl, fontWeight: '700' },
  macroUnit: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs },
  macroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: FontSize.sm, marginTop: Spacing.xs },

  // Meal Sections
  mealSection: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  mealEmoji: { fontSize: FontSize.xl, marginRight: Spacing.sm },
  mealTitle: { fontSize: FontSize.lg, fontWeight: '600', flex: 1 },
  mealCal: { fontSize: FontSize.md },
  mealEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.xs },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  foodName: { fontSize: FontSize.md, flex: 1 },
  foodCal: { fontSize: FontSize.md },
  mealNote: { fontSize: FontSize.sm, marginTop: Spacing.xs },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '600' },

  // Meal Type Selector
  mealTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  mealTypeButton: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    gap: Spacing.xs,
  },
  mealTypeLabel: { fontSize: FontSize.sm, fontWeight: '500' },

  // Form
  formField: { marginBottom: Spacing.md },
  formLabel: { fontSize: FontSize.md, fontWeight: '500', marginBottom: Spacing.xs },
  formInput: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
});
