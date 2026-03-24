// 認証フック（将来的にGoogle OAuth等を実装）
// 現在は認証なしで動作確認できるようスタブ実装

export function useAuth() {
  return {
    email: null as string | null,
    isSignedIn: false,
  };
}
