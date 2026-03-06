# Smart Helpdesk - スマート社内ヘルプデスク

Slackからの曖昧な問い合わせをAIで構造化し、自動対応するヘルプデスクシステム。

## アーキテクチャ

```
Slack → AWS Lambda (slack_app.py) → n8n (SPCS) → Cortex Agent → PostgreSQL
       (カテゴリ選択ボタン)      (4エージェント)    (AI解析)         ↓
                                                           Ticket App / Streamlit
```

## コンポーネント

| コンポーネント | 説明 | ディレクトリ |
|--------------|------|------------|
| Slack Bot | Lambda経由でカテゴリ分類・n8nルーティング | `slack_app.py` |
| n8n Workflows | 4エージェント + 評価ハンドラー | `n8n_workflows/` |
| Ticket App | チケット管理UI (Next.js) | `ticket-app/` |
| DBスキーマ | PostgreSQLテーブル定義 | `setup/` |

## クイックスタート

### 1. Ticket App（ローカル開発）

```bash
cd ticket-app
npm install
cp .env.example .env.local
# .env.local を編集
npm run dev
```

### 2. n8n Workflows

`n8n_workflows/` ディレクトリ内の各JSONをn8nにインポート:
- `IT_Helpdesk_Agent.json` - IT Agent
- `Finance_Helpdesk_Agent.json` - Finance Agent
- `HR_Helpdesk_Agent.json` - HR Agent
- `General_Helpdesk_Agent.json` - General Agent
- `Helpdesk_Evaluation_Handler.json` - 評価ハンドラー

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
- [docs/current_status.md](./docs/current_status.md) - 現在の環境状況
- [docs/application_design.md](./docs/application_design.md) - アプリケーション設計書
- [docs/deployment_guide.md](./docs/deployment_guide.md) - デプロイ手順書
- [docs/demo_script.md](./docs/demo_script.md) - デモ手順書
- [setup/](./setup/) - SQL/設定スクリプト

## 技術スタック

- **AI**: Snowflake Cortex Agent + Cortex Search
- **DB**: Snowflake Postgres
- **Workflow**: n8n on SPCS
- **Frontend**: Next.js 14 + shadcn/ui
- **Infra**: Snowpark Container Services (SPCS)
