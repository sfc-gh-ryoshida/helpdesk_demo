-- ============================================================
-- Cortex セットアップ（任意）
-- スマート社内ヘルプデスク
-- Step 4: Cortex Search Service, Agent, MCP Server
-- ※ AI機能を使う場合に実行
-- ============================================================

USE DATABASE HELPDESK_DB;
USE SCHEMA APP;

-- ============================================================
-- 1. Cortex Search Service作成（資産検索用）
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
-- 2. Cortex Agent作成
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
-- 3. MCP Server作成
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


-- ============================================================
-- 4. OAuth認証設定（MCP用 - 任意）
-- ============================================================

-- Security Integration作成（n8nのリダイレクトURLに合わせて変更）
-- CREATE OR REPLACE SECURITY INTEGRATION HELPDESK_MCP_OAUTH
--   TYPE = OAUTH
--   OAUTH_CLIENT = CUSTOM
--   ENABLED = TRUE
--   OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
--   OAUTH_REDIRECT_URI = 'https://<n8n_endpoint>.snowflakecomputing.app/oauth/callback';

-- クライアントID/Secretを取得（n8n設定時に使用）
-- SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('HELPDESK_MCP_OAUTH');


-- ============================================================
-- 5. 権限設定
-- ============================================================

GRANT USAGE ON MCP SERVER HELPDESK_DB.APP.HELPDESK_MCP_SERVER TO ROLE SYSADMIN;
GRANT USAGE ON CORTEX AGENT HELPDESK_DB.APP.HELPDESK_AGENT TO ROLE SYSADMIN;
GRANT USAGE ON CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE TO ROLE SYSADMIN;


-- ============================================================
-- 6. 動作確認
-- ============================================================

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
