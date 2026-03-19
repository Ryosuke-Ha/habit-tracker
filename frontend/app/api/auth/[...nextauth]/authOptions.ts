import type { NextAuthOptions, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Gmailに限らず全Googleアカウントを許可（デフォルト設定）
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }: { token: any; account: any; profile?: Profile & { sub?: string } }) {
      // 初回ログイン時にGoogle profileをトークンに保存
      if (account && profile) {
        token.googleId = profile.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // セッションにユーザーIDを追加（将来のユーザー別データ分離用）
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
