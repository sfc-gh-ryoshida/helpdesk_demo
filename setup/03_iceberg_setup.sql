-- ============================================================
-- Iceberg セットアップ（任意）
-- スマート社内ヘルプデスク
-- Step 3: External Volume と Iceberg Tables
-- ※ pg_lakeでPostgres→S3→Snowflake連携する場合のみ実行
-- ============================================================

USE DATABASE HELPDESK_DB;
USE SCHEMA APP;

-- ============================================================
-- 1. External Volume作成（S3用）
-- ※ AWS IAMロールARNは環境に合わせて変更
-- ============================================================

CREATE OR REPLACE EXTERNAL VOLUME helpdesk_iceberg_vol
  STORAGE_LOCATIONS = (
    (
      NAME = 'helpdesk_s3'
      STORAGE_PROVIDER = 'S3'
      STORAGE_BASE_URL = 's3://<your_bucket>/helpdesk/'
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<account_id>:role/<your_role>'
    )
  );

-- Volume確認・IAMロール設定用
DESC EXTERNAL VOLUME helpdesk_iceberg_vol;
-- SNOWFLAKE_IAM_USER をAWS側のTrust Policyに追加

-- ============================================================
-- 2. Iceberg Table作成
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
-- 3. 統計ビュー作成
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
-- Postgres側 pg_lake セットアップ（PostgreSQLクライアントで実行）
-- ============================================================

/*
-- psqlで接続した状態で実行

-- pg_lake拡張をインストール
CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;

-- S3のIceberg出力先を設定
SET pg_lake_iceberg.default_location_prefix = 's3://<your_bucket>/helpdesk/pgdata';

-- チケットデータ用Icebergテーブル
CREATE TABLE public.helpdesk_tickets_iceberg (
    ticket_id           VARCHAR(20)     NOT NULL,
    reporter_name       VARCHAR(100),
    reporter_employee_id VARCHAR(20),
    location            VARCHAR(50),
    issue_type          VARCHAR(20),
    urgency             VARCHAR(10),
    summary             VARCHAR(200),
    status              VARCHAR(20),
    assigned_to         VARCHAR(100),
    source_channel      VARCHAR(20),
    created_at          TIMESTAMPTZ     NOT NULL,
    updated_at          TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ
) USING iceberg;

-- 資産マスター用Icebergテーブル
CREATE TABLE public.asset_master_iceberg (
    asset_id                VARCHAR(20)     NOT NULL,
    asset_type              VARCHAR(20),
    device_name             VARCHAR(100),
    assigned_employee_name  VARCHAR(100),
    location                VARCHAR(50),
    status                  VARCHAR(20),
    asset_description       TEXT
) USING iceberg;

-- pg_cron 定期エクスポート設定
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- エクスポート関数と定期実行設定は04_demo_data.sql参照
*/
