-- ============================================
-- Smart Helpdesk PostgreSQL Schema
-- 実行前に既存テーブルを削除する場合はDROP文を有効化
-- ============================================

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================
-- 1. メインログテーブル（問い合わせ・AI回答・評価を統合管理）
-- ============================================
DROP TABLE IF EXISTS app.helpdesk_logs CASCADE;

CREATE TABLE app.helpdesk_logs (
    id SERIAL PRIMARY KEY,
    
    -- 基本情報
    log_type VARCHAR(50) NOT NULL,        -- INQUIRY, AI_RESPONSE, EVALUATION, INFO_RECEIVED
    inquiry_id INTEGER,                    -- 親問い合わせID（AI_RESPONSE/EVALUATIONの場合）
    user_id VARCHAR(100),
    channel_id VARCHAR(100),
    thread_ts VARCHAR(100),
    
    -- 問い合わせ内容
    message TEXT,
    category VARCHAR(50),                  -- IT, HR, FACILITY, etc.
    priority VARCHAR(20),                  -- LOW, MEDIUM, HIGH, CRITICAL
    summary TEXT,
    
    -- AI回答
    ai_response TEXT,                      -- 生の回答
    ai_response_text TEXT,                 -- 人間向け回答テキスト
    resolution_steps JSONB,                -- 解決手順
    needs_escalation BOOLEAN DEFAULT FALSE,
    escalation_team VARCHAR(100),
    
    -- 検索・マッチング
    matched_kb_ids TEXT,
    confidence_scores JSONB,
    
    -- トークン・モデル
    tokens_input INT,
    tokens_output INT,
    model_name VARCHAR(50),
    raw_agent_response JSONB,
    
    -- 会話管理
    turn_number INT DEFAULT 1,
    is_multi_turn BOOLEAN DEFAULT FALSE,
    
    -- 評価
    evaluation VARCHAR(20),                -- resolved, escalate
    evaluation_comment TEXT,
    
    -- ステータス管理
    status VARCHAR(20) DEFAULT 'OPEN',     -- OPEN, IN_PROGRESS, RESOLVED, ESCALATED
    
    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- インデックス
CREATE INDEX idx_logs_log_type ON app.helpdesk_logs(log_type);
CREATE INDEX idx_logs_thread_ts ON app.helpdesk_logs(thread_ts);
CREATE INDEX idx_logs_inquiry_id ON app.helpdesk_logs(inquiry_id);
CREATE INDEX idx_logs_status ON app.helpdesk_logs(status);
CREATE INDEX idx_logs_created_at ON app.helpdesk_logs(created_at);
CREATE INDEX idx_logs_user_id ON app.helpdesk_logs(user_id);

-- ============================================
-- 2. エスカレーションチケットテーブル
-- ============================================
DROP TABLE IF EXISTS app.helpdesk_tickets CASCADE;

CREATE TABLE app.helpdesk_tickets (
    ticket_id VARCHAR(50) PRIMARY KEY,
    
    -- 報告者情報
    reporter_name VARCHAR(255),
    reporter_employee_id VARCHAR(50),
    location VARCHAR(255),
    
    -- チケット内容
    issue_type VARCHAR(100),
    urgency VARCHAR(20),
    summary TEXT,
    details JSONB,
    
    -- 関連情報
    matched_asset_id VARCHAR(50),
    log_id INTEGER REFERENCES app.helpdesk_logs(id),
    thread_ts VARCHAR(100),
    source_channel VARCHAR(50),
    
    -- ステータス
    status VARCHAR(50) DEFAULT 'OPEN',     -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    assigned_to VARCHAR(255),
    resolution_notes TEXT,
    
    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_tickets_status ON app.helpdesk_tickets(status);
CREATE INDEX idx_tickets_log_id ON app.helpdesk_tickets(log_id);
CREATE INDEX idx_tickets_created_at ON app.helpdesk_tickets(created_at);

-- ============================================
-- 3. エスカレーション履歴テーブル（詳細追跡用）
-- ============================================
DROP TABLE IF EXISTS app.escalation_log CASCADE;

CREATE TABLE app.escalation_log (
    escalation_id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) REFERENCES app.helpdesk_tickets(ticket_id),
    log_id INTEGER REFERENCES app.helpdesk_logs(id),
    
    -- 内容
    original_message TEXT,
    ai_response TEXT,
    ai_confidence FLOAT,
    escalation_reason VARCHAR(200),
    escalation_team VARCHAR(50),
    
    -- 対応
    assigned_to VARCHAR(100),
    resolution_notes TEXT,
    feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5),
    
    -- タイムスタンプ
    escalated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_escalation_ticket ON app.escalation_log(ticket_id);
CREATE INDEX idx_escalation_team ON app.escalation_log(escalation_team);

-- ============================================
-- 4. 分析用ビュー
-- ============================================

-- チケットサマリービュー
CREATE OR REPLACE VIEW app.v_ticket_summary AS
SELECT 
    DATE(created_at) as date,
    status,
    issue_type,
    urgency,
    COUNT(*) as ticket_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM app.helpdesk_tickets
GROUP BY DATE(created_at), status, issue_type, urgency;

-- 日次KPIビュー
CREATE OR REPLACE VIEW app.v_daily_kpi AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE log_type = 'INQUIRY') as total_inquiries,
    COUNT(*) FILTER (WHERE log_type = 'AI_RESPONSE') as ai_responses,
    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
    COUNT(*) FILTER (WHERE status = 'ESCALATED') as escalated,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::NUMERIC / 
        NULLIF(COUNT(*) FILTER (WHERE log_type = 'INQUIRY'), 0) * 100, 2
    ) as resolution_rate,
    AVG(tokens_input + tokens_output) FILTER (WHERE log_type = 'AI_RESPONSE') as avg_tokens
FROM app.helpdesk_logs
GROUP BY DATE(created_at);

-- ============================================
-- 確認クエリ
-- ============================================
SELECT 'helpdesk_logs' as table_name, COUNT(*) as columns 
FROM information_schema.columns 
WHERE table_schema = 'app' AND table_name = 'helpdesk_logs'
UNION ALL
SELECT 'helpdesk_tickets', COUNT(*) 
FROM information_schema.columns 
WHERE table_schema = 'app' AND table_name = 'helpdesk_tickets'
UNION ALL
SELECT 'escalation_log', COUNT(*) 
FROM information_schema.columns 
WHERE table_schema = 'app' AND table_name = 'escalation_log';
