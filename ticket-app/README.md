# Helpdesk Ticket App

社内ヘルプデスクのチケット管理ダッシュボード（IT/人事/経理の3カテゴリ対応）

## 前提条件

- **Node.js >= v18.17.0** (Next.js 14の要件)
- 推奨: v22.16.0

## クイックスタート

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集してDB接続情報を入力

# 3. 開発サーバー起動（Node.jsバージョン指定）
export PATH="/Users/ryoshida/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run dev -- -p 3001

# または nvm を使用
nvm use 22
npm run dev
```

http://localhost:3001 でアクセス

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
| SLACK_BOT_TOKEN | Slack Bot Token | xoxb-xxxx |
| SLACK_DEFAULT_CHANNEL | Slack通知先チャネル名 | ryoshida-demo_helpdesk-request |

## 機能

| ページ | パス | 説明 |
|--------|------|------|
| ITチケット一覧 | `/` | IT関連チケット（青アクセント） |
| 人事チケット一覧 | `/hr` | 人事関連チケット（緑アクセント） |
| 経理チケット一覧 | `/finance` | 経理関連チケット（紫アクセント） |
| 対話ログ | `/logs` | Slackスレッド単位のログ閲覧 |
| 分析 | `/analytics` | グラフによる可視化 |

### 主な機能
- **マルチカテゴリ対応**: サイドバーでIT/人事/経理を切り替え
- **Slack通知連携**: ステータス変更/担当者変更/対応メモ更新時にSlackスレッドへ通知
- **エスカレーション**: ワンクリックでESCALATEDステータスに変更
- **コメント機能**: チケットへのコメント追加・閲覧
- **変更履歴**: ステータス/担当者/対応メモの変更履歴記録
- **SLAインジケーター**: 緊急度に応じた対応時間の可視化
- **類似ナレッジ検索**: Cortex Searchによる類似事例検索
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

## トラブルシューティング

### CSS/レイアウトが崩れる場合
Node.jsのバージョンが古い可能性があります。v22.16.0を使用してください：
```bash
export PATH="/Users/ryoshida/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run dev -- -p 3001
```

### エラー: "Node.js version >= v18.17.0 is required"
Node.jsをアップグレードしてください：
```bash
nvm install 22
nvm use 22
```

## 本番ビルド

```bash
npm run build
npm run start
```

## 詳細仕様

[SPEC.md](./SPEC.md) を参照
