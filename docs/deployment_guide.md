# スマート社内ヘルプデスク デプロイ手順書

## 環境情報

| 項目 | 値 |
|------|-----|
| Snowflake接続 | `fsi_japan_connection` |
| アカウント | SFSEAPAC-FSI_JAPAN |
| ユーザー | FSI_JAPAN |
| ロール | ACCOUNTADMIN |
| ウェアハウス | RYOSHIDA_WH |
| データベース | HELPDESK_DB |

---

## ⚠️ 事前準備（Snowflake外のリソース）

以下はSnowflake外で事前に準備が必要なリソースです。  
**各ファイル内のプレースホルダーを実際の値に置き換えてください。**

### 1. AWS S3（Iceberg用）- 任意

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| S3バケット名 | `helpdesk-iceberg-bucket` | pg_lakeのIceberg出力先 |
| S3パス | `s3://helpdesk-iceberg-bucket/pgdata/helpdesk/` | External Volumeで指定 |
| IAMロールARN | `arn:aws:iam::123456789012:role/helpdesk-iceberg-role` | SnowflakeがS3にアクセスするためのロール |

**対象ファイル:**
- `setup/01_postgres_setup.sql` - `SET pg_lake_iceberg.default_location_prefix`
- `setup/02_snowflake_setup.sql` - `CREATE EXTERNAL VOLUME`

**IAMロール設定手順:**
1. AWS IAMでロールを作成
2. S3バケットへの読み書き権限を付与
3. Trust PolicyにSnowflakeアカウントを追加（`DESC EXTERNAL VOLUME`で確認）

### 2. Slack Bot - 任意

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| Bot Token | (n8nで設定) | `xoxb-`で始まるトークン |
| Signing Secret | (n8nで設定) | Webhook検証用 |
| チャンネルID | `#helpdesk-urgent` | 高緊急度アラート送信先 |

**Slack App作成手順:**
1. https://api.slack.com/apps で新規App作成
2. Bot Token Scopesを設定: `chat:write`, `channels:history`, `channels:read`
3. Event Subscriptionsを有効化
4. ワークスペースにインストール

**対象ファイル:**
- `n8n/n8n_workflow.json` - Slack資格情報

### 3. Snowflake Postgres パスワード

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| 管理者パスワード | `<your_secure_password>` | PostgresインスタンスのADMIN_PASSWORD |

**対象ファイル:**
- `setup/01_postgres_setup.sql` - `CREATE POSTGRES INSTANCE`
- `.env.example` → `.env` - `POSTGRES_PASSWORD`
- `n8n/n8n_spec.yaml` - secrets.postgres_password
- `ticket-app/ticket_app_spec.yaml` - secrets.postgres_password

### 4. n8n シークレット

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| 暗号化キー | `${N8N_ENCRYPTION_KEY}` | 32文字以上のランダム文字列 |
| JWTシークレット | `${N8N_JWT_SECRET}` | ユーザー管理用シークレット |

**生成方法:**
```bash
# 暗号化キー生成
openssl rand -hex 32

# JWTシークレット生成
openssl rand -hex 32
```

**対象ファイル:**
- `n8n/n8n_spec.yaml` - secrets.encryption_key, secrets.jwt_secret
- `.env.example` → `.env`

### 5. MCP Server OAuth認証 - 任意

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| リダイレクトURI | `https://<n8n_endpoint>.snowflakecomputing.app/oauth/callback` | n8nデプロイ後に確定 |
| Client ID | (自動生成) | Security Integration作成後に取得 |
| Client Secret | (自動生成) | Security Integration作成後に取得 |

**対象ファイル:**
- `setup/02_snowflake_setup.sql` - `CREATE SECURITY INTEGRATION`
- `n8n/n8n_workflow.json` - MCP接続設定

---

## 準備チェックリスト

### 必須
- [ ] Docker Desktop インストール済み
- [ ] snow CLI インストール済み (`snow --version`)
- [ ] Postgres管理者パスワードを決定
- [ ] n8n暗号化キー・JWTシークレットを生成

### Iceberg連携する場合
- [ ] AWS S3バケット作成済み
- [ ] IAMロール作成・設定済み
- [ ] バケット名・ARNをファイルに反映済み

### Slack連携する場合
- [ ] Slack App作成済み
- [ ] Bot Token取得済み
- [ ] 通知先チャンネル作成済み

---

## Step 1: Snowflake基盤セットアップ

### 1.1 データベース・スキーマ作成

```sql
-- Snowsight または snow sql で実行
CREATE DATABASE IF NOT EXISTS HELPDESK_DB;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.APP;
CREATE SCHEMA IF NOT EXISTS HELPDESK_DB.SPCS;
```

### 1.2 コンピュートプール作成

```sql
CREATE COMPUTE POOL IF NOT EXISTS HELPDESK_POOL
    MIN_NODES = 1
    MAX_NODES = 1
    INSTANCE_FAMILY = CPU_X64_XS;

-- 起動確認（IDLEになるまで待つ）
SHOW COMPUTE POOLS LIKE 'HELPDESK_POOL';
```

### 1.3 イメージリポジトリ作成

```sql
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.N8N_REPO;
CREATE IMAGE REPOSITORY IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_REPO;

-- 確認
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;
```

### 1.4 ステージ作成

```sql
CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_DATA DIRECTORY = (ENABLE = TRUE);
CREATE STAGE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_DATA DIRECTORY = (ENABLE = TRUE);
```

### 1.5 Snowflake Secrets作成

> ⚠️ SPCSコンテナに機密情報を渡すために必要です。値は後で更新可能。

```sql
-- Postgres接続情報（Step 2完了後に正しい値に更新）
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'placeholder';

CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_USER_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = 'helpdesk_admin';

CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.POSTGRES_PASSWORD_SECRET
  TYPE = PASSWORD
  USERNAME = 'helpdesk_admin'
  PASSWORD = '<your_postgres_password>';

-- n8n暗号化キー
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.N8N_ENCRYPTION_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<openssl rand -hex 32 で生成>';

-- n8n JWTシークレット
CREATE SECRET IF NOT EXISTS HELPDESK_DB.SPCS.N8N_JWT_SECRET
  TYPE = GENERIC_STRING
  SECRET_STRING = '<openssl rand -hex 32 で生成>';

-- 確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;
```

**Secretの値を更新する場合:**
```sql
ALTER SECRET HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  SET SECRET_STRING = 'helpdesk-postgres-xxxxx.snowflakecomputing.com';
```

---

## Step 2: Snowflake Postgres セットアップ

### 2.1 インスタンス作成

```sql
-- Snowflakeで実行
CREATE POSTGRES INSTANCE helpdesk_postgres
  INSTANCE_TYPE = 'SMALL'
  STORAGE_SIZE = 100
  POSTGRES_VERSION = '16'
  ADMIN_USER = 'helpdesk_admin'
  ADMIN_PASSWORD = '<your_secure_password>';

-- 接続情報取得
DESCRIBE POSTGRES INSTANCE helpdesk_postgres;
```

**出力から以下をメモ:**
- Host: `helpdesk-postgres-xxxxx.snowflakecomputing.com`
- Port: `5432`

### 2.2 Secretsを更新

> ⚠️ Step 1.5で作成したSecretsにPostgresのHost情報を反映

```sql
ALTER SECRET HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  SET SECRET_STRING = '<Step 2.1で取得したHost>';
```

### 2.3 psqlで接続

```bash
psql "postgresql://helpdesk_admin:<password>@<host>:5432/postgres"
```

### 2.4 スキーマ・テーブル作成

```bash
# setup/01_postgres_setup.sql を実行
psql "postgresql://helpdesk_admin:<password>@<host>:5432/postgres" -f setup/01_postgres_setup.sql
```

または手動で:
```sql
CREATE DATABASE helpdesk_db;
\c helpdesk_db
-- 01_postgres_setup.sql のセクション2〜8を実行
```

### 2.5 n8n用ユーザー作成

```sql
-- helpdesk_db に接続した状態で実行
CREATE USER n8n_user WITH PASSWORD '<n8n_user_password>';
GRANT CONNECT ON DATABASE helpdesk_db TO n8n_user;
GRANT USAGE ON SCHEMA app TO n8n_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO n8n_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO n8n_user;
```

---

## Step 3: External Volume & Iceberg（任意）

> pg_lakeとIcebergを使う場合のみ実行

### 3.1 S3バケット準備

```bash
# AWS CLIで作成
aws s3 mb s3://helpdesk-iceberg-bucket
```

### 3.2 IAMロール設定

1. Snowflake用のIAMロールを作成
2. S3バケットへのアクセス権限を付与
3. Trust Policyを設定

### 3.3 External Volume作成

```sql
CREATE OR REPLACE EXTERNAL VOLUME helpdesk_iceberg_volume
  STORAGE_LOCATIONS = (
    (
      NAME = 'helpdesk_s3'
      STORAGE_PROVIDER = 'S3'
      STORAGE_BASE_URL = 's3://helpdesk-iceberg-bucket/pgdata/helpdesk/'
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<account_id>:role/helpdesk-iceberg-role'
    )
  );

DESC EXTERNAL VOLUME helpdesk_iceberg_volume;
```

### 3.4 Icebergテーブル作成

```sql
CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
  EXTERNAL_VOLUME = 'helpdesk_iceberg_volume'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/helpdesk_tickets_iceberg';

CREATE OR REPLACE ICEBERG TABLE HELPDESK_DB.APP.ASSET_MASTER_ICE
  EXTERNAL_VOLUME = 'helpdesk_iceberg_volume'
  CATALOG = 'SNOWFLAKE'
  BASE_LOCATION = 'helpdesk_db/public/asset_master_iceberg';
```

### 3.5 統計ビュー作成

```sql
-- 02_snowflake_setup.sql のセクション4を実行
-- TICKET_STATS_DAILY, TICKET_STATS_BY_LOCATION, TICKET_KPI_SUMMARY
```

---

## Step 4: Cortex Search & Agent（任意）

> MCP Server経由でAI機能を使う場合に実行

### 4.1 Cortex Search Service作成

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE HELPDESK_DB.APP.ASSET_SEARCH_SERVICE
  ON asset_search_text
  ATTRIBUTES asset_id, asset_type, location, assigned_employee_name, status
  WAREHOUSE = RYOSHIDA_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT 
        asset_id, asset_type, device_name, assigned_employee_name,
        location, status,
        CONCAT('アセットID: ', asset_id, ' タイプ: ', asset_type, 
               ' デバイス名: ', COALESCE(device_name, ''), 
               ' 担当者: ', COALESCE(assigned_employee_name, '未割当'),
               ' 場所: ', COALESCE(location, '不明'),
               ' 説明: ', COALESCE(asset_description, '')) AS asset_search_text
    FROM HELPDESK_DB.APP.ASSET_MASTER_ICE
    WHERE status = 'ACTIVE'
);
```

### 4.2 Cortex Agent作成

```sql
-- 02_snowflake_setup.sql のセクション6を参照
CREATE OR REPLACE CORTEX AGENT HELPDESK_DB.APP.HELPDESK_AGENT
  MODEL = 'llama3.1-70b'
  TOOLS = (HELPDESK_DB.APP.ASSET_SEARCH_SERVICE)
  SYSTEM_PROMPT = '...';  -- 詳細は02_snowflake_setup.sqlを参照
```

### 4.3 MCP Server作成

```sql
-- 02_snowflake_setup.sql のセクション7を参照
CREATE OR REPLACE MCP SERVER HELPDESK_DB.APP.HELPDESK_MCP_SERVER
  FROM SPECIFICATION $$
    tools:
      - name: "helpdesk-agent"
        type: "CORTEX_AGENT_RUN"
        ...
  $$;
```

---

## Step 5: 外部アクセス統合

```sql
USE ROLE ACCOUNTADMIN;
USE DATABASE HELPDESK_DB;

-- Slack API
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SLACK_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('slack.com:443', '*.slack.com:443', 'hooks.slack.com:443');

-- Postgres接続用
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.POSTGRES_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('*.snowflakecomputing.com:5432');

-- Snowflake API用
CREATE OR REPLACE NETWORK RULE HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('*.snowflakecomputing.com:443');

-- 統合作成
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION EXTERNAL_ACCESS_N8N_EAI
  ALLOWED_NETWORK_RULES = (
    HELPDESK_DB.SPCS.SLACK_API_RULE,
    HELPDESK_DB.SPCS.POSTGRES_RULE,
    HELPDESK_DB.SPCS.SNOWFLAKE_API_RULE
  )
  ENABLED = TRUE;

GRANT USAGE ON INTEGRATION EXTERNAL_ACCESS_N8N_EAI TO ROLE SYSADMIN;
```

---

## Step 6: Dockerイメージのビルド・プッシュ

> 作業ディレクトリ: `/Users/ryoshida/Desktop/env/n8n/smart_helpdesk`

### 6.1 レジストリにログイン

```bash
snow spcs image-registry login --connection fsi_japan_connection
```

### 6.2 n8nイメージ

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n

# ビルド
docker build -t sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest .

# プッシュ
docker push sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest
```

### 6.3 ticket-appイメージ

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app

# ビルド
docker build -t sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest .

# プッシュ
docker push sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest
```

### 6.4 イメージ確認

```sql
-- Snowflakeで確認
CALL SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/N8N_REPO');
CALL SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/TICKET_APP_REPO');
```

---

## Step 7: spec.yamlのアップロード

> 作業ディレクトリ: `/Users/ryoshida/Desktop/env/n8n/smart_helpdesk`

```bash
# n8n（作業ディレクトリから実行）
snow stage copy n8n/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA --connection fsi_japan_connection --overwrite

# ticket-app
snow stage copy ticket-app/ticket_app_spec.yaml @HELPDESK_DB.SPCS.TICKET_APP_DATA --connection fsi_japan_connection --overwrite
```

確認:
```sql
LIST @HELPDESK_DB.SPCS.N8N_DATA;
LIST @HELPDESK_DB.SPCS.TICKET_APP_DATA;
```

---

## Step 8: SPCSサービス作成

### 8.1 n8nサービス

```sql
CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE = 'n8n_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

-- 状態確認（READYになるまで待つ）
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.N8N_SVC');

-- エンドポイント取得
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;
```

### 8.2 ticket-appサービス

```sql
CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (EXTERNAL_ACCESS_N8N_EAI);

-- 状態確認
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');

-- エンドポイント取得
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;
```

---

## Step 9: Streamlitアプリ作成

> Snowsight上で分析ダッシュボードを表示

### 9.1 ステージにアップロード

```bash
# 作業ディレクトリから実行
snow stage copy streamlit/streamlit_app.py @HELPDESK_DB.APP.STREAMLIT_STAGE --connection fsi_japan_connection --overwrite
```

### 9.2 Streamlitアプリ作成

```sql
-- ステージ作成（まだない場合）
CREATE STAGE IF NOT EXISTS HELPDESK_DB.APP.STREAMLIT_STAGE
  DIRECTORY = (ENABLE = TRUE);

-- Streamlitアプリ作成
CREATE OR REPLACE STREAMLIT HELPDESK_DB.APP.HELPDESK_DASHBOARD
  ROOT_LOCATION = '@HELPDESK_DB.APP.STREAMLIT_STAGE'
  MAIN_FILE = 'streamlit_app.py'
  QUERY_WAREHOUSE = 'RYOSHIDA_WH';

-- 確認
SHOW STREAMLITS IN SCHEMA HELPDESK_DB.APP;
```

### 9.3 アクセス

Snowsight → Projects → Streamlit → HELPDESK_DASHBOARD

---

## Step 10: 動作確認

### 10.1 エンドポイントにアクセス

```
n8n: https://<n8n_endpoint>.snowflakecomputing.app
ticket-app: https://<ticket_app_endpoint>.snowflakecomputing.app
Streamlit: Snowsight内で実行
```

### 10.2 n8n初回セットアップ

#### 10.2.1 管理者アカウント作成

1. n8n URLにアクセス
2. 「Set up owner account」画面で以下を入力:
   - Email: 管理者メールアドレス
   - First Name / Last Name: 名前
   - Password: 強力なパスワード
3. 「Next」をクリック

#### 10.2.2 基本設定

1. 右上のユーザーアイコン → **Settings**
2. **General** タブで以下を設定:
   - **Public Instance URL**: `https://<n8n_endpoint>.snowflakecomputing.app`
     > ⚠️ これがないとWebhookが動作しない
3. 「Save」をクリック

### 10.3 Slack認証情報の設定

#### 10.3.1 Credentials作成

1. 左メニュー → **Credentials**
2. **Add Credential** → 検索で「Slack」→ **Slack API** を選択
3. 以下を入力:

| 項目 | 値 |
|------|-----|
| Credential Name | `Slack Bot` |
| Access Token | `xoxb-xxxxx...`（Slack Appから取得したBot Token） |

4. **Save** をクリック
5. **Test** で接続確認

#### 10.3.2 Slack App側の設定（Event Subscriptions）

1. https://api.slack.com/apps でAppを選択
2. **Event Subscriptions** → Enable Events: **On**
3. **Request URL** に以下を入力:
   ```
   https://<n8n_endpoint>.snowflakecomputing.app/webhook/helpdesk-webhook
   ```
4. **Subscribe to bot events** で以下を追加:
   - `message.channels`
   - `message.groups`
   - `message.im`
5. **Save Changes**

### 10.4 ワークフローのインポート

1. 左メニュー → **Workflows**
2. 右上の **⋮** メニュー → **Import from File**
3. `n8n/n8n_workflow.json` を選択
4. インポート後、各ノードを確認:

| ノード | 確認項目 |
|--------|----------|
| Slack Trigger | Credential が「Slack Bot」になっているか |
| MCP - Cortex Agent | サーバーURLが正しいか |
| MCP - Create Ticket | サーバーURLが正しいか |
| Slack Reply | Credential が「Slack Bot」になっているか |
| Slack Alert | Credential が「Slack Bot」になっているか |

5. 各ノードをダブルクリックして Credential を再選択（必要に応じて）

### 10.5 MCP Server接続設定（任意）

> Cortex Agent/Searchを使う場合のみ

#### 10.5.1 OAuth認証情報の取得

```sql
-- Snowflakeで実行（Step 4で作成したSecurity Integration）
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('HELPDESK_MCP_OAUTH');
```

出力から以下をメモ:
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`

#### 10.5.2 n8nでのMCP設定

1. ワークフロー内の **MCP - Cortex Agent** ノードをダブルクリック
2. 以下を設定:

| 項目 | 値 |
|------|-----|
| Server URL | `wss://sfseapac-fsi_japan.snowflakecomputing.com/mcp-server/HELPDESK_DB/APP/HELPDESK_MCP_SERVER` |
| Authentication | OAuth |
| Client ID | （上で取得した値） |
| Client Secret | （上で取得した値） |
| Token URL | `https://sfseapac-fsi_japan.snowflakecomputing.com/oauth/token-request` |

3. **MCP - Create Ticket** ノードも同様に設定

### 10.6 ワークフローの有効化

1. ワークフロー画面右上の **Active** トグルを **ON**
2. 「Workflow activated」と表示されればOK

### 10.7 Slack連携テスト

Slackで以下のメッセージを送信:
```
第3倉庫の田中です。スキャナー落として画面割れました
```

期待される動作:
- チケットが自動作成される
- Slackに返信が来る

**うまくいかない場合:**
1. n8n → **Executions** で実行履歴を確認
2. エラーが出ているノードをクリックして詳細を確認
3. Slack App の Request URL が正しいか再確認

---

## トラブルシューティング

### サービスが起動しない

```sql
-- ログ確認
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.N8N_SVC', 0, 'n8n', 100);
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.TICKET_APP_SVC', 0, 'ticket-app', 100);
```

### Postgres接続エラー

```bash
# 接続テスト
psql "postgresql://helpdesk_admin:<password>@<host>:5432/helpdesk_db" -c "SELECT 1"
```

### イメージプッシュ失敗

```bash
# 再ログイン
snow spcs image-registry login --connection fsi_japan_connection

# ログイン確認
docker login sfseapac-fsi_japan.registry.snowflakecomputing.com
```

---

## クリーンアップ

```sql
-- サービス停止
ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SUSPEND;
ALTER SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC SUSPEND;

-- サービス削除
DROP SERVICE HELPDESK_DB.SPCS.N8N_SVC;
DROP SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- コンピュートプール停止
ALTER COMPUTE POOL HELPDESK_POOL STOP ALL;

-- Postgresインスタンス停止（課金停止）
ALTER POSTGRES INSTANCE helpdesk_postgres SUSPEND;
```

---

## 参考リンク

- [n8n on SPCS 参考記事](https://zenn.dev/snowflakejp/articles/29d7c0283a431a)
- [Snowflake SPCS ドキュメント](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/overview)
- [Snowflake Postgres ドキュメント](https://docs.snowflake.com/en/sql-reference/sql/create-postgres-instance)
