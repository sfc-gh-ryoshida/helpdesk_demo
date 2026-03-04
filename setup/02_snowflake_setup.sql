-- ============================================================
-- Snowflake セットアップ
-- スマート社内ヘルプデスク
-- ============================================================

-- ============================================================
-- 1. データベース・スキーマ作成
-- ============================================================

CREATE DATABASE IF NOT EXISTS HELPDESK_DB;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.APP;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.SPCS;

USE DATABASE HELPDESK_DB;
USE SCHEMA APP;


-- ============================================================
-- 2. External Volume作成（Iceberg用）
-- ============================================================

-- S3用External Volume（AWS IAMロールARNは環境に合わせて変更）
CREATE OR REPLACE EXTERNAL VOLUME helpdesk_iceberg_vol
  STORAGE_LOCATIONS = (
    (
      NAME = 'helpdesk_s3'
      STORAGE_PROVIDER = 'S3'
      STORAGE_BASE_URL = 's3://ryoshida-test/helpdesk/'
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::484577546576:role/ryoshida-s3-integration'
    )
  );

-- Volume確認・IAMロール設定用
DESC EXTERNAL VOLUME helpdesk_iceberg_vol;


-- ============================================================
-- 3. Iceberg Table作成
-- ============================================================

-- チケットデータ参照用Icebergテーブル
CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.HELPDESK_TICKETS_ICE (
    ticket_id INT,
    employee_id VARCHAR,
    employee_name VARCHAR,
    department VARCHAR,
    category VARCHAR,
    priority VARCHAR,
    status VARCHAR,
    subject VARCHAR,
    description TEXT,
    resolution TEXT,
    created_at TIMESTAMP_NTZ,
    updated_at TIMESTAMP_NTZ,
    resolved_at TIMESTAMP_NTZ
)
  EXTERNAL_VOLUME = 'helpdesk_iceberg_vol'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/helpdesk_tickets_iceberg';

-- 資産マスター参照用Icebergテーブル  
CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.ASSET_MASTER_ICE (
    asset_id VARCHAR,
    asset_name VARCHAR,
    asset_type VARCHAR,
    manufacturer VARCHAR,
    model VARCHAR,
    serial_number VARCHAR,
    purchase_date DATE,
    warranty_end_date DATE,
    assigned_to VARCHAR,
    department VARCHAR,
    status VARCHAR,
    location VARCHAR,
    notes TEXT
)
  EXTERNAL_VOLUME = 'helpdesk_iceberg_vol'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/asset_master_iceberg';

-- データ確認
SELECT COUNT(*) FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE;
SELECT COUNT(*) FROM HELPDESK_DB.APP.ASSET_MASTER_ICE;


-- ============================================================
-- 4. 統計ビュー作成
-- ============================================================

-- 日次チケット統計ビュー
CREATE OR REPLACE VIEW HELPDESK_DB.APP.TICKET_STATS_DAILY AS
SELECT 
    DATE_TRUNC('day', created_at) AS ticket_date,
    category,
    priority,
    COUNT(*) AS ticket_count,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_count,
    SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_count,
    AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN TIMESTAMPDIFF('minute', created_at, resolved_at) 
    END) AS avg_resolution_minutes
FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
GROUP BY 1, 2, 3;

-- 部署別集計ビュー
CREATE OR REPLACE VIEW HELPDESK_DB.APP.TICKET_STATS_BY_DEPARTMENT AS
SELECT 
    department,
    category,
    COUNT(*) AS total_tickets,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_tickets,
    SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) AS high_priority_count,
    MAX(created_at) AS last_ticket_at
FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
GROUP BY 1, 2;

-- KPIサマリービュー
CREATE OR REPLACE VIEW HELPDESK_DB.APP.TICKET_KPI_SUMMARY AS
SELECT 
    COUNT(*) AS total_tickets,
    SUM(CASE WHEN DATE(created_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS today_tickets,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_tickets,
    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_tickets,
    SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_tickets,
    SUM(CASE WHEN category = 'HARDWARE' THEN 1 ELSE 0 END) AS hardware_tickets,
    SUM(CASE WHEN category = 'SOFTWARE' THEN 1 ELSE 0 END) AS software_tickets,
    SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) AS high_priority_tickets,
    AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN TIMESTAMPDIFF('minute', created_at, resolved_at) 
    END) AS avg_resolution_minutes
FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE;


-- ============================================================
-- 5. Cortex Search Service作成（資産検索用）
-- ============================================================

CREATE OR REPLACE CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE
  ON asset_search_text
  ATTRIBUTES asset_id, asset_type, department, assigned_to, status
  WAREHOUSE = RYOSHIDA_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT 
        asset_id,
        asset_type,
        asset_name,
        assigned_to,
        department,
        status,
        CONCAT(
            'アセットID: ', asset_id, ' ',
            'タイプ: ', asset_type, ' ',
            'デバイス名: ', COALESCE(asset_name, ''), ' ',
            'メーカー: ', COALESCE(manufacturer, ''), ' ',
            'モデル: ', COALESCE(model, ''), ' ',
            '担当者: ', COALESCE(assigned_to, '未割当'), ' ',
            '部署: ', COALESCE(department, '不明'), ' ',
            '場所: ', COALESCE(location, '不明'), ' ',
            '備考: ', COALESCE(notes, '')
        ) AS asset_search_text
    FROM HELPDESK_DB.APP.ASSET_MASTER_ICE
    WHERE status = 'ACTIVE'
);


-- ============================================================
-- 6. Cortex Agent作成
-- ============================================================

CREATE OR REPLACE AGENT HELPDESK_DB.APP.HELPDESK_AGENT
FROM SPECIFICATION
$$
models:
  orchestration: claude-4-sonnet

instructions:
  system: |
    あなたはヘルプデスクの問い合わせを処理するAIアシスタントです。
    ユーザーからの曖昧な問い合わせを受け取り、以下の情報をJSON形式で抽出してください：
    
    {
      "reporter_name": "報告者名（不明ならnull）",
      "department": "部署（不明ならnull）",
      "category": "HARDWARE|SOFTWARE|ACCOUNT|OTHER",
      "priority": "HIGH|MEDIUM|LOW",
      "summary": "問題の要約（50文字以内）",
      "details": ["個別の問題をリスト形式で"],
      "matched_asset_id": "資産検索で特定した端末ID（不明ならnull）"
    }
    
    緊急度判定基準:
    - HIGH: 業務停止、複数人に影響、セキュリティ関連
    - MEDIUM: 一部機能停止、代替手段あり
    - LOW: 軽微な不具合、質問
    
    報告者名と部署がわかった場合は、資産検索ツールを使って該当する端末IDを特定してください。
    必ずJSON形式のみで回答してください。説明は不要です。

tools:
  - tool_spec:
      type: cortex_search
      name: AssetSearch
      description: 資産マスターから端末情報を検索します

tool_resources:
  AssetSearch:
    name: HELPDESK_DB.APP.ASSET_SEARCH_SERVICE
    max_results: 5
$$;


-- ============================================================
-- 7. MCP Server作成
-- ============================================================

CREATE OR REPLACE MCP SERVER HELPDESK_DB.APP.HELPDESK_MCP_SERVER
  FROM SPECIFICATION $$
    tools:
      - name: "helpdesk-agent"
        type: "CORTEX_AGENT_RUN"
        identifier: "HELPDESK_DB.APP.HELPDESK_AGENT"
        description: "ヘルプデスク問い合わせの意図解釈と資産検索を行うエージェント"
        title: "Helpdesk Agent"

      - name: "asset-search"
        type: "CORTEX_SEARCH_SERVICE_QUERY"
        identifier: "HELPDESK_DB.APP.ASSET_SEARCH_SERVICE"
        description: "従業員名や拠点から端末情報を検索"
        title: "Asset Search"

      - name: "execute-sql"
        type: "SYSTEM_EXECUTE_SQL"
        description: "チケット登録・更新用SQL実行"
        title: "SQL Executor"
  $$;

-- 権限設定
GRANT USAGE ON MCP SERVER HELPDESK_DB.APP.HELPDESK_MCP_SERVER TO ROLE SYSADMIN;
GRANT USAGE ON CORTEX AGENT HELPDESK_DB.APP.HELPDESK_AGENT TO ROLE SYSADMIN;
GRANT USAGE ON CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE TO ROLE SYSADMIN;


-- ============================================================
-- 8. OAuth認証設定（MCP用）
-- ============================================================

-- Security Integration作成（n8nのリダイレクトURLに合わせて変更）
CREATE OR REPLACE SECURITY INTEGRATION HELPDESK_MCP_OAUTH
  TYPE = OAUTH
  OAUTH_CLIENT = CUSTOM
  ENABLED = TRUE
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = 'https://<n8n_endpoint>.snowflakecomputing.app/oauth/callback';

-- クライアントID/Secretを取得（n8n設定時に使用）
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('HELPDESK_MCP_OAUTH');


-- ============================================================
-- 9. SPCS用リソース作成
-- デプロイ先: fsi_japan_connection (SFSEAPAC-FSI_JAPAN)
-- ============================================================

-- イメージリポジトリ（n8n用）
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.N8N_REPO;

-- イメージリポジトリ（ticket-app用）
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_REPO;

SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;

-- 永続化ステージ（n8n用）
CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_DATA
  DIRECTORY = (ENABLE = TRUE);

-- 永続化ステージ（ticket-app用）
CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_DATA
  DIRECTORY = (ENABLE = TRUE);

-- コンピュートプール
CREATE COMPUTE POOL IF NOT EXISTS HELPDESK_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

-- コンピュートプール確認
SHOW COMPUTE POOLS LIKE 'HELPDESK_POOL';


-- ============================================================
-- 9.5 Snowflake Secrets作成（SPCS用）
-- ※ 値は環境に合わせて変更してください
-- ============================================================

-- Postgres接続情報
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<your_postgres_host>.snowflakecomputing.com';

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

-- Secrets確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;


-- ============================================================
-- 10. 外部ネットワーク設定
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
    '*.snowflakecomputing.com:5432'
  );

-- Snowflake MCP Server用
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    '*.snowflakecomputing.com:443'
  );

-- 外部アクセス統合
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION EXTERNAL_ACCESS_N8N_EAI
  ALLOWED_NETWORK_RULES = (
    HELPDESK_DB.SPCS.SLACK_API_RULE,
    HELPDESK_DB.SPCS.POSTGRES_RULE,
    HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  )
  ENABLED = TRUE;

USE ROLE SYSADMIN;
GRANT USAGE ON INTEGRATION EXTERNAL_ACCESS_N8N_EAI TO ROLE SYSADMIN;


-- ============================================================
-- 11. n8nサービス作成
-- ============================================================

-- YAMLをステージにアップロード後に実行
-- snow stage copy n8n/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA --connection fsi_japan_connection

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE = 'n8n_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;

-- サービス状態確認
DESCRIBE SERVICE HELPDESK_DB.SPCS.N8N_SVC;
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.N8N_SVC');


-- ============================================================
-- 12. ticket-appサービス作成
-- ============================================================

-- YAMLをステージにアップロード後に実行
-- snow stage copy ticket-app/ticket_app_spec.yaml @HELPDESK_DB.SPCS.TICKET_APP_DATA --connection fsi_japan_connection

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- サービス状態確認
DESCRIBE SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');


-- ============================================================
-- 13. 動作確認用クエリ
-- ============================================================

-- Icebergテーブル確認
SELECT * FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE LIMIT 10;
SELECT * FROM HELPDESK_DB.APP.ASSET_MASTER_ICE LIMIT 10;

-- 統計ビュー確認
SELECT * FROM HELPDESK_DB.APP.TICKET_STATS_DAILY;
SELECT * FROM HELPDESK_DB.APP.TICKET_STATS_BY_LOCATION;
SELECT * FROM HELPDESK_DB.APP.TICKET_KPI_SUMMARY;

-- Cortex Search テスト
SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
    'HELPDESK_DB.APP.ASSET_SEARCH_SERVICE',
    '田中 第3倉庫',
    {'columns': ['asset_id', 'asset_type', 'assigned_employee_name', 'location'], 'limit': 3}
);

-- Cortex Agent テスト
SELECT SNOWFLAKE.CORTEX.COMPLETE(
    'llama3.1-70b',
    '第3倉庫の田中ですけど、スキャナー落として画面割れました。あとWMSもログインできません'
);
