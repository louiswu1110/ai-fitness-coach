import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGoogleAuth, fetchUserInfo, storeUser, storeAccessToken } from '../services/auth';
import { geminiService } from '../services/gemini';
import { Colors, BorderRadius, FontSize, Spacing } from '../utils/theme';

interface Props {
  onLogin: () => void;
  onSkip: () => void;
}

export default function LoginScreen({ onLogin, onSkip }: Props) {
  const { request, response, promptAsync } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Login] response:', JSON.stringify(response, null, 2));
    if (response?.type === 'success') {
      // Token 可能在不同位置
      const token = response.authentication?.accessToken
        ?? (response as any).params?.access_token;
      console.log('[Login] token found:', token ? 'YES (' + token.substring(0, 15) + '...)' : 'NO');

      if (token) {
        setLoading(true);
        setError(null);
        storeAccessToken(token);
        geminiService.setAccessToken(token);
        fetchUserInfo(token)
          .then((userInfo) => storeUser(userInfo))
          .then(() => onLogin())
          .catch((err) => {
            console.error('[Login] fetchUserInfo error:', err);
            // 即使 userInfo 失敗也讓他進去
            onLogin();
          });
      } else {
        setError('登入成功但無法取得 token');
      }
    } else if (response?.type === 'error') {
      console.error('[Login] error response:', response);
      setError('登入取消或失敗');
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await promptAsync();
    } catch {
      setError('無法開啟登入頁面');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Top spacer */}
        <View style={styles.spacer} />

        {/* Logo & Title */}
        <View style={styles.logoSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="fitness" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>AI 健身教練</Text>
          <Text style={styles.subtitle}>你的個人化健康管理平台</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonSection}>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.googleButton, !request && styles.disabledButton]}
            onPress={handleGoogleLogin}
            disabled={!request || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color={Colors.light.primary} />
                <Text style={styles.googleButtonText}>使用 Google 帳號登入</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>跳過登入</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>登入後即可使用完整功能</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appName: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: 'rgba(255,255,255,0.8)',
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: '#FFE0E0',
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  skipButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'underline',
  },
  footerText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.sm,
  },
});
