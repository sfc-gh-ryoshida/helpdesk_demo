# Helpdesk Ticket App

社内ヘルプデスクのチケット管理ダッシュボード

## クイックスタート

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集してDB接続情報を入力

# 3. 開発サーバー起動
npm run dev
```

http://localhost:3000 でアクセス

## 環境変数

`.env.local` に以下を設定：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| POSTGRES_HOST | DBホスト | xxx.postgres.snowflake.app |
| POSTGRES_PORT | ポート | 5432 |
| POSTGRES_DB | DB名 | postgres |
| POSTGRES_USER | ユーザー | snowflake_admin |
| POSTGRES_PASSWORD | パスワード | （秘密） |
| POSTGRES_SSL | SSL有効化 | true |

## 機能

| ページ | パス | 説明 |
|--------|------|------|
| チケット一覧 | `/` | 検索・フィルタ・ページネーション |
| 対話ログ | `/logs` | Slackスレッド単位のログ閲覧 |
| 分析 | `/analytics` | グラフによる可視化 |

### 主な機能
- ダークモード切替
- 30秒自動更新
- チケット検索（ID/報告者/要約）
- ステータス・担当者の編集

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- shadcn/ui + Tailwind CSS
- Recharts（グラフ）
- PostgreSQL (Snowflake Postgres)

## 本番ビルド

```bash
npm run build
npm run start
```

## 詳細仕様

[SPEC.md](./SPEC.md) を参照
