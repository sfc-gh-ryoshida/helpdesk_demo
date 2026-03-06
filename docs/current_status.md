# スマート社内ヘルプデスク 現在の環境状況

最終更新: 2026/03/06

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
- [x] Cortex Agent連携（IT/Finance/HR/General 4エージェント）
- [x] チケット自動作成（重複チェック付き）
- [x] Slackへの自動返信（AI回答 + フィードバックボタン）
- [x] 高緊急度アラート
- [x] ログテーブルへの保存
- [x] 評価ハンドラー（解決/有人対応/エスカレーション）
- [ ] MCP Server連携（未実装）

### 2. PostgreSQLテーブル

| テーブル | スキーマ | 説明 | 状態 |
|----------|----------|------|:----:|
| `helpdesk_tickets` | app | IT/一般チケット管理 (TKT-/IT-/GEN-) | ✅ |
| `finance_tickets` | app | 経理チケット管理 (FIN-) | ✅ |
| `hr_tickets` | app | 人事チケット管理 (HR-) | ✅ |
| `helpdesk_logs` | app | 会話ログ | ✅ |
| `ticket_history` | app | チケット変更履歴 | ✅ |
| `ticket_comments` | app | チケットコメント | ✅ |
| `escalation_log` | app | エスカレーション記録 | ✅ |
| `ai_response_log` | app | AI応答ログ | ✅ |

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

### Phase 2（拡張機能）

| 機能 | 状態 | 備考 |
|------|:----:|------|
| Cortex Search Service | ✅ | KNOWLEDGE/ASSET/FINANCE/HR 4サービス |
| Cortex Agent | ✅ | HELPDESK/FINANCE/HR 3エージェント |
| AWS Lambda (Slack Bot) | ✅ | カテゴリ選択→n8nルーティング |
| pg_lake + Iceberg連携 | ⬜ | S3設定必要 |
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
| 2026/03/06 | Lambda stateless修正（ボタンvalue埋め込み方式） | `slack_app.py` |
| 2026/03/06 | n8nワークフロー修正（Postgres 0行問題、ノード位置重複） | `n8n_workflows/*.json` |

---

## 既知の課題

1. **認証未実装**: Ticket Appに認証機能がない
2. **pg_lake未設定**: S3/IAM設定が必要
3. **MCP Server未連携**: Cortex Agentは直接呼び出し（MCP経由ではない）

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
│   ├── current_status.md           ← このファイル（現在の状況）
│   ├── application_design.md       ← アプリケーション設計書
│   ├── database_design.md          ← データベース設計書
│   ├── deployment_guide.md         ← デプロイ手順書（詳細）
│   ├── demo_script.md              ← デモ手順書
│   └── slack_webhook_setup.md      ← Slack連携設定ガイド
├── setup/
│   ├── 01_snowflake_base.sql       ← Snowflake基盤設定
│   └── ...                         ← その他セットアップSQL
├── n8n_workflows/
│   ├── IT_Helpdesk_Agent.json      ← IT Agent ワークフロー
│   ├── Finance_Helpdesk_Agent.json ← Finance Agent ワークフロー
│   ├── HR_Helpdesk_Agent.json      ← HR Agent ワークフロー
│   ├── General_Helpdesk_Agent.json ← General Agent ワークフロー
│   └── Helpdesk_Evaluation_Handler.json ← 評価ハンドラー
├── slack_app.py                    ← Lambda関数ソース
├── package/                        ← Lambda依存ライブラリ
└── ticket-app/
    ├── app/                        ← Next.js App Router
    ├── components/                 ← Reactコンポーネント
    ├── lib/                        ← ユーティリティ
    ├── Dockerfile                  ← Dockerビルド定義
    └── ticket_app_spec.yaml        ← Ticket App SPCSサービス定義
```
