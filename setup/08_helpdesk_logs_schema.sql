-- helpdesk_logs テーブル (v2)
-- 問い合わせ、AI回答、評価を記録

DROP TABLE IF EXISTS helpdesk_logs;

CREATE TABLE helpdesk_logs (
    id SERIAL PRIMARY KEY,
    log_type VARCHAR(50) NOT NULL,  -- INQUIRY, AI_RESPONSE, EVALUATION
    inquiry_id INTEGER,              -- 元の問い合わせへの参照
    user_id VARCHAR(100),
    channel_id VARCHAR(100),
    thread_ts VARCHAR(100),          -- Slackスレッド識別子
    message TEXT,                    -- 問い合わせ内容
    category VARCHAR(50),
    priority VARCHAR(20),
    summary TEXT,
    ai_response TEXT,                -- AI回答の全文
    evaluation VARCHAR(20),          -- helpful, not_helpful, escalate
    evaluation_comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_helpdesk_logs_log_type ON helpdesk_logs(log_type);
CREATE INDEX idx_helpdesk_logs_thread_ts ON helpdesk_logs(thread_ts);
CREATE INDEX idx_helpdesk_logs_inquiry_id ON helpdesk_logs(inquiry_id);
CREATE INDEX idx_helpdesk_logs_created_at ON helpdesk_logs(created_at);
