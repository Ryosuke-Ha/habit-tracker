import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// -----------------------------------------------------------------------
// 認証を一時的に無効化するフラグ。
// true にするとゲストユーザーとして常にタブ画面へ進む。
// Google 認証を有効化するときは false に戻す。
// -----------------------------------------------------------------------
const AUTH_DISABLED = true;

const GUEST_USER: AuthUser = {
  email: '',
  name: 'ゲスト',
  avatar: null,
};

const EMAIL_KEY = 'auth_email';
const NAME_KEY = 'auth_name';
const AVATAR_KEY = 'auth_avatar';

export interface AuthUser {
  email: string;
  name: string;
  avatar: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(AUTH_DISABLED ? GUEST_USER : null);
  const [loading, setLoading] = useState(!AUTH_DISABLED);

  // expo-auth-session v7 では useProxy が型定義から削除されたため as any でキャスト
  // Google Cloud Console に登録する URI: https://auth.expo.io/@anonymous/habit-tracker
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirectUri: AuthSession.makeRedirectUri({ useProxy: true, scheme: 'habittracker' } as any),
  });

  // Load persisted session on mount (認証有効時のみ)
  useEffect(() => {
    if (AUTH_DISABLED) return;
    (async () => {
      try {
        const email = await SecureStore.getItemAsync(EMAIL_KEY);
        const name = await SecureStore.getItemAsync(NAME_KEY);
        const avatar = await SecureStore.getItemAsync(AVATAR_KEY);
        if (email && name) {
          setUser({ email, name, avatar });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle Google auth response (認証有効時のみ)
  useEffect(() => {
    if (AUTH_DISABLED) return;
    if (response?.type !== 'success') return;
    const { authentication } = response;
    if (!authentication?.accessToken) return;

    (async () => {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        });
        const info = await userInfoRes.json();
        const authUser: AuthUser = {
          email: info.email,
          name: info.name ?? info.email,
          avatar: info.picture ?? null,
        };
        await SecureStore.setItemAsync(EMAIL_KEY, authUser.email);
        await SecureStore.setItemAsync(NAME_KEY, authUser.name);
        if (authUser.avatar) {
          await SecureStore.setItemAsync(AVATAR_KEY, authUser.avatar);
        }
        setUser(authUser);
      } catch (e) {
        console.error('Failed to fetch Google user info:', e);
      }
    })();
  }, [response]);

  const signIn = useCallback(async () => {
    if (AUTH_DISABLED) return;
    await promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    if (AUTH_DISABLED) return;
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(NAME_KEY);
    await SecureStore.deleteItemAsync(AVATAR_KEY);
    setUser(null);
  }, []);

  return {
    user,
    isSignedIn: user !== null,
    loading,
    request,
    signIn,
    signOut,
  };
}
