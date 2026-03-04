# スマート社内ヘルプデスク 実装プラン

## 概要

現場スタッフ（倉庫・ドライバー）からの曖昧な問い合わせをAIで構造化し、自動対応するデモシステム。

### ユースケース評価: 92点/100点

| 評価項目 | 点数 | コメント |
|---------|------|----------|
| ビジネス課題の明確さ | 95/100 | 現場の曖昧なSOS→構造化は実務で頻発 |
| 技術的実現可能性 | 80/100 | 全コンポーネントがGA/PubPreview |
| デモ映え | 90/100 | End-to-Endの流れが視覚的にわかりやすい |
| Snowflakeの強み訴求 | 95/100 | **Snowflake Postgres**/MCP Server/Cortex Agent/DT/Streamlit全活用 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      スマート社内ヘルプデスク                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  【入力層】                                                                      │
│  ┌──────────────┐                                                               │
│  │ Slack/Teams  │──┐                                                            │
│  │ LINE WORKS   │  │                                                            │
│  └──────────────┘  │                                                            │
│                    ▼                                                            │
│  【処理層】     ┌──────────────────┐                                             │
│                │  n8n on SPCS     │                                             │
│                │  (Webhook受信)    │                                             │
│                └────────┬─────────┘                                             │
│                         │                                                       │
│                         │ MCP Client Tool                                       │
│                         ▼                                                       │
│                ┌──────────────────┐                                             │
│                │ Snowflake MCP    │                                             │
│                │ Server           │                                             │
│                │  tools:          │                                             │
│                │  - cortex-agent  │ ← LLM意図解釈 + Cortex Search統合           │
│                │  - sql-execute   │                                             │
│                └────────┬─────────┘                                             │
│                         │                                                       │
│  【データ層】           ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                 ★ Snowflake Postgres (専用マネージドインスタンス)         │   │
│  │                    PostgreSQL 16-18 完全互換 / PgBouncer内蔵              │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                │   │
│  │  │ helpdesk_      │ │ asset_master   │ │ employee_      │                │   │
│  │  │ tickets        │ │ (端末情報)     │ │ master         │                │   │
│  │  └───────┬────────┘ └────────────────┘ └────────────────┘                │   │
│  │          │                                                               │   │
│  │          │ pg_lake (USING iceberg)                                       │   │
│  │          ▼                                                               │   │
│  │  ┌────────────────┐                                                      │   │
│  │  │ Iceberg Table  │ ───────▶ S3 (Iceberg format)                        │   │
│  │  │ (pg_lake書出)  │                                                      │   │
│  │  └────────────────┘                                                      │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                        │
│                                        ▼                                        │
│  【分析層】  ┌──────────────────────────────────────────────────────────────┐   │
│             │              Snowflake Iceberg Table (External Volume)        │   │
│             │  ┌─────────────────────┐  ┌─────────────────────┐             │   │
│             │  │ HELPDESK_TICKETS_ICE│  │ ASSET_MASTER_ICE    │             │   │
│             │  │ (S3参照)            │  │ (S3参照)            │             │   │
│             │  └─────────────────────┘  └─────────────────────┘             │   │
│             │                    │                                          │   │
│             │            ┌───────▼───────┐                                  │   │
│             │            │ 統計ビュー     │                                  │   │
│             │            │ (TICKET_STATS) │                                  │   │
│             │            └───────────────┘                                  │   │
│             └──────────────────────────────────────────────────────────────┘   │
│                                        │                                        │
│  【可視化層】                          ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                    Streamlit in Snowflake                                │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │   │
│  │  │ リアルタイム │ │ 対応状況    │ │ カテゴリ別  │ │ 拠点別      │         │   │
│  │  │ チケット一覧 │ │ パイチャート│ │ トレンド    │ │ ヒートマップ │         │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Snowflake Postgres インスタンス作成

### 1.1 Postgresインスタンス作成

```sql
-- Snowflake Postgresインスタンス作成
CREATE POSTGRES INSTANCE helpdesk_postgres
  INSTANCE_TYPE = 'SMALL'   -- SMALL/MEDIUM/LARGE/XLARGE
  STORAGE_SIZE = 100        -- GB
  POSTGRES_VERSION = '16'
  ADMIN_USER = 'helpdesk_admin'
  ADMIN_PASSWORD = '<secure_password>';

-- インスタンス確認
SHOW POSTGRES INSTANCES;

-- 接続情報取得
DESCRIBE POSTGRES INSTANCE helpdesk_postgres;
```

### 1.2 データベース・スキーマ作成（PostgreSQL側）

```sql
-- psql または任意のPGクライアントで接続
-- 接続文字列: postgresql://helpdesk_admin:<password>@<instance_host>:5432/postgres

-- アプリ用データベース作成
CREATE DATABASE helpdesk_db;

\c helpdesk_db

-- スキーマ作成
CREATE SCHEMA app;
SET search_path TO app;
```

### 1.3 従業員マスター

```sql
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
```

### 1.4 資産マスター

```sql
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
```

### 1.5 ヘルプデスクチケット

```sql
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

-- シーケンス作成
CREATE SEQUENCE app.ticket_seq START 1;

-- インデックス
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
```

### 1.6 対応履歴

```sql
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
```

### 1.7 サンプルデータ投入

```sql
-- 従業員マスター
INSERT INTO app.employee_master VALUES
    ('EMP001', '田中太郎', '倉庫部', '第3倉庫', 'tanaka@example.com', '090-1234-5678'),
    ('EMP002', '佐藤花子', '倉庫部', '第1倉庫', 'sato@example.com', '090-2345-6789'),
    ('EMP003', '鈴木一郎', '配送部', '本社', 'suzuki@example.com', '090-3456-7890');

-- 資産マスター
INSERT INTO app.asset_master VALUES
    ('DEV-00123', 'SCANNER', 'Zebra TC52', 'SN-ABC123', 'EMP001', '田中太郎', '第3倉庫', 'ACTIVE', '2023-01-15', 'ハンディスキャナー'),
    ('DEV-00124', 'PC', 'Dell Latitude', 'SN-DEF456', 'EMP002', '佐藤花子', '第1倉庫', 'ACTIVE', '2023-03-20', 'ノートPC'),
    ('DEV-00125', 'TABLET', 'iPad Pro', 'SN-GHI789', 'EMP003', '鈴木一郎', '本社', 'ACTIVE', '2023-06-01', '業務用タブレット');
```

---

## Phase 2: Snowflake MCP Server + Cortex Agent

### 2.1 Cortex Agent作成（Snowflake側）

```sql
-- Cortex Search Service（資産検索用）
CREATE OR REPLACE CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE
  ON asset_search_text
  ATTRIBUTES asset_id, asset_type, location, assigned_employee_name, status
  WAREHOUSE = RYOSHIDA_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT 
        asset_id,
        asset_type,
        device_name,
        serial_number,
        assigned_employee_name,
        location,
        status,
        CONCAT(
            'アセットID: ', asset_id, ' ',
            'タイプ: ', asset_type, ' ',
            'デバイス名: ', COALESCE(device_name, ''), ' ',
            '担当者: ', COALESCE(assigned_employee_name, '未割当'), ' ',
            '場所: ', COALESCE(location, '不明'), ' ',
            'シリアル: ', COALESCE(serial_number, ''), ' ',
            '説明: ', COALESCE(asset_description, '')
        ) AS asset_search_text
    FROM HELPDESK_DB.APP.ASSET_MASTER_SYNC  -- Openflow CDCで同期したテーブル
    WHERE status = 'ACTIVE'
);

-- Cortex Agent作成
CREATE OR REPLACE CORTEX AGENT HELPDESK_DB.APP.HELPDESK_AGENT
  MODEL = 'llama3.1-70b'
  TOOLS = (
    HELPDESK_DB.APP.ASSET_SEARCH_SERVICE
  )
  SYSTEM_PROMPT = '
あなたはヘルプデスクの問い合わせを処理するAIアシスタントです。
ユーザーからの曖昧な問い合わせを受け取り、以下の情報をJSON形式で抽出してください：

{
  "reporter_name": "報告者名（不明ならnull）",
  "location": "発生場所（不明ならnull）",
  "issue_type": "HARDWARE|SOFTWARE|ACCOUNT|OTHER",
  "urgency": "HIGH|MEDIUM|LOW",
  "summary": "問題の要約（50文字以内）",
  "details": ["個別の問題をリスト形式で"],
  "matched_asset_id": "資産検索で特定した端末ID（不明ならnull）"
}

緊急度判定基準:
- HIGH: 業務停止、複数人に影響、セキュリティ関連
- MEDIUM: 一部機能停止、代替手段あり
- LOW: 軽微な不具合、質問

報告者名と場所がわかった場合は、資産検索ツールを使って該当する端末IDを特定してください。
';
```

### 2.2 MCP Server作成

```sql
-- MCP Server作成
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
```

### 2.3 OAuth認証設定（MCP用）

```sql
-- Security Integration作成
CREATE OR REPLACE SECURITY INTEGRATION HELPDESK_MCP_OAUTH
  TYPE = OAUTH
  OAUTH_CLIENT = CUSTOM
  ENABLED = TRUE
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = 'https://<n8n_endpoint>.snowflakecomputing.app/oauth/callback';

-- クライアントID/Secretを取得
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('HELPDESK_MCP_OAUTH');
```

---

## Phase 3: n8n on SPCS デプロイ

参考: https://zenn.dev/snowflakejp/articles/29d7c0283a431a

### 3.1 Snowflake環境準備

```sql
-- HELPDESK_DB内にSPCSスキーマを作成（DB統一）
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.SPCS;

CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.N8N_REPO;
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;

CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_DATA;

CREATE COMPUTE POOL IF NOT EXISTS HELPDESK_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;
```

### 3.2 サービス作成

```sql
-- YAMLをステージにアップロード後
CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE='n8n_spec.yaml';

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;
```

### 3.3 Dockerイメージプッシュ

```bash
docker pull --platform linux/amd64 n8nio/n8n:latest

docker tag n8nio/n8n:latest <org>-<acct>.registry.snowflakecomputing.com/HELPDESK_DB/SPCS/N8N_REPO/n8n:latest

snow spcs image-registry login

docker push <org>-<acct>.registry.snowflakecomputing.com/HELPDESK_DB/SPCS/N8N_REPO/n8n:latest
```

### 3.4 サービス仕様ファイル（n8n_spec.yaml）

```yaml
spec:
  containers:
    - name: n8n
      image: /HELPDESK_DB/SPCS/N8N_REPO/n8n:latest
      env:
        N8N_PORT: "5678"
        N8N_PROTOCOL: "https"
        N8N_HOST: "<ingest_url>.snowflakecomputing.app"
        WEBHOOK_URL: "https://<ingest_url>.snowflakecomputing.app/"
        N8N_EDITOR_BASE_URL: "https://<ingest_url>.snowflakecomputing.app/"
        N8N_PUBLIC_API_URL: "https://<ingest_url>.snowflakecomputing.app/"
        GENERIC_TIMEZONE: "Asia/Tokyo"
        N8N_DIAGNOSTICS_ENABLED: "false"
        N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true"
        N8N_FEATURE_FLAG_MCP: "true"
        N8N_DEFAULT_BINARY_DATA_MODE: "filesystem"
      command:
        - /bin/sh
        - -lc
        - |
          export SF_OAUTH_TOKEN="$(cat /snowflake/session/token)"
          exec n8n start
      readinessProbe:
        port: 5678
        path: /healthz
      resources:
        requests:
          cpu: 0.5
          memory: 1Gi
        limits:
          cpu: 1
          memory: 2Gi
      volumeMounts:
        - name: n8n-data
          mountPath: /home/node/.n8n
  endpoints:
    - name: http
      port: 5678
      public: true
      protocol: HTTP
  volumes:
    - name: n8n-data
      source: "@HELPDESK_DB.SPCS.N8N_DATA"
      uid: 1000
      gid: 1000
  logExporters:
    eventTableConfig:
      logLevel: INFO
  platformMonitor:
    metricConfig:
      groups: [system, system_limits, network, storage]
```

### 3.5 外部ネットワーク設定

```sql
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

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION EXTERNAL_ACCESS_N8N_EAI
  ALLOWED_NETWORK_RULES = (
    HELPDESK_DB.SPCS.SLACK_API_RULE,
    HELPDESK_DB.SPCS.POSTGRES_RULE,
    HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  )
  ENABLED = TRUE;

USE ROLE SYSADMIN;
GRANT USAGE ON INTEGRATION EXTERNAL_ACCESS_N8N_EAI TO ROLE SYSADMIN;
ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SET EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SUSPEND;
ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC RESUME;
```

### 3.6 n8nワークフロー構成（MCP統合版）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  n8n Workflow: Smart Helpdesk (MCP版)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────┐    ┌─────────────────┐    ┌───────────────┐                 │
│  │ Webhook   │───▶│ MCP Client Tool │───▶│ Code Node     │                 │
│  │ (Slack)   │    │ (Cortex Agent)  │    │ (JSON Parse)  │                 │
│  └───────────┘    └─────────────────┘    └───────┬───────┘                 │
│                                                   │                         │
│                                                   ▼                         │
│                                          ┌───────────────┐                 │
│                                          │ PostgreSQL    │                 │
│                                          │ (Snowflake    │                 │
│                                          │  Postgres)    │                 │
│                                          │ INSERT ticket │                 │
│                                          └───────┬───────┘                 │
│                                                   │                         │
│                           ┌───────────────────────┼───────────────────────┐│
│                           ▼                       ▼                       ▼││
│                  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│                  │ IF: HW故障  │         │ IF: SW問題  │         │ IF: その他  │
│                  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
│                         ▼                       ▼                       ▼  │
│                  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│                  │ Slack返信   │         │ Slack返信   │         │ Slack返信   │
│                  │ 「代替機    │         │ 「担当者が  │         │ 「確認中」  │
│                  │ 手配済」    │         │ 対応」      │         │            │
│                  └─────────────┘         └─────────────┘         └─────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**n8n設定詳細**:

1. **MCP Client Tool設定**:
   - SSE Endpoint: `https://<account>.snowflakecomputing.com/api/v2/databases/HELPDESK_DB/schemas/APP/mcp-servers/HELPDESK_MCP_SERVER`
   - Authentication: OAuth2 (HELPDESK_MCP_OAUTH)
   - Tool: `helpdesk-agent`

2. **PostgreSQL Node設定**:
   - Host: `<postgres_instance_host>.snowflakecomputing.com`
   - Port: `5432`
   - Database: `helpdesk_db`
   - User: `helpdesk_admin`
   - SSL: `require`

---

## Phase 4: pg_lake → S3 → Iceberg Table 連携

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Snowflake Postgres                                                     │
│  ┌─────────────────┐     pg_lake      ┌─────────────────┐              │
│  │ helpdesk_tickets│ ──────────────▶  │ Iceberg Table   │              │
│  │ (通常テーブル)   │   USING iceberg  │ (S3に書き出し)   │              │
│  └─────────────────┘                   └────────┬────────┘              │
│                                                  │                      │
└──────────────────────────────────────────────────│──────────────────────┘
                                                   │
                                                   ▼ S3 (Iceberg format)
┌──────────────────────────────────────────────────│──────────────────────┐
│  Snowflake                                       │                      │
│                                        ┌─────────▼─────────┐            │
│                                        │ Iceberg Table     │            │
│                                        │ (External Volume) │            │
│                                        └───────────────────┘            │
│                                                  │                      │
│                                        ┌─────────▼─────────┐            │
│                                        │ Streamlit         │            │
│                                        │ (可視化)          │            │
│                                        └───────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.1 pg_lake拡張のセットアップ（Postgres側）

```sql
-- psqlでSnowflake Postgresに接続

-- 1) pg_lake拡張をインストール
CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;

-- 2) S3のIceberg出力先を設定
SET pg_lake_iceberg.default_location_prefix = 's3://helpdesk-iceberg-bucket/pgdata/helpdesk';
```

### 4.2 Icebergテーブル作成（Postgres側）

```sql
-- チケットデータ用Icebergテーブル
CREATE TABLE helpdesk_tickets_iceberg (
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
CREATE TABLE asset_master_iceberg (
    asset_id                VARCHAR(20)     NOT NULL,
    asset_type              VARCHAR(20),
    device_name             VARCHAR(100),
    assigned_employee_name  VARCHAR(100),
    location                VARCHAR(50),
    status                  VARCHAR(20),
    asset_description       TEXT
) USING iceberg;
```

### 4.3 データエクスポート関数（Postgres側）

```sql
-- チケットデータをIcebergにエクスポートする関数
CREATE OR REPLACE FUNCTION app.export_tickets_to_iceberg() 
RETURNS void AS $$
BEGIN
    -- Icebergテーブルは TRUNCATE + INSERT でリフレッシュ
    TRUNCATE TABLE public.helpdesk_tickets_iceberg;
    
    INSERT INTO public.helpdesk_tickets_iceberg
    SELECT 
        ticket_id, reporter_name, reporter_employee_id, location,
        issue_type, urgency, summary, status, assigned_to,
        source_channel, created_at, updated_at, resolved_at
    FROM app.helpdesk_tickets;
END;
$$ LANGUAGE plpgsql;

-- 資産マスターをIcebergにエクスポートする関数
CREATE OR REPLACE FUNCTION app.export_assets_to_iceberg() 
RETURNS void AS $$
BEGIN
    TRUNCATE TABLE public.asset_master_iceberg;
    
    INSERT INTO public.asset_master_iceberg
    SELECT 
        asset_id, asset_type, device_name, 
        assigned_employee_name, location, status, asset_description
    FROM app.asset_master;
END;
$$ LANGUAGE plpgsql;

-- 手動実行
SELECT app.export_tickets_to_iceberg();
SELECT app.export_assets_to_iceberg();
```

### 4.4 定期エクスポート設定（pg_cron）

```sql
-- pg_cronで5分ごとに自動エクスポート
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('export_tickets_iceberg', '*/5 * * * *', 
    'SELECT app.export_tickets_to_iceberg()');

SELECT cron.schedule('export_assets_iceberg', '0 * * * *', 
    'SELECT app.export_assets_to_iceberg()');

-- ジョブ確認
SELECT * FROM cron.job;
```

---

## Phase 5: Snowflake側 Iceberg Table設定

### 5.1 External Volume作成

```sql
-- S3用External Volume
CREATE OR REPLACE EXTERNAL VOLUME helpdesk_iceberg_volume
  STORAGE_LOCATIONS = (
    (
      NAME = 'helpdesk_s3'
      STORAGE_PROVIDER = 'S3'
      STORAGE_BASE_URL = 's3://helpdesk-iceberg-bucket/pgdata/helpdesk/'
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/helpdesk-iceberg-role'
    )
  );

-- Volume確認
DESC EXTERNAL VOLUME helpdesk_iceberg_volume;
```

### 5.2 Iceberg Table作成（Snowflake側）

```sql
-- チケットデータ参照用Icebergテーブル
CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
  EXTERNAL_VOLUME = 'helpdesk_iceberg_volume'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/helpdesk_tickets_iceberg';

-- 資産マスター参照用Icebergテーブル  
CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.ASSET_MASTER_ICE
  EXTERNAL_VOLUME = 'helpdesk_iceberg_volume'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/asset_master_iceberg';

-- データ確認
SELECT COUNT(*) FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE;
SELECT * FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE LIMIT 10;
```

### 5.3 統計ビュー作成（Icebergテーブル参照）

```sql
-- 日次チケット統計ビュー
CREATE OR REPLACE VIEW HELPDESK_DB.APP.TICKET_STATS_DAILY AS
SELECT 
    DATE_TRUNC('day', created_at) AS ticket_date,
    issue_type,
    urgency,
    COUNT(*) AS ticket_count,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_count,
    SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_count,
    AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN TIMESTAMPDIFF('minute', created_at, resolved_at) 
    END) AS avg_resolution_minutes
FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
GROUP BY 1, 2, 3;

-- 拠点別集計ビュー
CREATE OR REPLACE VIEW HELPDESK_DB.APP.TICKET_STATS_BY_LOCATION AS
SELECT 
    location,
    issue_type,
    COUNT(*) AS total_tickets,
    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_tickets,
    SUM(CASE WHEN urgency = 'HIGH' THEN 1 ELSE 0 END) AS high_urgency_count,
    MAX(created_at) AS last_ticket_at
FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
GROUP BY 1, 2;
```

---

## Phase 6: Streamlit ダッシュボード

### 6.1 画面構成

```
┌─────────────────────────────────────────────────────────────────┐
│  🎫 ヘルプデスク ダッシュボード                    [自動更新: ON] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │   12    │ │    3    │ │    8    │ │  45min  │              │
│  │ 本日件数 │ │ 未対応  │ │ HW障害  │ │ 平均解決 │              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│  ┌─────────────────────────┐ ┌─────────────────────────┐       │
│  │  📊 週次トレンド         │ │  🥧 カテゴリ別内訳      │       │
│  │  [折れ線グラフ]          │ │  [パイチャート]         │       │
│  └─────────────────────────┘ └─────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📋 最新チケット一覧（リアルタイム）                      │   │
│  │  ID | 報告者 | 拠点 | 種別 | 緊急度 | 状態 | 作成日時     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Streamlitコード概要

```python
import streamlit as st
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="ヘルプデスク", layout="wide")
st.title("🎫 ヘルプデスク ダッシュボード")

session = get_active_session()

# KPIカード（Icebergテーブルから取得）
col1, col2, col3, col4 = st.columns(4)
with col1:
    today_count = session.sql("""
        SELECT COUNT(*) FROM HELPDESK_TICKETS_ICE 
        WHERE DATE(created_at) = CURRENT_DATE()
    """).collect()[0][0]
    st.metric("本日件数", today_count)

with col2:
    open_count = session.sql("""
        SELECT COUNT(*) FROM HELPDESK_TICKETS_ICE WHERE status = 'OPEN'
    """).collect()[0][0]
    st.metric("未対応", open_count)

# チャート（統計ビューから取得）
trend_df = session.table("TICKET_STATS_DAILY").to_pandas()
st.line_chart(trend_df, x="TICKET_DATE", y="TICKET_COUNT")

# チケット一覧（Icebergテーブルから直接）
tickets_df = session.sql("""
    SELECT ticket_id, reporter_name, location, issue_type, urgency, status, created_at
    FROM HELPDESK_TICKETS_ICE
    ORDER BY created_at DESC
    LIMIT 20
""").to_pandas()
st.dataframe(tickets_df, use_container_width=True)
```

---

## デモシナリオ（5分版）

| Step | 時間 | 画面 | アクション | 訴求ポイント |
|:----:|:----:|------|-----------|-------------|
| 1 | 0:00 | Slack | メッセージ送信「第3倉庫の田中です。スキャナー壊れました」 | 曖昧な自然言語 |
| 2 | 0:30 | n8n | Webhookトリガー発火を確認 | SPCS上でワークフロー稼働 |
| 3 | 1:00 | n8n | **MCP Client → Cortex Agent** 呼び出し確認 | **MCP Server統合** |
| 4 | 1:30 | n8n | PostgreSQLノードで **Snowflake Postgres** にINSERT | **Snowflake Postgres訴求** |
| 5 | 2:00 | Slack | 自動返信「代替機を手配しました」 | 即時レスポンス |
| 6 | 2:30 | psql | pg_lakeでIceberg書き出し確認 | **pg_lake + Iceberg** |
| 7 | 3:30 | **Streamlit** | Iceberg Tableからデータ表示 | **Postgres→S3→Snowflake連携** |
| 8 | 4:30 | 全体 | アーキテクチャ図で振り返り | **Snowflake統合基盤** |

---

## 訴求ポイントまとめ

| 機能 | 訴求内容 |
|------|---------|
| **Snowflake Postgres** | PostgreSQL完全互換・マネージド・将来のアプリDBとして最適 |
| **pg_lake** | Postgres内でIceberg形式でS3に直接書き出し |
| **Iceberg Table** | S3上のIcebergデータをSnowflakeからネイティブ参照 |
| **Snowflake MCP Server** | 標準プロトコルでCortex AIと外部ツールを統合 |
| **Cortex Agent** | LLM + Search を一括処理・ツール呼び出し自動化 |
| **n8n on SPCS** | ワークフロー自動化をSnowflake内で完結 |
| **Streamlit** | データ可視化をSnowflake内で完結 |

---

## 成果物チェックリスト

| ファイル | 内容 | 状態 |
|----------|------|:----:|
| `postgres_setup.sql` | Snowflake Postgres DDL・サンプルデータ | ✅ |
| `snowflake_setup.sql` | SPCS設定・Secrets・External Access | ✅ |
| `n8n_spec.yaml` | SPCS Service定義 | ✅ |
| `n8n_workflow.json` | n8nワークフロー定義（Slack統合版） | ✅ |
| `ticket-app/` | チケット管理Webアプリ（Next.js） | ✅ |
| `ticket_app_spec.yaml` | Ticket App SPCS Service定義 | ✅ |
| `streamlit_app.py` | ダッシュボードUI | ⬜ |
| `demo_script.md` | デモ手順書 | ⬜ |

---

## 備考

- **Snowflake Postgres**: PostgreSQL 16-18互換、PgBouncer内蔵で高並行性対応
- **pg_lake**: Postgres拡張でIceberg形式をS3に直接書き出し（pg_cronで定期実行）
- **Iceberg Table**: Snowflakeからオープンフォーマットでデータ参照（ベンダーロックイン回避）
- **認証**: MCP ServerはOAuth 2.0、PostgresはToken Auth推奨
- **コスト**: Snowflake Postgresはインスタンス課金（SMALL〜XLARGE）、Iceberg Tableはストレージ+クエリ課金

---

## 実装済みコンポーネント詳細

### デプロイ済みサービス

| サービス | URL | 状態 |
|----------|-----|:----:|
| n8n | https://nqa4qd3u-sfseapac-fsi-japan.snowflakecomputing.app | ✅ |
| Ticket App | https://fta4qd3u-sfseapac-fsi-japan.snowflakecomputing.app | ✅ |

### PostgreSQL接続情報

- **Host**: `<YOUR_POSTGRES_HOST>.postgres.snowflake.app`
- **Database**: `postgres`
- **User**: `snowflake_admin`
- **Schema**: `app`

### 実装済みテーブル

| テーブル | スキーマ | 説明 |
|----------|----------|------|
| `helpdesk_tickets` | app | チケット管理テーブル |
| `helpdesk_logs` | app | 会話ログテーブル |
| `escalation_log` | app | エスカレーション記録 |
| `ai_response_log` | app | AI応答ログ |

### Ticket App機能

- **チケット一覧表示**: OPENとIN_PROGRESSのチケットを表示
- **統計表示**: アクティブチケット（OPEN/IN_PROGRESS）のみカウント
  - 総チケット、未対応、対応中、高緊急度
- **チケット編集モーダル**:
  - ステータス変更（OPEN/IN_PROGRESS/RESOLVED/CLOSED）
  - 担当者アサイン
  - 対応メモ記録
- **ログ一覧**: `/logs`で会話履歴を表示

### 既知の問題と修正履歴

| 日付 | 問題 | 原因 | 対応 |
|------|------|------|------|
| 2026/03/02 | モーダルが無反応 | onClose()の呼び出し順序 | 親コンポーネントでモーダル閉じる処理に変更 |
| 2026/03/02 | 解決済みチケットが統計に含まれる | 全チケットをカウント | activeTicketsフィルタを追加 |
| 2026/03/02 | 「保存に失敗しました」エラー | ticket_actionsテーブルが存在しない | INSERT文を削除 |

### 今後の課題

- [ ] `ticket_actions`テーブル作成（操作履歴記録用）
- [ ] pg_lake + Iceberg連携
- [ ] Streamlitダッシュボード作成
- [ ] Cortex Agent/MCP Server統合
