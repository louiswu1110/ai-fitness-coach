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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';
import { insertRecord, getRecords, deleteRecord } from '../services/database';
import * as Crypto from 'expo-crypto';

interface BodyRecord {
  id: string;
  date: string;
  weight: number;
  bodyFatPercent?: number;
  muscleMass?: number;
  waistCircumference?: number;
  note?: string;
}

export default function BodyScreen() {
  const colors = useThemeColors();
  const [records, setRecords] = useState<BodyRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [waist, setWaist] = useState('');
  const [note, setNote] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      const rows = await getRecords('weight_records', { orderBy: 'date DESC' });
      setRecords(rows as BodyRecord[]);
    } catch (e) {
      console.error('載入記錄失敗', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const latest = records.length > 0 ? records[0] : null;

  const bmi =
    latest?.weight
      ? (latest.weight / ((170 / 100) * (170 / 100))).toFixed(1)
      : '--';

  const resetForm = () => {
    setWeight('');
    setBodyFat('');
    setMuscleMass('');
    setWaist('');
    setNote('');
  };

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) {
      Alert.alert('錯誤', '請輸入有效的體重');
      return;
    }

    const record: BodyRecord = {
      id: Crypto.randomUUID(),
      date: new Date().toISOString(),
      weight: w,
      bodyFatPercent: bodyFat ? parseFloat(bodyFat) : undefined,
      muscleMass: muscleMass ? parseFloat(muscleMass) : undefined,
      waistCircumference: waist ? parseFloat(waist) : undefined,
      note: note || undefined,
    };

    try {
      await insertRecord('weight_records', record);
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
          await deleteRecord('weight_records', id);
          await loadRecords();
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderStatCard = (
    label: string,
    value: string,
    unit: string,
    bgColor: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statUnit, { color: colors.textSecondary }]}>
        {unit}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );

  const renderRecord = ({ item }: { item: BodyRecord }) => (
    <TouchableOpacity
      style={[styles.recordRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onLongPress={() => handleDelete(item.id)}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
        <View style={styles.recordValues}>
          <Text style={[styles.recordWeight, { color: colors.text }]}>
            {item.weight} kg
          </Text>
          {item.bodyFatPercent != null && (
            <Text style={[styles.recordFat, { color: colors.textSecondary }]}>
              體脂 {item.bodyFatPercent}%
            </Text>
          )}
          {item.muscleMass != null && (
            <Text style={[styles.recordFat, { color: colors.textSecondary }]}>
              肌肉 {item.muscleMass}kg
            </Text>
          )}
        </View>
        {item.note ? (
          <Text style={[styles.recordNote, { color: colors.textHint }]}>
            {item.note}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
    </TouchableOpacity>
  );

  const renderFormField = (
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    required?: boolean,
  ) => (
    <View style={styles.formField}>
      <Text style={[styles.formLabel, { color: colors.text }]}>
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.formInput,
          { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
        ]}
        value={value}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor={colors.textHint}
        keyboardType="decimal-pad"
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[styles.title, { color: colors.text }]}>身體組成</Text>

        {/* Stat Cards */}
        <View style={styles.statRow}>
          {renderStatCard(
            '體重',
            latest?.weight?.toString() ?? '--',
            'kg',
            colors.softPink,
            'scale-outline',
          )}
          {renderStatCard(
            '體脂率',
            latest?.bodyFatPercent?.toString() ?? '--',
            '%',
            colors.softBlue,
            'water-outline',
          )}
          {renderStatCard('BMI', latest ? bmi : '--', '', colors.softYellow, 'body-outline')}
        </View>

        {/* Add Button */}
        <TouchableOpacity
          style={[styles.addCard, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={28} color="#fff" />
          <Text style={styles.addCardText}>新增記錄</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>歷史記錄</Text>

        {records.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color={colors.textHint} />
            <Text style={[styles.emptyText, { color: colors.textHint }]}>
              還沒有記錄，點擊上方按鈕新增第一筆吧！
            </Text>
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderRecord}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>新增身體記錄</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {renderFormField('體重', weight, setWeight, '輸入體重 (kg)', true)}
              {renderFormField('體脂率', bodyFat, setBodyFat, '輸入體脂率 (%)')}
              {renderFormField('肌肉量', muscleMass, setMuscleMass, '輸入肌肉量 (kg)')}
              {renderFormField('腰圍', waist, setWaist, '輸入腰圍 (cm)')}

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.text }]}>備註</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    styles.formInputMultiline,
                    { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="備註（選填）"
                  placeholderTextColor={colors.textHint}
                  multiline
                  numberOfLines={3}
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
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: { fontSize: FontSize.xxl, fontWeight: '700' },
  statUnit: { fontSize: FontSize.sm },
  statLabel: { fontSize: FontSize.sm },
  addCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  addCardText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '600', marginBottom: Spacing.sm },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  recordDate: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  recordValues: { flexDirection: 'row', gap: Spacing.md, alignItems: 'baseline' },
  recordWeight: { fontSize: FontSize.lg, fontWeight: '600' },
  recordFat: { fontSize: FontSize.md },
  recordNote: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '600' },
  formField: { marginBottom: Spacing.md },
  formLabel: { fontSize: FontSize.md, fontWeight: '500', marginBottom: Spacing.xs },
  formInput: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
  },
  formInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
});
