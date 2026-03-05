# スマート社内ヘルプデスク 現在の環境状況

最終更新: 2026/03/05

---

## デプロイ済みサービス

| サービス | URL | 状態 |
|----------|-----|:----:|
| n8n | https://nqa4qd3u-sfseapac-fsi-japan.snowflakecomputing.app | ✅ 稼働中 |
| Ticket App | https://fta4qd3u-sfseapac-fsi-japan.snowflakecomputing.app | ✅ 稼働中 |
| Streamlit Dashboard | 未作成 | ⬜ |

---

## 接続情報

### Snowflake

| 項目 | 値 |
|------|-----|
| 接続名 | `fsi_japan_connection` |
| アカウント | SFSEAPAC-FSI_JAPAN |
| ユーザー | FSI_JAPAN |
| ロール | ACCOUNTADMIN |
| ウェアハウス | RYOSHIDA_WH |
| データベース | HELPDESK_DB |
| スキーマ | APP, SPCS |
| コンピュートプール | HELPDESK_POOL |

### PostgreSQL (Snowflake Postgres)

| 項目 | 値 |
|------|-----|
| Host | `<YOUR_POSTGRES_HOST>.postgres.snowflake.app` |
| Port | 5432 |
| Database | `postgres` |
| User | `snowflake_admin` |
| Schema | `app` |

---

## 実装済み機能

### 1. n8n ワークフロー

- [x] Slack Webhookトリガー
- [x] LLM解析（Claude）
- [x] チケット自動作成
- [x] Slackへの自動返信
- [x] 高緊急度アラート
- [x] ログテーブルへの保存
- [ ] MCP Server連携（未実装）
- [ ] Cortex Agent連携（未実装）

### 2. PostgreSQLテーブル

| テーブル | スキーマ | 説明 | 状態 |
|----------|----------|------|:----:|
| `helpdesk_tickets` | app | チケット管理 | ✅ |
| `helpdesk_logs` | app | 会話ログ | ✅ |
| `escalation_log` | app | エスカレーション記録 | ✅ |
| `ai_response_log` | app | AI応答ログ | ✅ |
| `ticket_actions` | app | 操作履歴 | ⬜ 未作成 |
| `employee_master` | app | 従業員マスター | ⬜ 未作成 |
| `asset_master` | app | 資産マスター | ⬜ 未作成 |

### 3. Ticket App (Next.js)

- [x] チケット一覧表示（OPEN/IN_PROGRESS）
- [x] 統計表示（アクティブチケットのみカウント）
- [x] チケット編集モーダル
  - [x] ステータス変更
  - [x] 担当者アサイン
  - [x] 対応メモ記録
- [x] ログ一覧（`/logs`）
- [x] 会話詳細表示
- [x] **マルチカテゴリ対応（2026/03/05追加）**
  - [x] サイドバー: IT/人事/経理切り替えUI
  - [x] ITページ (/) - 青アクセント
  - [x] 人事ページ (/hr) - 緑アクセント
  - [x] 経理ページ (/finance) - 紫アクセント
  - [x] 共通TicketListコンポーネント

---

## 未実装機能

### Phase 1（基本機能）- ほぼ完了

| 機能 | 状態 | 備考 |
|------|:----:|------|
| n8n基本ワークフロー | ✅ | Slack→LLM→DB→返信 |
| PostgreSQLチケット管理 | ✅ | 基本テーブル作成済み |
| Ticket App | ✅ | 基本機能完了 |

### Phase 2（拡張機能）- 未着手

| 機能 | 状態 | 備考 |
|------|:----:|------|
| pg_lake + Iceberg連携 | ⬜ | S3設定必要 |
| Snowflake Iceberg Table | ⬜ | External Volume必要 |
| Cortex Search Service | ⬜ | 資産マスター連携 |
| Cortex Agent | ⬜ | FAQ自動回答 |
| MCP Server | ⬜ | n8n連携 |
| Streamlit Dashboard | ⬜ | 統計可視化 |

---

## 修正履歴

| 日付 | 内容 | ファイル |
|------|------|----------|
| 2026/03/02 | モーダルの閉じる処理を親コンポーネントに移動 | `app/page.tsx`, `components/TicketModal.tsx` |
| 2026/03/02 | 統計表示をアクティブチケットのみに修正 | `app/page.tsx` |
| 2026/03/02 | `ticket_actions`テーブルへのINSERTを削除 | `app/api/tickets/[id]/route.ts` |
| 2026/03/05 | マルチカテゴリ対応（IT/人事/経理） | `app/hr/`, `app/finance/`, `components/Sidebar.tsx` |
| 2026/03/05 | Node.jsバージョン問題解決（v16→v22） | 開発環境設定 |

---

## 既知の課題

1. **`ticket_actions`テーブル未作成**: 操作履歴を記録したい場合は作成が必要
2. **マスターデータ未整備**: `employee_master`, `asset_master`が未作成
3. **認証未実装**: Ticket Appに認証機能がない
4. **pg_lake未設定**: S3/IAM設定が必要
5. **HR/Financeテーブルが空**: テストデータ投入が必要

---

## 開発環境の注意点

### Node.jsバージョン要件
- **必須**: >= v18.17.0（Next.js 14の要件）
- **推奨**: v22.16.0
- **パス**: `~/.nvm/versions/node/v22.16.0`

### 起動コマンド（ローカル開発）
```bash
# Node.jsバージョンを明示的に指定して起動
export PATH="/Users/ryoshida/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run dev -- -p 3001
```

### よくある問題
- **CSS/レイアウトが崩れる**: Node.jsバージョンが古い可能性。v22.16.0を使用

---

## クイックリファレンス

### サービス再起動手順

```sql
-- サービス削除
DROP SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- サービス再作成
CREATE SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

-- 状態確認
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;
```

### Dockerイメージ更新手順

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app

# ビルド
docker build --platform linux/amd64 -t ticket-app:latest .

# タグ付け
docker tag ticket-app:latest sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/ticket-app:latest

# プッシュ
docker push sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/ticket-app:latest
```

### PostgreSQL接続

```bash
PGPASSWORD='<password>' psql -h <YOUR_POSTGRES_HOST>.postgres.snowflake.app -U snowflake_admin -d postgres
```

---

## ファイル構成

```
smart_helpdesk/
├── docs/
│   ├── current_status.md      ← このファイル（現在の状況）
│   ├── deployment_guide.md    ← デプロイ手順書（詳細）
│   ├── demo_script.md         ← デモ手順書
│   └── slack_webhook_setup.md ← Slack連携設定ガイド
├── setup/
│   ├── 01_postgres_setup.sql     ← PostgreSQLテーブル定義
│   ├── 02_snowflake_setup.sql    ← Snowflakeリソース設定
│   ├── 03_knowledge_base_setup.sql ← ナレッジベース設定
│   ├── 04_demo_data.sql          ← デモ用サンプルデータ
│   └── 05_spcs_deploy.sql        ← SPCSデプロイ用SQL
├── n8n/
│   ├── n8n_spec.yaml             ← n8n SPCSサービス定義
│   └── n8n_workflow.json         ← n8nワークフロー定義
└── ticket-app/
    ├── app/                      ← Next.js App Router
    ├── components/               ← Reactコンポーネント
    ├── lib/                      ← ユーティリティ
    ├── Dockerfile                ← Dockerビルド定義
    └── ticket_app_spec.yaml      ← Ticket App SPCSサービス定義
```
