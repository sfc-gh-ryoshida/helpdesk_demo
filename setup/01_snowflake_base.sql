-- ============================================================
-- Snowflake 基盤セットアップ
-- スマート社内ヘルプデスク
-- Step 1: データベース、スキーマ、リポジトリ、ステージ、シークレット
-- ============================================================

-- ============================================================
-- 1. データベース・スキーマ作成
-- ============================================================

CREATE DATABASE IF NOT EXISTS HELPDESK_DB;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.APP;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.SPCS;

USE DATABASE HELPDESK_DB;

-- ============================================================
-- 2. コンピュートプール作成
-- ============================================================

CREATE COMPUTE POOL IF NOT EXISTS HELPDESK_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

-- 別サービス用（任意：リソース分離する場合）
CREATE COMPUTE POOL IF NOT EXISTS TICKET_APP_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

-- 起動確認（IDLEまたはACTIVEになるまで待つ）
SHOW COMPUTE POOLS LIKE '%POOL';

-- ============================================================
-- 3. イメージリポジトリ作成
-- ============================================================

CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.N8N_REPO;
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_REPO;

-- 確認（repository_url をメモ）
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;
-- sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo
-- sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo

-- ============================================================
-- 4. ステージ作成（spec.yaml用）
-- ============================================================

CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_DATA
  DIRECTORY = (ENABLE = TRUE);

CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_DATA
  DIRECTORY = (ENABLE = TRUE);

-- Streamlit用ステージ
CREATE STAGE IF NOT EXISTS HELPDESK_DB.APP.STREAMLIT_STAGE
  DIRECTORY = (ENABLE = TRUE);

-- ============================================================
-- 5. Snowflake Secrets作成
-- ※ 値は環境に合わせて変更してください
-- ============================================================

-- Postgres接続情報（Step 2完了後に正しい値に更新）
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<your_postgres_host>.postgres.snowflake.app';

CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_USER_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'helpdesk_admin';

CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_PASSWORD_SECRET
  TYPE = PASSWORD
  USERNAME = 'helpdesk_admin'
  PASSWORD = '<your_postgres_password>';

-- n8n暗号化キー（openssl rand -hex 32 で生成）
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.N8N_ENCRYPTION_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<your_32_char_encryption_key>';

-- n8n JWTシークレット（openssl rand -hex 32 で生成）
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.N8N_JWT_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<your_jwt_secret>';

-- Slack Bot Token（Slack App管理画面で取得: xoxb-...）
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.SLACK_BOT_TOKEN_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'xoxb-your-slack-bot-token';

-- Secrets確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;

-- Secret値更新の例:
-- ALTER SECRET HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
--   SET SECRET_STRING = 'actual-postgres-host.postgres.snowflake.app';

-- ============================================================
-- 6. 外部ネットワーク設定
-- ============================================================

USE ROLE ACCOUNTADMIN;

-- Slack API
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SLACK_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    'slack.com:443',
    '*.slack.com:443',
    'hooks.slack.com:443',
    'files.slack.com:443'
  );

-- Snowflake Postgres接続用
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.POSTGRES_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    '*.postgres.snowflake.app:5432'
  );

-- Snowflake API用（MCP Server, Cortex等）
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    '*.snowflakecomputing.com:443'
  );

-- 外部アクセス統合
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION HELPDESK_EAI
  ALLOWED_NETWORK_RULES = (
    HELPDESK_DB.SPCS.SLACK_API_RULE,
    HELPDESK_DB.SPCS.POSTGRES_RULE,
    HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  )
  ENABLED = TRUE;

-- 権限設定
GRANT USAGE ON INTEGRATION HELPDESK_EAI TO ROLE ACCOUNTADMIN;
GRANT USAGE ON INTEGRATION HELPDESK_EAI TO ROLE SYSADMIN;

-- ============================================================
-- 確認クエリ
-- ============================================================

SHOW COMPUTE POOLS;
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;
SHOW STAGES IN SCHEMA HELPDESK_DB.SPCS;
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;
SHOW NETWORK RULES IN SCHEMA HELPDESK_DB.SPCS;
SHOW EXTERNAL ACCESS INTEGRATIONS;
