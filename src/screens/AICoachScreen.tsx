import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/useColorScheme';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';
import { geminiService } from '../services/gemini';
import { getRecords } from '../services/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AnalysisCard {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_CARDS: AnalysisCard[] = [
  { key: 'training', emoji: '🏋️', title: '訓練分析', subtitle: '分析近 7 天訓練' },
  { key: 'body', emoji: '🧍', title: '身體分析', subtitle: '體重體脂趨勢' },
  { key: 'diet', emoji: '🍽️', title: '飲食分析', subtitle: '營養攝取評估' },
  { key: 'weekly', emoji: '📊', title: '週報', subtitle: '本週綜合報告' },
];

const KEY_MAP: Record<string, string> = {
  summary: '總結',
  volumeAssessment: '訓練量評估',
  suggestions: '建議',
  riskLevel: '風險等級',
  trend: '趨勢',
  isHealthyProgress: '健康進步',
  score: '分數',
  dietScore: '飲食分數',
  trainingScore: '訓練分數',
  overallScore: '綜合分數',
  highlights: '亮點',
  nextWeekGoals: '下週目標',
  motivationalMessage: '加油打氣',
  answer: '回答',
  relatedTips: '相關提示',
  actionItems: '行動建議',
  error: '錯誤',
  rawResponse: '原始回應',
};

function humanizeKey(key: string): string {
  return KEY_MAP[key] ?? key;
}

// ---------------------------------------------------------------------------
// Helper: date range for "last 7 days"
// ---------------------------------------------------------------------------

function last7DaysISO(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return { start, end };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AICoachScreen() {
  const colors = useThemeColors();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null);
  const [analysisTitle, setAnalysisTitle] = useState('分析結果');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // API key state
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await geminiService.ensureInitialized();
      setHasApiKey(ok);
    })();
  }, []);

  // -----------------------------------------------------------------------
  // Quick analysis handlers
  // -----------------------------------------------------------------------

  async function handleAnalysis(card: AnalysisCard) {
    const ready = await geminiService.ensureInitialized();
    if (!ready) {
      const errMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'ai',
        content: '⚠️ 請先用 Google 帳號登入以使用 AI 功能。',
        timestamp: new Date(),
      };
      setMessages(prev => [errMsg, ...prev]);
      return;
    }

    setAnalysisLoading(true);
    setAnalysisTitle(`${card.emoji} ${card.title}`);
    setAnalysisResult(null); // reset previous

    try {
      const { start } = last7DaysISO();
      let result: Record<string, any>;

      switch (card.key) {
        case 'training': {
          const sessions = await getRecords('training_sessions', {
            where: 'date >= ?',
            args: [start],
            orderBy: 'date DESC',
          });
          const exercises = await getRecords('exercise_records', {
            where: 'date >= ?',
            args: [start],
            orderBy: 'date DESC',
          });
          result = await geminiService.analyzeTraining({ sessions, exercises });
          break;
        }
        case 'body': {
          const weights = await getRecords('weight_records', {
            orderBy: 'date DESC',
            limit: 30,
          });
          result = await geminiService.analyzeBodyComposition({ records: weights });
          break;
        }
        case 'diet': {
          const meals = await getRecords('meal_records', {
            where: 'date >= ?',
            args: [start],
            orderBy: 'date DESC',
          });
          result = await geminiService.askCoach(
            '請分析我最近 7 天的飲食紀錄，給出營養攝取評估、飲食分數和具體改善建議。',
            { meals },
          );
          break;
        }
        case 'weekly': {
          const [weights, meals, sessions, exercises, recovery] = await Promise.all([
            getRecords('weight_records', { where: 'date >= ?', args: [start], orderBy: 'date DESC' }),
            getRecords('meal_records', { where: 'date >= ?', args: [start], orderBy: 'date DESC' }),
            getRecords('training_sessions', { where: 'date >= ?', args: [start], orderBy: 'date DESC' }),
            getRecords('exercise_records', { where: 'date >= ?', args: [start], orderBy: 'date DESC' }),
            getRecords('daily_recovery', { where: 'date >= ?', args: [start], orderBy: 'date DESC' }),
          ]);
          result = await geminiService.generateWeeklyReport({
            weights,
            meals,
            sessions,
            exercises,
            recovery,
          });
          break;
        }
        default:
          result = { error: '未知分析類型' };
      }

      setAnalysisResult(result);
    } catch (e: any) {
      setAnalysisResult({ error: e.message ?? '分析失敗' });
    } finally {
      setAnalysisLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Chat handler
  // -----------------------------------------------------------------------

  async function handleSend() {
    const text = inputText.trim();
    if (!text) return;

    const ready = await geminiService.ensureInitialized();
    if (!ready) {
      const errMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'ai',
        content: '⚠️ 請先用 Google 帳號登入以使用 AI 功能。',
        timestamp: new Date(),
      };
      setMessages(prev => [errMsg, ...prev]);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [userMsg, ...prev]);
    setInputText('');
    setChatLoading(true);

    try {
      const { start } = last7DaysISO();
      const [weights, meals, exercises] = await Promise.all([
        getRecords('weight_records', { orderBy: 'date DESC', limit: 7 }),
        getRecords('meal_records', { where: 'date >= ?', args: [start], orderBy: 'date DESC', limit: 20 }),
        getRecords('exercise_records', { where: 'date >= ?', args: [start], orderBy: 'date DESC', limit: 20 }),
      ]);

      const result = await geminiService.askCoach(text, { weights, meals, exercises });

      const aiContent = result.error
        ? `❌ ${result.error}`
        : result.answer ?? JSON.stringify(result, null, 2);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: aiContent,
        timestamp: new Date(),
      };
      setMessages(prev => [aiMsg, ...prev]);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'ai',
        content: `❌ ${e.message ?? '請求失敗'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [errMsg, ...prev]);
    } finally {
      setChatLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function renderValue(value: any) {
    if (typeof value === 'string') {
      return <Text style={[styles.resultValueText, { color: colors.text }]}>{value}</Text>;
    }
    if (typeof value === 'number') {
      const clamped = Math.min(Math.max(value, 0), 100);
      return (
        <View>
          <Text style={[styles.resultValueText, { color: colors.primary, fontWeight: '700' }]}>
            {value}
          </Text>
          <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: clamped >= 70 ? colors.success : clamped >= 40 ? colors.warning : colors.error,
                  width: `${clamped}%`,
                },
              ]}
            />
          </View>
        </View>
      );
    }
    if (typeof value === 'boolean') {
      return (
        <View
          style={[
            styles.boolTag,
            { backgroundColor: value ? colors.success : colors.error },
          ]}
        >
          <Text style={styles.boolTagText}>{value ? '是 ✓' : '否 ✗'}</Text>
        </View>
      );
    }
    if (Array.isArray(value)) {
      return (
        <View style={styles.listContainer}>
          {value.map((item, idx) => (
            <View key={idx} style={styles.listRow}>
              <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.listItemText, { color: colors.text }]}>
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    // Fallback: nested object
    return <Text style={[styles.resultValueText, { color: colors.textSecondary }]}>{JSON.stringify(value, null, 2)}</Text>;
  }

  function renderChatItem({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.chatBubble,
          isUser ? styles.chatBubbleUser : styles.chatBubbleAI,
          {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderColor: isUser ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.chatBubbleText,
            { color: isUser ? '#FFFFFF' : colors.text },
          ]}
        >
          {item.content}
        </Text>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Quick analysis cards - horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.analysisRow}
        style={styles.analysisScroll}
      >
        {ANALYSIS_CARDS.map(card => (
          <TouchableOpacity
            key={card.key}
            style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => handleAnalysis(card)}
          >
            <Text style={styles.analysisEmoji}>{card.emoji}</Text>
            <Text style={[styles.analysisTitle, { color: colors.text }]}>{card.title}</Text>
            <Text style={[styles.analysisSubtitle, { color: colors.textSecondary }]}>
              {card.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chat messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        inverted
        keyExtractor={item => item.id}
        renderItem={renderChatItem}
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textHint} />
            <Text style={[styles.emptyChatText, { color: colors.textHint }]}>
              問我任何健身或飲食問題！
            </Text>
          </View>
        }
        ListHeaderComponent={
          chatLoading ? (
            <View style={[styles.chatBubble, styles.chatBubbleAI, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: Spacing.sm }} />
              <Text style={[styles.chatBubbleText, { color: colors.textSecondary }]}>AI 思考中...</Text>
            </View>
          ) : null
        }
      />

      {/* Input row */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="輸入你的問題..."
            placeholderTextColor={colors.textHint}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() ? colors.primary : colors.border,
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || chatLoading}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* API Key status */}
        <View style={[styles.statusRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statusText, { color: colors.textHint }]}>
            {hasApiKey ? '✅ 使用你的 Gemini API Key' : '⚠️ 請到設定頁綁定 Gemini API Key'}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Analysis result modal */}
      <Modal visible={analysisResult !== null || analysisLoading} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{analysisTitle}</Text>
              <TouchableOpacity
                onPress={() => {
                  setAnalysisResult(null);
                  setAnalysisLoading(false);
                }}
              >
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal body */}
            {analysisLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.modalLoadingText, { color: colors.textSecondary }]}>
                  AI 分析中，請稍候...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {analysisResult &&
                  Object.entries(analysisResult).map(([key, value]) => (
                    <View
                      key={key}
                      style={[styles.resultItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Text style={[styles.resultKey, { color: colors.primary }]}>
                        {humanizeKey(key)}
                      </Text>
                      {renderValue(value)}
                    </View>
                  ))}
              </ScrollView>
            )}

            {/* Close button */}
            {!analysisLoading && (
              <TouchableOpacity
                style={[styles.modalCloseBtn, { backgroundColor: colors.primary }]}
                onPress={() => setAnalysisResult(null)}
              >
                <Text style={styles.modalCloseBtnText}>關閉</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // -- Quick analysis cards --
  analysisScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  analysisRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  analysisCard: {
    width: 120,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  analysisEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  analysisTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  analysisSubtitle: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },

  // -- Chat --
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
  },
  chatBubbleAI: {
    alignSelf: 'flex-start',
  },
  chatBubbleText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    // inverted FlatList flips, so this shows at bottom visually
    transform: [{ scaleY: -1 }],
  },
  emptyChatText: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },

  // -- Input row --
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    borderWidth: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Status --
  statusRow: {
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    paddingTop: 2,
  },
  statusText: {
    fontSize: FontSize.xs,
  },

  // -- Modal --
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  modalScroll: {
    marginBottom: Spacing.md,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  modalLoadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: '600',
  },

  // -- Result items --
  resultItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  resultKey: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultValueText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },

  // -- Progress bar --
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // -- Bool tag --
  boolTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  boolTagText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // -- List --
  listContainer: {
    gap: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listBullet: {
    fontSize: FontSize.md,
    marginRight: Spacing.xs,
    lineHeight: 22,
  },
  listItemText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    flex: 1,
  },
});
