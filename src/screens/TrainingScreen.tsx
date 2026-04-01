import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import * as Crypto from 'expo-crypto';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';
import { insertRecord, getRecords, deleteRecord } from '../services/database';

interface TrainingSession {
  id: string;
  date: string;
  name: string;
  exercises: string; // JSON string of ExerciseEntry[]
  durationMinutes?: number;
  note?: string;
}

interface ExerciseEntry {
  name: string;
  muscleGroup?: string;
  sets: SetRecord[];
}

interface SetRecord {
  weight: number;
  reps: number;
  isWarmup?: boolean;
}

const EXERCISE_LIBRARY: Record<string, string[]> = {
  '胸': ['臥推', '上斜臥推', '啞鈴飛鳥', '夾胸'],
  '背': ['引體向上', '划船', '滑輪下拉'],
  '腿': ['深蹲', '硬舉', '腿推', '腿彎舉'],
  '肩': ['肩推', '側平舉', '面拉'],
  '手臂': ['二頭彎舉', '三頭下壓'],
  '核心': ['捲腹', '平板支撐'],
};

const REST_OPTIONS = [60, 90, 120];

export default function TrainingScreen() {
  const colors = useThemeColors();
  const [history, setHistory] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Active training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingName, setTrainingName] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [trainingStartTime, setTrainingStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest timer
  const [restSeconds, setRestSeconds] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(-1);

  // Set form
  const [setWeight, setSetWeight] = useState('');
  const [setReps, setSetReps] = useState('');
  const [isWarmup, setIsWarmup] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await getRecords('training_sessions', {
        orderBy: 'date DESC',
        limit: 20,
      });
      setHistory(rows as TrainingSession[]);
    } catch (e) {
      console.error('載入訓練記錄失敗', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Training elapsed timer
  useEffect(() => {
    if (isTraining) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - trainingStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTraining, trainingStartTime]);

  // Rest countdown timer
  useEffect(() => {
    if (restSeconds > 0) {
      restRef.current = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            if (restRef.current) clearInterval(restRef.current);
            Alert.alert('休息結束！', '準備下一組吧 💪');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [restTotal]); // re-run when a new rest starts (restTotal changes)

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartTraining = () => {
    Alert.prompt(
      '開始訓練',
      '輸入今天的訓練名稱',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '開始',
          onPress: (name: string | undefined) => {
            if (!name?.trim()) {
              Alert.alert('錯誤', '請輸入訓練名稱');
              return;
            }
            setTrainingName(name.trim());
            setExercises([]);
            setTrainingStartTime(Date.now());
            setElapsedSeconds(0);
            setIsTraining(true);
          },
        },
      ],
      'plain-text',
      '',
      'default',
    );
  };

  const handleEndTraining = () => {
    Alert.alert('結束訓練？', '確定要結束本次訓練嗎？', [
      { text: '繼續訓練', style: 'cancel' },
      {
        text: '結束',
        onPress: async () => {
          const duration = Math.round((Date.now() - trainingStartTime) / 60000);
          const session: TrainingSession = {
            id: Crypto.randomUUID(),
            date: new Date().toISOString(),
            name: trainingName,
            exercises: JSON.stringify(exercises),
            durationMinutes: duration,
          };

          try {
            await insertRecord('training_sessions', session);
          } catch (e) {
            Alert.alert('錯誤', '儲存失敗');
          }

          // Clean up
          setIsTraining(false);
          setTrainingName('');
          setExercises([]);
          if (timerRef.current) clearInterval(timerRef.current);
          if (restRef.current) clearInterval(restRef.current);
          setRestSeconds(0);
          await loadHistory();
        },
      },
    ]);
  };

  const handleAddExercise = (muscleGroup: string, exerciseName: string) => {
    setExercises((prev) => [
      ...prev,
      { name: exerciseName, muscleGroup, sets: [] },
    ]);
    setExerciseModalVisible(false);
  };

  const openAddSet = (exerciseIndex: number) => {
    setActiveExerciseIndex(exerciseIndex);
    setSetWeight('');
    setSetReps('');
    setIsWarmup(false);
    setSetModalVisible(true);
  };

  const handleAddSet = () => {
    const w = parseFloat(setWeight);
    const r = parseInt(setReps, 10);
    if (isNaN(w) || w < 0) {
      Alert.alert('錯誤', '請輸入有效的重量');
      return;
    }
    if (isNaN(r) || r <= 0) {
      Alert.alert('錯誤', '請輸入有效的次數');
      return;
    }

    setExercises((prev) => {
      const updated = [...prev];
      updated[activeExerciseIndex] = {
        ...updated[activeExerciseIndex],
        sets: [
          ...updated[activeExerciseIndex].sets,
          { weight: w, reps: r, isWarmup },
        ],
      };
      return updated;
    });
    setSetModalVisible(false);
  };

  const handleStartRest = (seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestSeconds(seconds);
    setRestTotal((prev) => prev + 1); // trigger useEffect
  };

  const handleDeleteHistory = (id: string) => {
    Alert.alert('確認刪除', '確定要刪除這筆訓練記錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await deleteRecord('training_sessions', id);
          await loadHistory();
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const parseExercises = (json: string): ExerciseEntry[] => {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────

  const renderActiveTraining = () => (
    <View>
      {/* Training header */}
      <View style={[styles.activeHeader, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={styles.activeTitle}>{trainingName}</Text>
          <Text style={styles.activeTimer}>{formatTime(elapsedSeconds)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: colors.error }]}
          onPress={handleEndTraining}
        >
          <Ionicons name="stop-circle-outline" size={20} color="#fff" />
          <Text style={styles.endButtonText}>結束</Text>
        </TouchableOpacity>
      </View>

      {/* Rest Timer */}
      {restSeconds > 0 && (
        <View style={[styles.restCard, { backgroundColor: colors.softYellow }]}>
          <Ionicons name="timer-outline" size={22} color={colors.text} />
          <Text style={[styles.restText, { color: colors.text }]}>
            休息中 {formatTime(restSeconds)}
          </Text>
          <TouchableOpacity onPress={() => { if (restRef.current) clearInterval(restRef.current); setRestSeconds(0); }}>
            <Text style={[styles.restSkip, { color: colors.primary }]}>跳過</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rest buttons */}
      {restSeconds === 0 && exercises.length > 0 && (
        <View style={styles.restRow}>
          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>組間休息：</Text>
          {REST_OPTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[styles.restOption, { backgroundColor: colors.softBlue }]}
              onPress={() => handleStartRest(sec)}
            >
              <Text style={[styles.restOptionText, { color: colors.text }]}>{sec}s</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Exercise list */}
      {exercises.map((exercise, exIdx) => (
        <View
          key={exIdx}
          style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.exerciseHeader}>
            <View>
              <Text style={[styles.exerciseName, { color: colors.text }]}>
                {exercise.name}
              </Text>
              {exercise.muscleGroup && (
                <Text style={[styles.exerciseMuscle, { color: colors.textSecondary }]}>
                  {exercise.muscleGroup}
                </Text>
              )}
            </View>
          </View>

          {/* Sets Table */}
          {exercise.sets.length > 0 && (
            <View style={styles.setsTable}>
              <View style={styles.setsHeader}>
                <Text style={[styles.setsCol, styles.setsColNum, { color: colors.textHint }]}>組</Text>
                <Text style={[styles.setsCol, { color: colors.textHint }]}>重量</Text>
                <Text style={[styles.setsCol, { color: colors.textHint }]}>次數</Text>
                <Text style={[styles.setsCol, { color: colors.textHint }]}>類型</Text>
              </View>
              {exercise.sets.map((set, sIdx) => (
                <View key={sIdx} style={styles.setsRow}>
                  <Text style={[styles.setsCol, styles.setsColNum, { color: colors.textSecondary }]}>
                    {sIdx + 1}
                  </Text>
                  <Text style={[styles.setsCol, { color: colors.text }]}>{set.weight} kg</Text>
                  <Text style={[styles.setsCol, { color: colors.text }]}>{set.reps} 次</Text>
                  <Text style={[styles.setsCol, { color: set.isWarmup ? colors.warning : colors.success }]}>
                    {set.isWarmup ? '熱身' : '正式'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.addSetButton, { borderColor: colors.primary }]}
            onPress={() => openAddSet(exIdx)}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={[styles.addSetText, { color: colors.primary }]}>新增一組</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add Exercise Button */}
      <TouchableOpacity
        style={[styles.addExerciseButton, { backgroundColor: colors.softPurple }]}
        onPress={() => setExerciseModalVisible(true)}
      >
        <Ionicons name="barbell-outline" size={22} color={colors.text} />
        <Text style={[styles.addExerciseText, { color: colors.text }]}>新增動作</Text>
      </TouchableOpacity>
    </View>
  );

  const renderIdleState = () => (
    <View>
      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startCard, { backgroundColor: colors.primary }]}
        onPress={handleStartTraining}
        activeOpacity={0.8}
      >
        <Ionicons name="barbell-outline" size={36} color="#fff" />
        <Text style={styles.startTitle}>開始訓練</Text>
        <Text style={styles.startSubtitle}>記錄今天的重訓內容</Text>
      </TouchableOpacity>

      {/* History */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>歷史訓練</Text>

      {history.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="fitness-outline" size={48} color={colors.textHint} />
          <Text style={[styles.emptyText, { color: colors.textHint }]}>
            還沒有訓練記錄，開始你的第一次訓練吧！
          </Text>
        </View>
      ) : (
        history.map((session) => {
          const exList = parseExercises(session.exercises);
          return (
            <TouchableOpacity
              key={session.id}
              style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onLongPress={() => handleDeleteHistory(session.id)}
              activeOpacity={0.7}
            >
              <View style={styles.historyHeader}>
                <Text style={[styles.historyName, { color: colors.text }]}>{session.name}</Text>
                <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                  {formatDate(session.date)}
                </Text>
              </View>
              <View style={styles.historyMeta}>
                {session.durationMinutes != null && (
                  <View style={styles.historyTag}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.historyTagText, { color: colors.textSecondary }]}>
                      {session.durationMinutes} 分鐘
                    </Text>
                  </View>
                )}
                <View style={styles.historyTag}>
                  <Ionicons name="barbell-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.historyTagText, { color: colors.textSecondary }]}>
                    {exList.length} 個動作
                  </Text>
                </View>
                <View style={styles.historyTag}>
                  <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.historyTagText, { color: colors.textSecondary }]}>
                    {exList.reduce((s, e) => s + e.sets.length, 0)} 組
                  </Text>
                </View>
              </View>
              <View style={styles.historyExercises}>
                {exList.map((ex, i) => (
                  <Text key={i} style={[styles.historyExName, { color: colors.textSecondary }]}>
                    {ex.name}
                    {ex.sets.length > 0 &&
                      ` - ${ex.sets.map((s) => `${s.weight}kg x${s.reps}`).join(', ')}`}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>重訓紀錄</Text>
        {isTraining ? renderActiveTraining() : renderIdleState()}
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal visible={exerciseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>選擇動作</Text>
              <TouchableOpacity onPress={() => setExerciseModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(EXERCISE_LIBRARY).map(([group, items]) => (
                <View key={group} style={styles.exerciseGroup}>
                  <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{group}</Text>
                  <View style={styles.exerciseButtons}>
                    {items.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[styles.exercisePickButton, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                        onPress={() => handleAddExercise(group, name)}
                      >
                        <Text style={[styles.exercisePickText, { color: colors.text }]}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Set Modal */}
      <Modal visible={setModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.setModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.lg }]}>
              新增一組
              {activeExerciseIndex >= 0 && exercises[activeExerciseIndex] &&
                ` - ${exercises[activeExerciseIndex].name}`}
            </Text>

            <View style={styles.setInputRow}>
              <View style={styles.setInputCol}>
                <Text style={[styles.formLabel, { color: colors.text }]}>重量 (kg)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={setWeight}
                  onChangeText={setSetWeight}
                  placeholder="0"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.setInputCol}>
                <Text style={[styles.formLabel, { color: colors.text }]}>次數</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={setReps}
                  onChangeText={setSetReps}
                  placeholder="0"
                  placeholderTextColor={colors.textHint}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.warmupToggle}
              onPress={() => setIsWarmup(!isWarmup)}
            >
              <Ionicons
                name={isWarmup ? 'checkbox' : 'square-outline'}
                size={22}
                color={isWarmup ? colors.warning : colors.textSecondary}
              />
              <Text style={[styles.warmupLabel, { color: colors.text }]}>熱身組</Text>
            </TouchableOpacity>

            <View style={styles.setModalActions}>
              <TouchableOpacity
                style={[styles.setModalButton, { backgroundColor: colors.inputBg }]}
                onPress={() => setSetModalVisible(false)}
              >
                <Text style={[styles.setModalButtonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.setModalButton, { backgroundColor: colors.primary }]}
                onPress={handleAddSet}
              >
                <Text style={[styles.setModalButtonText, { color: '#fff' }]}>確認</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.md },

  // Start Card
  startCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  startTitle: { color: '#fff', fontSize: FontSize.xxl, fontWeight: '700' },
  startSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.md },

  // Active Training
  activeHeader: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  activeTitle: { color: '#fff', fontSize: FontSize.xl, fontWeight: '700' },
  activeTimer: { color: 'rgba(255,255,255,0.9)', fontSize: FontSize.hero, fontWeight: '700' },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  endButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },

  // Rest Timer
  restCard: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  restText: { fontSize: FontSize.lg, fontWeight: '600', flex: 1 },
  restSkip: { fontSize: FontSize.md, fontWeight: '600' },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  restLabel: { fontSize: FontSize.sm },
  restOption: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  restOptionText: { fontSize: FontSize.md, fontWeight: '600' },

  // Exercise Card
  exerciseCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  exerciseName: { fontSize: FontSize.lg, fontWeight: '600' },
  exerciseMuscle: { fontSize: FontSize.sm },
  setsTable: { marginBottom: Spacing.sm },
  setsHeader: { flexDirection: 'row', paddingBottom: Spacing.xs },
  setsRow: { flexDirection: 'row', paddingVertical: Spacing.xs },
  setsCol: { flex: 1, fontSize: FontSize.md, textAlign: 'center' },
  setsColNum: { flex: 0.5 },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  addSetText: { fontSize: FontSize.md, fontWeight: '500' },
  addExerciseButton: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addExerciseText: { fontSize: FontSize.md, fontWeight: '600' },

  // Section & Empty
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '600', marginBottom: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },

  // History
  historyCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  historyName: { fontSize: FontSize.lg, fontWeight: '600' },
  historyDate: { fontSize: FontSize.sm },
  historyMeta: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  historyTag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  historyTagText: { fontSize: FontSize.sm },
  historyExercises: { gap: Spacing.xs },
  historyExName: { fontSize: FontSize.sm },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '600' },
  exerciseGroup: { marginBottom: Spacing.lg },
  groupTitle: { fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.sm },
  exerciseButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  exercisePickButton: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  exercisePickText: { fontSize: FontSize.md },

  // Set Modal
  setModalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    margin: Spacing.lg,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  setInputRow: { flexDirection: 'row', gap: Spacing.md },
  setInputCol: { flex: 1 },
  warmupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  warmupLabel: { fontSize: FontSize.md },
  setModalActions: { flexDirection: 'row', gap: Spacing.sm },
  setModalButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  setModalButtonText: { fontSize: FontSize.md, fontWeight: '600' },
  formLabel: { fontSize: FontSize.md, fontWeight: '500', marginBottom: Spacing.xs },
  formInput: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
  },
});
