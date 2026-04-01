import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '764756280137-n6urvgpv1tfhptms44jkd335b5dogo0g.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

// Simple storage that works on both web and native
function setItem(key: string, value: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

function getItem(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}

function removeItem(key: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem(key);
  }
}

// -- User --
export async function getStoredUser(): Promise<UserInfo | null> {
  const json = getItem('user_info');
  return json ? JSON.parse(json) : null;
}

export async function storeUser(user: UserInfo): Promise<void> {
  setItem('user_info', JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  removeItem('user_info');
  removeItem('google_access_token');
}

// -- Access Token --
export function storeAccessToken(token: string): void {
  setItem('google_access_token', token);
}

export function getAccessTokenSync(): string | null {
  return getItem('google_access_token');
}

export async function getAccessToken(): Promise<string | null> {
  return getAccessTokenSync();
}

// -- Logout (hard reset) --
export function logout(): void {
  removeItem('user_info');
  removeItem('google_access_token');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}

// -- Google Auth --
export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/generative-language', 'https://www.googleapis.com/auth/cloud-platform'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    discovery
  );

  return { request, response, promptAsync };
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return {
    email: data.email,
    name: data.name ?? '',
    picture: data.picture ?? '',
  };
}
