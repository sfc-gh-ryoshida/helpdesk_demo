-- ============================================================
-- Snowflake Postgres セットアップ
-- スマート社内ヘルプデスク
-- Step 2: Postgresインスタンス作成とスキーマ・テーブル定義
-- ============================================================

-- ============================================================
-- 1. Postgresインスタンス作成（Snowflake側で実行）
-- ============================================================

-- Snowflake Postgresインスタンス作成
CREATE POSTGRES INSTANCE helpdesk_postgres
  INSTANCE_TYPE = 'SMALL'
  STORAGE_SIZE = 100
  POSTGRES_VERSION = '16'
  ADMIN_USER = 'helpdesk_admin'
  ADMIN_PASSWORD = '<secure_password>';  -- 実際のパスワードに変更

-- インスタンス確認
SHOW POSTGRES INSTANCES;

-- 接続情報取得
DESCRIBE POSTGRES INSTANCE helpdesk_postgres;
-- Host と Port をメモして、01_snowflake_base.sql のSecretsを更新

-- ============================================================
-- 以降は psql または PostgreSQLクライアントで実行
-- 接続文字列: postgresql://helpdesk_admin:<password>@<host>:5432/postgres
-- ============================================================

-- ============================================================
-- 2. データベース・スキーマ作成
-- ============================================================

CREATE DATABASE helpdesk_db;

\c helpdesk_db

CREATE SCHEMA app;
SET search_path TO app, public;


-- ============================================================
-- 3. テーブル作成
-- ============================================================

-- シーケンス作成
CREATE SEQUENCE app.ticket_seq START 1;

-- 従業員マスター
CREATE TABLE app.employee_master (
    employee_id VARCHAR(20) PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    location VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_location ON app.employee_master(location);
CREATE INDEX idx_employee_name ON app.employee_master(employee_name);

-- 資産マスター
CREATE TABLE app.asset_master (
    asset_id VARCHAR(20) PRIMARY KEY,
    asset_type VARCHAR(20) CHECK (asset_type IN ('SCANNER', 'PC', 'TABLET', 'PRINTER', 'OTHER')),
    device_name VARCHAR(100),
    serial_number VARCHAR(50),
    assigned_employee_id VARCHAR(20) REFERENCES app.employee_master(employee_id),
    assigned_employee_name VARCHAR(100),
    location VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    purchase_date DATE,
    asset_description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_asset_location ON app.asset_master(location);
CREATE INDEX idx_asset_employee ON app.asset_master(assigned_employee_id);
CREATE INDEX idx_asset_status ON app.asset_master(status);

-- ヘルプデスクチケット
CREATE TABLE app.helpdesk_tickets (
    ticket_id VARCHAR(20) PRIMARY KEY DEFAULT 'TKT-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || LPAD(nextval('app.ticket_seq')::TEXT, 5, '0'),
    reporter_name VARCHAR(100),
    reporter_employee_id VARCHAR(20) REFERENCES app.employee_master(employee_id),
    location VARCHAR(50),
    issue_type VARCHAR(20) CHECK (issue_type IN ('HARDWARE', 'SOFTWARE', 'ACCOUNT', 'OTHER')),
    urgency VARCHAR(10) CHECK (urgency IN ('HIGH', 'MEDIUM', 'LOW')),
    summary VARCHAR(200),
    details JSONB,
    matched_asset_id VARCHAR(20) REFERENCES app.asset_master(asset_id),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    assigned_to VARCHAR(100),
    resolution_notes TEXT,
    source_channel VARCHAR(20),
    source_message_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_ticket_status ON app.helpdesk_tickets(status);
CREATE INDEX idx_ticket_location ON app.helpdesk_tickets(location);
CREATE INDEX idx_ticket_created ON app.helpdesk_tickets(created_at DESC);
CREATE INDEX idx_ticket_urgency ON app.helpdesk_tickets(urgency);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION app.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ticket_updated
    BEFORE UPDATE ON app.helpdesk_tickets
    FOR EACH ROW EXECUTE FUNCTION app.update_timestamp();

-- 対応履歴
CREATE TABLE app.ticket_actions (
    action_id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(20) REFERENCES app.helpdesk_tickets(ticket_id),
    action_type VARCHAR(20) CHECK (action_type IN ('CREATED', 'ASSIGNED', 'UPDATED', 'RESOLVED', 'AUTO_REPLY', 'ESCALATED')),
    action_by VARCHAR(100),
    action_details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_action_ticket ON app.ticket_actions(ticket_id);
CREATE INDEX idx_action_created ON app.ticket_actions(created_at DESC);

-- エスカレーション履歴
CREATE TABLE app.escalation_log (
    escalation_id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(20) REFERENCES app.helpdesk_tickets(ticket_id),
    original_message TEXT,
    ai_response TEXT,
    ai_confidence FLOAT,
    escalation_reason VARCHAR(200),
    escalation_team VARCHAR(50),
    escalated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_to VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_escalation_ticket ON app.escalation_log(ticket_id);
CREATE INDEX idx_escalation_team ON app.escalation_log(escalation_team);

-- AI応答ログ
CREATE TABLE app.ai_response_log (
    response_id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(20) REFERENCES app.helpdesk_tickets(ticket_id),
    user_message TEXT,
    matched_kb_ids TEXT,
    search_score FLOAT,
    ai_response TEXT,
    confidence_score FLOAT,
    was_helpful BOOLEAN,
    response_time_ms INT,
    escalated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_response_ticket ON app.ai_response_log(ticket_id);


-- ============================================================
-- 4. サンプルデータ投入
-- ============================================================

-- 従業員マスター
INSERT INTO app.employee_master (employee_id, employee_name, department, location, email, phone) VALUES
    ('EMP001', '田中太郎', '倉庫部', '第3倉庫', 'tanaka@example.com', '090-1234-5678'),
    ('EMP002', '佐藤花子', '倉庫部', '第1倉庫', 'sato@example.com', '090-2345-6789'),
    ('EMP003', '鈴木一郎', '配送部', '本社', 'suzuki@example.com', '090-3456-7890'),
    ('EMP004', '山田次郎', '倉庫部', '第2倉庫', 'yamada@example.com', '090-4567-8901'),
    ('EMP005', '高橋美咲', '情報システム部', '本社', 'takahashi@example.com', '090-5678-9012');

-- 資産マスター
INSERT INTO app.asset_master (asset_id, asset_type, device_name, serial_number, assigned_employee_id, assigned_employee_name, location, status, purchase_date, asset_description) VALUES
    ('DEV-00123', 'SCANNER', 'Zebra TC52', 'SN-ABC123', 'EMP001', '田中太郎', '第3倉庫', 'ACTIVE', '2023-01-15', 'ハンディスキャナー 倉庫業務用'),
    ('DEV-00124', 'PC', 'Dell Latitude 5520', 'SN-DEF456', 'EMP002', '佐藤花子', '第1倉庫', 'ACTIVE', '2023-03-20', 'ノートPC 在庫管理用'),
    ('DEV-00125', 'TABLET', 'iPad Pro 11', 'SN-GHI789', 'EMP003', '鈴木一郎', '本社', 'ACTIVE', '2023-06-01', '業務用タブレット 配送確認用'),
    ('DEV-00126', 'SCANNER', 'Zebra TC52', 'SN-JKL012', 'EMP004', '山田次郎', '第2倉庫', 'ACTIVE', '2023-02-10', 'ハンディスキャナー 倉庫業務用'),
    ('DEV-00127', 'PC', 'HP EliteBook 840', 'SN-MNO345', 'EMP005', '高橋美咲', '本社', 'ACTIVE', '2023-04-15', 'ノートPC 情シス管理用'),
    ('DEV-00128', 'PRINTER', 'Brother HL-L2370DW', 'SN-PQR678', NULL, NULL, '第3倉庫', 'ACTIVE', '2022-11-20', '共有プリンター');

-- サンプルチケット
INSERT INTO app.helpdesk_tickets (ticket_id, reporter_name, reporter_employee_id, location, issue_type, urgency, summary, details, matched_asset_id, status, source_channel, created_at) VALUES
    ('TKT-20260225-00001', '佐藤花子', 'EMP002', '第1倉庫', 'SOFTWARE', 'MEDIUM', 'WMSにログインできない', '["WMSログインエラー", "パスワードリセット希望"]'::jsonb, 'DEV-00124', 'RESOLVED', 'SLACK', NOW() - INTERVAL '2 days'),
    ('TKT-20260225-00002', '山田次郎', 'EMP004', '第2倉庫', 'HARDWARE', 'LOW', 'スキャナーのバッテリー持ちが悪い', '["バッテリー劣化の可能性"]'::jsonb, 'DEV-00126', 'IN_PROGRESS', 'TEAMS', NOW() - INTERVAL '1 day'),
    ('TKT-20260226-00001', '鈴木一郎', 'EMP003', '本社', 'ACCOUNT', 'HIGH', '退職者アカウントの無効化依頼', '["セキュリティ対応", "即時対応必要"]'::jsonb, NULL, 'OPEN', 'SLACK', NOW() - INTERVAL '3 hours');


-- ============================================================
-- 5. ユーティリティ関数
-- ============================================================

-- チケット登録関数
CREATE OR REPLACE FUNCTION app.create_ticket(
    p_reporter_name VARCHAR,
    p_reporter_employee_id VARCHAR,
    p_location VARCHAR,
    p_issue_type VARCHAR,
    p_urgency VARCHAR,
    p_summary VARCHAR,
    p_details JSONB,
    p_matched_asset_id VARCHAR,
    p_source_channel VARCHAR,
    p_source_message_id VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_ticket_id VARCHAR;
BEGIN
    INSERT INTO app.helpdesk_tickets (
        reporter_name, reporter_employee_id, location, issue_type, 
        urgency, summary, details, matched_asset_id, 
        source_channel, source_message_id
    ) VALUES (
        p_reporter_name, p_reporter_employee_id, p_location, p_issue_type,
        p_urgency, p_summary, p_details, p_matched_asset_id,
        p_source_channel, p_source_message_id
    ) RETURNING ticket_id INTO v_ticket_id;
    
    INSERT INTO app.ticket_actions (ticket_id, action_type, action_by, action_details)
    VALUES (v_ticket_id, 'CREATED', 'SYSTEM', 'チケット自動作成: ' || p_source_channel);
    
    RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- チケット更新関数
CREATE OR REPLACE FUNCTION app.update_ticket_status(
    p_ticket_id VARCHAR,
    p_status VARCHAR,
    p_assigned_to VARCHAR DEFAULT NULL,
    p_resolution_notes TEXT DEFAULT NULL,
    p_action_by VARCHAR DEFAULT 'SYSTEM'
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app.helpdesk_tickets
    SET 
        status = p_status,
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
        resolved_at = CASE WHEN p_status IN ('RESOLVED', 'CLOSED') THEN CURRENT_TIMESTAMP ELSE resolved_at END
    WHERE ticket_id = p_ticket_id;
    
    IF FOUND THEN
        INSERT INTO app.ticket_actions (ticket_id, action_type, action_by, action_details)
        VALUES (p_ticket_id, 'UPDATED', p_action_by, 'ステータス変更: ' || p_status);
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 6. n8n用ユーザー作成（任意）
-- ============================================================

-- CREATE USER n8n_user WITH PASSWORD '<n8n_user_password>';
-- GRANT CONNECT ON DATABASE helpdesk_db TO n8n_user;
-- GRANT USAGE ON SCHEMA app TO n8n_user;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO n8n_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO n8n_user;
