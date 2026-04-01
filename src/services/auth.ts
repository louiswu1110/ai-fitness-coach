import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth config
// 使用 Firebase 的 Web Client ID (client_type: 3)
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

export async function getStoredUser(): Promise<UserInfo | null> {
  const json = await AsyncStorage.getItem('user_info');
  return json ? JSON.parse(json) : null;
}

export async function storeUser(user: UserInfo): Promise<void> {
  await AsyncStorage.setItem('user_info', JSON.stringify(user));
}

export async function storeAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem('google_access_token', token);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem('google_access_token');
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem('user_info');
}

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri();
  console.log('=== REDIRECT URI ===', redirectUri);
  
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
