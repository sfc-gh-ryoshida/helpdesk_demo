-- ============================================================
-- SPCS デプロイ用 SQL（コピペ用）
-- 実行順序: 上から順に実行してください
-- 更新日: 2026-02-27
-- ============================================================

-- ============================================================
-- STEP 1: データベース・スキーマ作成
-- ============================================================

CREATE DATABASE IF NOT EXISTS HELPDESK_DB;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.APP;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.SPCS;

USE DATABASE HELPDESK_DB;

-- ============================================================
-- STEP 2: イメージリポジトリ作成
-- ============================================================

CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.N8N_REPO;
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_REPO;

-- 確認（repository_url をメモ）
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;
-- sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo
-- sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo

-- ============================================================
-- STEP 3: ステージ作成（spec.yaml 用）
-- ============================================================

CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_DATA
  DIRECTORY = (ENABLE = TRUE);

CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_DATA
  DIRECTORY = (ENABLE = TRUE);

-- ============================================================
-- STEP 4: Compute Pool 作成
-- ※ n8n と ticket-app を別々のプールで動かす（リソース確保のため）
-- ============================================================

CREATE COMPUTE POOL IF NOT EXISTS HELPDESK_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

CREATE COMPUTE POOL IF NOT EXISTS TICKET_APP_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

-- 確認（ACTIVE または IDLE になるまで待つ）
SHOW COMPUTE POOLS LIKE '%POOL';

-- ============================================================
-- STEP 5: Snowflake Postgres 作成（オプション - 推奨）
-- n8n のワークフローとチケットデータの永続化用
-- ============================================================

/*
Snowsight から以下の手順で作成:
1. Admin > Postgres Instances へ移動
2. + Postgres Instance をクリック
3. 設定:
   - Name: HELPDESK_POSTGRES
   - Warehouse: RYOSHIDA_WH
   - Size: XS
   - Admin Password: 強力なパスワードを設定
4. Create をクリック

作成後、接続情報をメモ:
- Host: <YOUR_POSTGRES_HOST>.postgres.snowflake.app
- Port: 5432
- User: snowflake_admin
- Database: postgres
*/

-- ============================================================
-- STEP 6: Secrets 作成
-- ============================================================

-- n8n暗号化キー（ターミナルで生成: openssl rand -hex 32）
CREATE OR REPLACE SECRET HELPDESK_DB.SPCS.N8N_ENCRYPTION_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'ここに32バイトのランダム文字列を入れる';

-- n8n JWTシークレット（ターミナルで生成: openssl rand -hex 32）
CREATE OR REPLACE SECRET HELPDESK_DB.SPCS.N8N_JWT_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'ここに32バイトのランダム文字列を入れる';

-- Postgres接続情報（Snowflake Postgres を使う場合）
CREATE OR REPLACE SECRET HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<YOUR_POSTGRES_HOST>.postgres.snowflake.app';

CREATE OR REPLACE SECRET HELPDESK_DB.SPCS.POSTGRES_PASSWORD_SECRET
  TYPE = PASSWORD
  USERNAME = 'snowflake_admin'
  PASSWORD = 'your-postgres-password';

-- 確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;
-- GENERIC_STRING タイプは secretKeyRef: secret_string を使用
-- PASSWORD タイプは secretKeyRef: password を使用

-- ============================================================
-- STEP 7: ネットワークルール・外部アクセス統合
-- ============================================================

USE ROLE ACCOUNTADMIN;

-- Slack API（Incoming Webhook用）
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SLACK_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    'hooks.slack.com:443'
  );

-- Snowflake API（Cortex Agent用）
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    '*.snowflakecomputing.com:443'
  );

-- Postgres接続用（Snowflake Postgres を使う場合）
-- ※ ホスト名は実際のPostgresインスタンスのホスト名に置き換え
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.POSTGRES_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    '<YOUR_POSTGRES_HOST>.postgres.snowflake.app:5432'
  );

-- 外部アクセス統合
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION HELPDESK_EAI
  ALLOWED_NETWORK_RULES = (
    HELPDESK_DB.SPCS.SLACK_API_RULE,
    HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE,
    HELPDESK_DB.SPCS.POSTGRES_RULE
  )
  ENABLED = TRUE;

-- 権限付与
GRANT USAGE ON INTEGRATION HELPDESK_EAI TO ROLE ACCOUNTADMIN;

-- ============================================================
-- STEP 8: Docker イメージのビルド・プッシュ（ターミナルで実行）
-- ============================================================

/*
ターミナルで以下を実行:

# 1. Snowflake Image Registry にログイン
docker login sfseapac-fsi-japan.registry.snowflakecomputing.com -u FSI_JAPAN

# 2. n8n イメージをビルド・プッシュ
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n
docker build --platform linux/amd64 -t sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest .
docker push sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest

# 3. ticket-app イメージをビルド・プッシュ
# ※ 事前に public フォルダを作成: mkdir -p public && touch public/.gitkeep
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app
docker build --platform linux/amd64 -t sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest .
docker push sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest
*/

-- イメージ確認
SELECT SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/N8N_REPO');
SELECT SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/TICKET_APP_REPO');

-- ============================================================
-- STEP 9: spec.yaml をステージにアップロード（ターミナルで実行）
-- ============================================================

/*
ターミナルで以下を実行:

# snow CLI でアップロード
snow stage copy /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA --overwrite -c fsi_japan_connection

snow stage copy /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app/ticket_app_spec.yaml @HELPDESK_DB.SPCS.TICKET_APP_DATA --overwrite -c fsi_japan_connection

# または snowsql でアップロード
snowsql -c fsi_japan_connection -q "PUT file:///Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA AUTO_COMPRESS=FALSE OVERWRITE=TRUE"
snowsql -c fsi_japan_connection -q "PUT file:///Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app/ticket_app_spec.yaml @HELPDESK_DB.SPCS.TICKET_APP_DATA AUTO_COMPRESS=FALSE OVERWRITE=TRUE"
*/

-- アップロード確認
LIST @HELPDESK_DB.SPCS.N8N_DATA;
LIST @HELPDESK_DB.SPCS.TICKET_APP_DATA;

-- ============================================================
-- STEP 10: n8n サービス作成
-- ============================================================

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE = 'n8n_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- エンドポイント確認（ingress_url をメモ）
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;
-- 例: a7domtc-sfseapac-fsi-japan.snowflakecomputing.app

-- サービス状態確認（READY になるまで待つ）
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.N8N_SVC');

-- ログ確認（エラー時）
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.N8N_SVC', 0, 'n8n', 100);

-- ============================================================
-- STEP 11: ticket-app サービス作成
-- ============================================================

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL TICKET_APP_POOL
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;
-- 例: m4domtc-sfseapac-fsi-japan.snowflakecomputing.app

-- サービス状態確認
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');

-- ログ確認（エラー時）
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.TICKET_APP_SVC', 0, 'ticket-app', 100);

-- ============================================================
-- STEP 12: Postgres テーブル作成（DBeaver等で実行）
-- ============================================================

/*
DBeaver または psql で Postgres に接続し、以下を実行:

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.helpdesk_tickets (
  ticket_id VARCHAR(50) PRIMARY KEY,
  reporter_name VARCHAR(255),
  reporter_employee_id VARCHAR(50),
  location VARCHAR(255),
  issue_type VARCHAR(100),
  urgency VARCHAR(20),
  summary TEXT,
  details JSONB,
  matched_asset_id VARCHAR(50),
  status VARCHAR(50) DEFAULT 'open',
  assigned_to VARCHAR(255),
  resolution_notes TEXT,
  source_channel VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);
*/

-- ============================================================
-- 確認・トラブルシューティング
-- ============================================================

-- 全サービス一覧
SHOW SERVICES IN SCHEMA HELPDESK_DB.SPCS;

-- サービス停止（必要時）
-- ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SUSPEND;
-- ALTER SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC SUSPEND;

-- サービス再起動（必要時）
-- ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC RESUME;
-- ALTER SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC RESUME;

-- サービス削除（設定変更時）
-- DROP SERVICE IF EXISTS HELPDESK_DB.SPCS.N8N_SVC;
-- DROP SERVICE IF EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- Compute Pool 停止（コスト節約）
-- ALTER COMPUTE POOL HELPDESK_POOL STOP ALL;
-- ALTER COMPUTE POOL TICKET_APP_POOL STOP ALL;

-- ============================================================
-- トラブルシューティングメモ
-- ============================================================

/*
よくあるエラーと解決策:

1. readinessProbe エラー
   「Invalid spec: missing 'port' for 'readinessProbe'」
   → spec.yaml の readinessProbe を以下の形式に修正:
     readinessProbe:
       port: 5678
       path: /healthz

2. secretKeyRef エラー
   「Secret key reference xxx does not exist」
   → GENERIC_STRING タイプは secretKeyRef: secret_string
   → PASSWORD タイプは secretKeyRef: password

3. permission denied エラー
   「EACCES: permission denied, open '/home/node/.n8n/config'」
   → spec.yaml から volumeMounts と volumes を削除
   → Postgres がデータ永続化を担当

4. DNS解決エラー
   「getaddrinfo ENOTFOUND xxx.postgres.snowflake.app」
   → POSTGRES_RULE ネットワークルールを追加
   → HELPDESK_EAI に POSTGRES_RULE を含める

5. SSL接続エラー
   「no pg_hba.conf entry for host... no encryption」
   → spec.yaml に以下を追加:
     DB_POSTGRESDB_SSL_ENABLED: "true"
     DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: "false"

6. CPUリソース不足
   「Unschedulable due to insufficient CPU resources」
   → 別の Compute Pool を作成して各サービスを分離
*/
