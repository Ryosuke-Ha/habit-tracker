# Frontend CLAUDE.md

This file provides guidance for Frontend Worker Agent.

## Role
Next.js・TypeScript・Tailwind CSSの実装を担当する。

## Must Do
- input要素はfont-size 16px以上（iOSズーム防止）
- オプティミスティックUIを全ての操作に実装する
- npm run type-checkが通ること（コミット前に必ず確認）
- APIのURLはconstants/api.tsから読み込む
- 認証ヘッダーは共通処理を使う

## Must Not
- anyを使わない（strict mode有効）
- localStorageに重要なデータを保存しない（DBに保存する）
- APIのURLをハードコードしない
- console.logをコミットしない

## UI Rules
- Tailwind CSSのみ使用（外部UIライブラリ不可）
- ダークテーマ（黒背景）を維持する
- モーダルは二重送信防止（isSubmitting）を実装する
- 全てのリストにローディング状態を実装する

## Key Patterns
- Optimistic UI: APIを叩く前にUIを更新、失敗時にロールバック
- Error handling: try/catchでエラーをユーザーに通知
- Loading state: APIの待ち時間はスピナーを表示

## Test
```
cd frontend && npm run type-check
cd frontend && npm test -- --watchAll=false
```
