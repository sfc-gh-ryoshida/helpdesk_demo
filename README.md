# Smart Helpdesk - スマート社内ヘルプデスク

Slackからの曖昧な問い合わせをAIで構造化し、自動対応するヘルプデスクシステム。

## アーキテクチャ

```
Slack → AWS Lambda → n8n (SPCS) → Cortex Agent → PostgreSQL
                                                      ↓
                                              Ticket App / Streamlit
```

## コンポーネント

| コンポーネント | 説明 | ディレクトリ |
|--------------|------|------------|
| Slack Bot | Lambda経由でWebhook受信 | `slack_app.py` |
| n8n Workflow | ワークフロー自動化 | `Smart_Helpdesk___Snowflake_Agent.json` |
| Ticket App | チケット管理UI (Next.js) | `ticket-app/` |
| DBスキーマ | PostgreSQLテーブル定義 | `postgres_schema.sql` |

## クイックスタート

### 1. Ticket App（ローカル開発）

```bash
cd ticket-app
npm install
cp .env.example .env.local
# .env.local を編集
npm run dev
```

### 2. n8n Workflow

`Smart_Helpdesk___Snowflake_Agent.json` をn8nにインポート

### 3. Slack Bot

Lambda + API Gateway でデプロイ（`lambda_package.zip`）

## 環境情報

### PostgreSQL (Snowflake Postgres)
- Host: `*.postgres.snowflake.app`
- Database: `postgres`
- Schema: `app`

### デプロイ済みサービス
| サービス | URL |
|---------|-----|
| n8n | https://nqa4qd3u-sfseapac-fsi-japan.snowflakecomputing.app |
| Ticket App | https://fta4qd3u-sfseapac-fsi-japan.snowflakecomputing.app |

## ドキュメント

- [PLAN.md](./PLAN.md) - 実装計画・アーキテクチャ詳細
- [ticket-app/README.md](./ticket-app/README.md) - Ticket Appの詳細
- [ticket-app/SPEC.md](./ticket-app/SPEC.md) - Ticket App仕様書
- [docs/](./docs/) - セットアップ手順
- [setup/](./setup/) - SQL/設定スクリプト

## 技術スタック

- **AI**: Snowflake Cortex Agent + Cortex Search
- **DB**: Snowflake Postgres
- **Workflow**: n8n on SPCS
- **Frontend**: Next.js 14 + shadcn/ui
- **Infra**: Snowpark Container Services (SPCS)
