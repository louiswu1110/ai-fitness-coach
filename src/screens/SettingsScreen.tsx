import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/useColorScheme';
import { geminiService } from '../services/gemini';
import { logout as authLogout } from '../services/auth';
import { useOpenAIAuth, exchangeOpenAICode, getOpenAIToken, clearOpenAIToken } from '../services/openai-oauth';
import * as AuthSession from 'expo-auth-session';
import { BorderRadius, FontSize, Spacing } from '../utils/theme';

interface Props {
  onClose: () => void;
  onLogout?: () => void;
}

interface Profile {
  name: string;
  height: string;
  age: string;
  gender: string;
  activityLevel: string;
}

interface Goals {
  targetWeight: string;
  dailyCalories: string;
  targetBodyFat: string;
}

type ApiKeyStatus = 'idle' | 'validating' | 'success' | 'failed';

const PROFILE_KEY = 'profile_data';
const GOALS_KEY = 'profile_goals';

const GENDER_OPTIONS = ['男', '女', '其他'];
const ACTIVITY_OPTIONS = ['久坐', '輕度活動', '中度活動', '高度活動', '非常活躍'];

export default function SettingsScreen({ onClose, onLogout }: Props) {
  const colors = useThemeColors();
  const { request: oaiRequest, response: oaiResponse, promptAsync: oaiPromptAsync } = useOpenAIAuth();

  // Handle ChatGPT OAuth response
  useEffect(() => {
    if (oaiResponse?.type === 'success') {
      const code = (oaiResponse as any).params?.code;
      if (code && oaiRequest?.codeVerifier) {
        const redirectUri = AuthSession.makeRedirectUri();
        exchangeOpenAICode(code, oaiRequest.codeVerifier, redirectUri)
          .then(() => { Alert.alert('成功', 'ChatGPT 已連接！'); setApiKeyStatus('idle'); })
          .catch((e) => Alert.alert('失敗', e.message));
      }
    }
  }, [oaiResponse]);

  const [profile, setProfile] = useState<Profile>({
    name: '',
    height: '',
    age: '',
    gender: '',
    activityLevel: '',
  });

  const [goals, setGoals] = useState<Goals>({
    targetWeight: '',
    dailyCalories: '',
    targetBodyFat: '',
  });

  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileJson, goalsJson, savedKey] = await Promise.all([
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(GOALS_KEY),
        geminiService.getApiKey(),
      ]);
      if (profileJson) setProfile(JSON.parse(profileJson));
      if (goalsJson) setGoals(JSON.parse(goalsJson));
      if (savedKey) {
        setApiKey(savedKey);
        setApiKeyStatus('success');
      }
    } catch {
      // Silently fail on load -- user can re-enter data
    }
  };

  const saveData = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
        AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals)),
      ]);
      setHasChanges(false);
      Alert.alert('已儲存', '設定已成功儲存');
    } catch {
      Alert.alert('錯誤', '儲存失敗，請稍後再試');
    }
  };

  const handleApiKeyValidate = async () => {
    if (!apiKey.trim()) {
      Alert.alert('提示', '請先輸入 API Key');
      return;
    }
    setApiKeyStatus('validating');
    try {
      await geminiService.setApiKey(apiKey.trim());
      const isValid = await geminiService.validateApiKey();
      setApiKeyStatus(isValid ? 'success' : 'failed');
      if (!isValid) {
        Alert.alert('驗證失敗', 'API Key 無效，請確認後重試');
      }
    } catch {
      setApiKeyStatus('failed');
      Alert.alert('驗證失敗', '網路錯誤，請稍後再試');
    }
  };

  const handleLogout = () => {
    Alert.alert('確認登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: () => {
          authLogout();
        },
      },
    ]);
  };

  const updateProfile = (key: keyof Profile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateGoals = (key: keyof Goals, value: string) => {
    setGoals((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const renderApiKeyStatusIcon = () => {
    switch (apiKeyStatus) {
      case 'validating':
        return <ActivityIndicator size="small" color={colors.primary} />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={20} color={colors.success} />;
      case 'failed':
        return <Ionicons name="close-circle" size={20} color={colors.error} />;
      default:
        return null;
    }
  };

  const renderApiKeyStatusText = () => {
    switch (apiKeyStatus) {
      case 'validating':
        return '驗證中...';
      case 'success':
        return '已驗證';
      case 'failed':
        return '驗證失敗';
      default:
        return '未驗證';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>設定</Text>
        <TouchableOpacity onPress={saveData} disabled={!hasChanges}>
          <Text
            style={[
              styles.saveButton,
              { color: hasChanges ? colors.primary : colors.textHint },
            ]}
          >
            儲存
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>個人資料</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>名稱</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={profile.name}
              onChangeText={(v) => updateProfile('name', v)}
              placeholder="輸入名稱"
              placeholderTextColor={colors.textHint}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>身高 (cm)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={profile.height}
                onChangeText={(v) => updateProfile('height', v)}
                placeholder="170"
                placeholderTextColor={colors.textHint}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>年齡</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={profile.age}
                onChangeText={(v) => updateProfile('age', v)}
                placeholder="25"
                placeholderTextColor={colors.textHint}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>性別</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        profile.gender === option ? colors.primary : colors.inputBg,
                    },
                  ]}
                  onPress={() => updateProfile('gender', option)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: profile.gender === option ? '#FFFFFF' : colors.textSecondary,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>活動量</Text>
            <View style={styles.chipRow}>
              {ACTIVITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        profile.activityLevel === option ? colors.primary : colors.inputBg,
                    },
                  ]}
                  onPress={() => updateProfile('activityLevel', option)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          profile.activityLevel === option ? '#FFFFFF' : colors.textSecondary,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Goals Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>目標設定</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>目標體重 (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={goals.targetWeight}
              onChangeText={(v) => updateGoals('targetWeight', v)}
              placeholder="65"
              placeholderTextColor={colors.textHint}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>每日卡路里</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={goals.dailyCalories}
                onChangeText={(v) => updateGoals('dailyCalories', v)}
                placeholder="2000"
                placeholderTextColor={colors.textHint}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>目標體脂 (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={goals.targetBodyFat}
                onChangeText={(v) => updateGoals('targetBodyFat', v)}
                placeholder="15"
                placeholderTextColor={colors.textHint}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* AI Provider Selection */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>AI 供應商</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, geminiService.currentProvider === 'chatgpt' && { backgroundColor: colors.primary }]}
              onPress={() => { geminiService.setProvider('chatgpt'); setApiKeyStatus('idle'); }}
            >
              <Text style={[styles.chipText, geminiService.currentProvider === 'chatgpt' && { color: '#fff' }]}>
                ChatGPT (OAuth)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, geminiService.currentProvider === 'gemini' && { backgroundColor: colors.primary }]}
              onPress={() => { geminiService.setProvider('gemini'); setApiKeyStatus('idle'); }}
            >
              <Text style={[styles.chipText, geminiService.currentProvider === 'gemini' && { color: '#fff' }]}>
                Gemini (API Key)
              </Text>
            </TouchableOpacity>
          </View>

          {geminiService.currentProvider === 'chatgpt' ? (
            <View style={styles.field}>
              <Text style={[styles.sectionHint, { color: colors.textHint, marginBottom: 12 }]}>
                用你的 ChatGPT Plus/Pro 訂閱，不需要 API Key
              </Text>
              {getOpenAIToken() ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: '600' }}>已連接 ChatGPT</Text>
                  <TouchableOpacity onPress={() => { clearOpenAIToken(); setApiKeyStatus('idle'); }}>
                    <Text style={{ color: colors.error, fontSize: 13 }}>斷開</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.validateButton, { backgroundColor: '#10a37f', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => oaiPromptAsync()}
                >
                  <Text style={[styles.validateButtonText, { fontSize: 15 }]}>登入 ChatGPT</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>

        {/* Gemini API Key Section (only when Gemini selected) */}
        {geminiService.currentProvider === 'gemini' && (
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gemini API Key</Text>
          <Text style={[styles.sectionHint, { color: colors.textHint }]}>
            用於 AI 教練功能，Key 會加密儲存在裝置上
          </Text>

          <View style={styles.field}>
            <View style={styles.apiKeyInputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.apiKeyInput,
                  { backgroundColor: colors.inputBg, color: colors.text },
                ]}
                value={apiKey}
                onChangeText={(v) => {
                  setApiKey(v);
                  setApiKeyStatus('idle');
                }}
                placeholder="AIza..."
                placeholderTextColor={colors.textHint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.validateButton, { backgroundColor: colors.primary }]}
                onPress={handleApiKeyValidate}
                disabled={apiKeyStatus === 'validating'}
              >
                <Text style={styles.validateButtonText}>驗證</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.apiKeyStatusRow}>
              {renderApiKeyStatusIcon()}
              <Text
                style={[
                  styles.apiKeyStatusText,
                  {
                    color:
                      apiKeyStatus === 'success'
                        ? colors.success
                        : apiKeyStatus === 'failed'
                        ? colors.error
                        : colors.textHint,
                  },
                ]}
              >
                {renderApiKeyStatusText()}
              </Text>
            </View>
          </View>
        </View>
        )}

        {/* Logout */}
        {onLogout && (
          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: colors.error }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>登出</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  scroll: {
    padding: Spacing.lg,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  sectionHint: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  field: {
    marginBottom: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  apiKeyInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  apiKeyInput: {
    flex: 1,
  },
  validateButton: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  apiKeyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  apiKeyStatusText: {
    fontSize: FontSize.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginTop: Spacing.sm,
  },
  logoutText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
