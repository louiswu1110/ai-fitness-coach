import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// OpenAI Codex OAuth — 公開 Client ID，任何人都能用
// 用戶用 ChatGPT Plus/Pro 訂閱即可
const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

const discovery = {
  authorizationEndpoint: 'https://auth.openai.com/oauth/authorize',
  tokenEndpoint: 'https://auth.openai.com/oauth/token',
};

function getStored(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}

function setStored(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

export function getOpenAIToken(): string | null {
  return getStored('openai_oauth_token');
}

export function storeOpenAIToken(token: string): void {
  setStored('openai_oauth_token', token);
}

export function clearOpenAIToken(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem('openai_oauth_token');
    window.localStorage.removeItem('openai_refresh_token');
  }
}

export function useOpenAIAuth() {
  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: OPENAI_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'model.request'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  return { request, response, promptAsync };
}

export async function exchangeOpenAICode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  const res = await fetch('https://auth.openai.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OPENAI_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = await res.json();
  console.log('[OpenAI OAuth] token response:', JSON.stringify(data).substring(0, 300));

  if (data.error) throw new Error(data.error_description || data.error);

  storeOpenAIToken(data.access_token);
  if (data.refresh_token) {
    setStored('openai_refresh_token', data.refresh_token);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function refreshOpenAIToken(): Promise<string | null> {
  const refreshToken = getStored('openai_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch('https://auth.openai.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OPENAI_CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = await res.json();
    if (data.error) return null;

    storeOpenAIToken(data.access_token);
    if (data.refresh_token) {
      setStored('openai_refresh_token', data.refresh_token);
    }
    return data.access_token;
  } catch {
    return null;
  }
}
