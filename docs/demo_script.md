# スマート社内ヘルプデスク デモ手順書

## 概要

本デモでは、物流・倉庫会社向けの「AIヘルプデスクシステム」を構築します。

**アーキテクチャ**:
```
Slack → AWS Lambda (slack_app.py) → n8n(SPCS) → Cortex Agent/Search
       (カテゴリ選択ボタン)      (4 Workflows)    (3 Agents / 4 Search)
                                      ↓
                            Snowflake Postgres (チケット保存)
                                      ↓
                                Ticket App (Next.js)
```

---

## デモ準備

### 1. 環境情報の確認

```
Account: <your_account>
Database: HELPDESK_DB
Warehouse: RYOSHIDA_WH
Compute Pool: HELPDESK_POOL
```

### 2. 必要なクレデンシャル準備

- AWS IAM Role ARN（S3 Iceberg用）
- Slack Bot Token
- Postgres管理者パスワード

---

## セットアップ手順

### Step 1: Snowflake Postgres作成（Snowflake側）

```sql
-- 01_postgres_setup.sql のセクション1を実行
CREATE POSTGRES INSTANCE helpdesk_postgres ...
```

接続情報を取得:
```sql
DESCRIBE POSTGRES INSTANCE helpdesk_postgres;
```

### Step 2: Postgresスキーマ・データ作成（psql）

```bash
# 接続
psql postgresql://helpdesk_admin:<password>@<host>:5432/postgres

# 01_postgres_setup.sql のセクション2〜8を実行
\i /path/to/01_postgres_setup.sql
```

### Step 3: Snowflakeリソース作成

```sql
-- 02_snowflake_setup.sql を順次実行

-- External Volume（AWS IAM設定後）
CREATE EXTERNAL VOLUME helpdesk_iceberg_volume ...

-- Iceberg Table
CREATE ICEBERG TABLE HELPDESK_TICKETS_ICE ...

-- Cortex Search Service
CREATE CORTEX SEARCH SERVICE ASSET_SEARCH_SERVICE ...

-- Cortex Agent
CREATE CORTEX AGENT HELPDESK_AGENT ...

-- MCP Server
CREATE MCP SERVER HELPDESK_MCP_SERVER ...
```

### Step 4: n8nデプロイ（SPCS）

```bash
# Docker イメージのプッシュ
docker pull n8nio/n8n:latest
docker tag n8nio/n8n:latest <account>.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest
docker login <account>.registry.snowflakecomputing.com
docker push <account>.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest
```

```sql
-- spec.yamlアップロード
PUT file:///path/to/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA;

-- サービス作成
CREATE SERVICE HELPDESK_DB.SPCS.N8N_SVC ...

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;
```

### Step 5: n8nワークフロー設定

1. n8n WebUIにアクセス
2. `n8n_workflow.json` をインポート
3. Slack Bot資格情報を設定
4. MCP Server接続情報を設定
5. ワークフローを有効化

### Step 6: Streamlitアプリ作成

```sql
-- Snowsightでアプリ作成
CREATE STREAMLIT HELPDESK_DB.APP.HELPDESK_DASHBOARD
  ROOT_LOCATION = '@HELPDESK_DB.APP.STREAMLIT_STAGE'
  MAIN_FILE = 'streamlit_app.py'
  QUERY_WAREHOUSE = 'RYOSHIDA_WH';
```

---

## デモシナリオ

### シナリオ1: 基本的な問い合わせ処理

**Slackで送信**:
> 第3倉庫の田中です。スキャナー落として画面割れちゃいました

**期待される動作**:
1. Lambdaがメッセージを受信
2. Slackにカテゴリ選択ボタンを表示（IT/人事/経理/その他）
3. ユーザーが「IT」を選択
4. Lambdaがn8n IT AgentにWebhook送信
5. Cortex Agentが解析・Cortex Searchで端末情報を検索
6. Postgresにチケット登録
7. SlackにAI回答 + フィードバックボタンを返信

**確認項目**:
- チケットIDが発行されているか
- 端末IDが正しくマッチしているか
- 緊急度が適切か（HARDWARE → MEDIUM）

### シナリオ2: 経理問い合わせ

**Slackで送信**:
> 今月の出張費の経費精算について教えてください

**期待される動作**:
1. カテゴリ選択で「経理」をクリック
2. Finance Agentが経理ナレッジベースを検索
3. FIN-プレフィックスのチケットが作成される

### シナリオ3: 高緊急度対応

**Slackで送信**:
> 緊急！WMSが全社的に使えなくなりました！出荷作業が完全に止まっています！

**期待される動作**:
1. Cortex Agentが緊急度=HIGHと判定
2. チケット登録後、#helpdesk-urgentにアラート通知

### シナリオ3: ダッシュボード確認

1. Streamlitアプリを開く
2. KPIサマリーで本日のチケット数を確認
3. 拠点別グラフで第3倉庫のチケットが増えていることを確認
4. チケット一覧で詳細を確認

---

## 技術的ポイント（デモ説明用）

### なぜSnowflake Postgresを選んだか？

1. **コスト効率**: Hybrid Tableと比較して大幅なコスト削減
2. **PostgreSQLエコシステム**: 既存ツール（pgAdmin、DBeaver等）がそのまま使える
3. **アプリケーションDB**: 将来のチケット管理GUIのバックエンドとして最適
4. **pg_lake連携**: ネイティブにIceberg形式で出力可能（未実装・将来拡張余地）

### pg_lakeのメリット（未実装・将来拡張余地）

> **注**: 以下は pg_lake が利用可能になった際の想定であり、現時点では未実装です。

1. **シンプル**: `USING iceberg`だけでIcebergテーブル作成
2. **リアルタイム性**: pg_cronで数分単位の同期が可能
3. **オープンフォーマット**: Snowflake以外からもアクセス可能

### MCP Serverのメリット

1. **統合インターフェース**: 複数ツールを1つのエンドポイントで提供
2. **OAuth認証**: セキュアな接続
3. **標準プロトコル**: n8n以外のAIツールからも利用可能

---

## トラブルシューティング

### pg_lakeでエラーが出る場合（未実装・将来拡張用参考情報）
```sql
-- S3パーミッション確認
SELECT pg_lake_iceberg.check_s3_access('s3://helpdesk-iceberg-bucket/');
```

### Cortex Searchが動かない場合
```sql
-- サービス状態確認
DESCRIBE CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE;
```

### n8nが接続できない場合
```sql
-- 外部アクセス統合確認
DESCRIBE INTEGRATION EXTERNAL_ACCESS_N8N_EAI;

-- サービスログ確認
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.N8N_SVC', 0, 'n8n');
```

---

## クリーンアップ

```sql
-- サービス停止
ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SUSPEND;
DROP SERVICE HELPDESK_DB.SPCS.N8N_SVC;

-- Postgresインスタンス停止
ALTER POSTGRES INSTANCE helpdesk_postgres SUSPEND;
-- DROP POSTGRES INSTANCE helpdesk_postgres;  -- 完全削除

-- コンピュートプール停止
ALTER COMPUTE POOL HELPDESK_POOL STOP ALL;
-- DROP COMPUTE POOL HELPDESK_POOL;  -- 完全削除
```
