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
- `setup/03_iceberg_setup.sql` - `CREATE EXTERNAL VOLUME`, pg_lake設定

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
- `setup/02_postgres_setup.sql` - `CREATE POSTGRES INSTANCE`
- `setup/01_snowflake_base.sql` - Postgres Secrets
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
- `setup/01_snowflake_base.sql` - N8N_ENCRYPTION_SECRET, N8N_JWT_SECRET
- `n8n/n8n_spec.yaml` - secrets.encryption_key, secrets.jwt_secret
- `.env.example` → `.env`

### 5. MCP Server OAuth認証 - 任意

| 項目 | プレースホルダー | 説明 |
|------|------------------|------|
| リダイレクトURI | `https://<n8n_endpoint>.snowflakecomputing.app/oauth/callback` | n8nデプロイ後に確定 |
| Client ID | (自動生成) | Security Integration作成後に取得 |
| Client Secret | (自動生成) | Security Integration作成後に取得 |

**対象ファイル:**
- `setup/04_cortex_setup.sql` - `CREATE SECURITY INTEGRATION`
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

> **実行ファイル: `setup/01_snowflake_base.sql`**

このスクリプトで以下を作成します：
- データベース・スキーマ
- コンピュートプール
- イメージリポジトリ
- ステージ
- Secrets
- 外部アクセス統合

```sql
-- 全体を実行するか、セクションごとに実行
-- Snowsight または snow sql で実行
```

### 1.1 事前準備

```bash
# n8n暗号化キー生成
openssl rand -hex 32

# n8n JWTシークレット生成
openssl rand -hex 32
```

生成した値を`setup/01_snowflake_base.sql`のSecrets作成部分に反映してから実行します。

### 1.2 Secretの値を更新する場合

```sql
ALTER SECRET HELPDESK_DB.SPCS.POSTGRES_HOST_SECRET
  SET SECRET_STRING = 'helpdesk-postgres-xxxxx.postgres.snowflake.app';
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
- Host: `xxxxx.snowflakecomputing.com`
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

> **実行ファイル: `setup/03_iceberg_setup.sql`**
>
> pg_lakeとIcebergを使う場合のみ実行

### 3.1 事前準備

1. AWS S3バケット作成: `aws s3 mb s3://helpdesk-iceberg-bucket`
2. IAMロール作成・権限設定
3. `setup/03_iceberg_setup.sql`のプレースホルダーを更新

### 3.2 実行

```sql
-- setup/03_iceberg_setup.sql を実行
-- External Volume, Iceberg Tables, 統計ビューを作成
```

---

## Step 4: Cortex Search & Agent（任意）

> **実行ファイル: `setup/04_cortex_setup.sql`**
>
> MCP Server経由でAI機能を使う場合に実行

```sql
-- setup/04_cortex_setup.sql を実行
-- Cortex Search Service, Agent, MCP Server を作成
```

---

## Step 5: ナレッジベースセットアップ

> **実行ファイル: `setup/05_knowledge_base.sql`**

```sql
-- setup/05_knowledge_base.sql を実行
-- FAQテーブル、サンプルデータ、Cortex Search Serviceを作成
```

> **注意:** 外部アクセス統合（HELPDESK_EAI）は `setup/01_snowflake_base.sql` で既に作成されています。

---

## Step 6: SPCSデプロイ

> **実行ファイル: `setup/06_spcs_deploy.sql`**

### 6.0 事前確認

```sql
-- コンピュートプールがACTIVEか確認
SHOW COMPUTE POOLS LIKE '%POOL';

-- Secretsが設定されているか確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;
```

---

## Step 7: Dockerイメージのビルド・プッシュ

> 作業ディレクトリ: `/Users/ryoshida/Desktop/env/n8n/smart_helpdesk`

### 7.1 レジストリにログイン

```bash
snow spcs image-registry login --connection fsi_japan_connection
```

### 7.2 n8nイメージ

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n

# ビルド
docker build -t sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest .

# プッシュ
docker push sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest
```

### 7.3 ticket-appイメージ

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app

# ビルド
docker build -t sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest .

# プッシュ
docker push sfseapac-fsi_japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest
```

### 7.4 イメージ確認

```sql
-- Snowflakeで確認
CALL SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/N8N_REPO');
CALL SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/TICKET_APP_REPO');
```

---

## Step 8: spec.yamlのアップロード

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

## Step 9: SPCSサービス作成

> **実行ファイル: `setup/06_spcs_deploy.sql` のSTEP 4, 5**

```sql
-- n8nサービス
CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE = 'n8n_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- ticket-appサービス
CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL TICKET_APP_POOL
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- 状態確認
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.N8N_SVC');
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');

-- エンドポイント取得
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;
```

---

## Step 10: Streamlitアプリ作成

> Snowsight上で分析ダッシュボードを表示

### 10.1 ステージにアップロード

```bash
# 作業ディレクトリから実行
snow stage copy streamlit/streamlit_app.py @HELPDESK_DB.APP.STREAMLIT_STAGE --connection fsi_japan_connection --overwrite
```

### 10.2 Streamlitアプリ作成

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

### 10.3 アクセス

Snowsight → Projects → Streamlit → HELPDESK_DASHBOARD

---

## Step 11: 動作確認

### 11.1 エンドポイントにアクセス

```
n8n: https://<n8n_endpoint>.snowflakecomputing.app
ticket-app: https://<ticket_app_endpoint>.snowflakecomputing.app
Streamlit: Snowsight内で実行
```

### 11.2 n8n初回セットアップ

#### 11.2.1 管理者アカウント作成

1. n8n URLにアクセス
2. 「Set up owner account」画面で以下を入力:
   - Email: 管理者メールアドレス
   - First Name / Last Name: 名前
   - Password: 強力なパスワード
3. 「Next」をクリック

#### 11.2.2 基本設定

1. 右上のユーザーアイコン → **Settings**
2. **General** タブで以下を設定:
   - **Public Instance URL**: `https://<n8n_endpoint>.snowflakecomputing.app`
     > ⚠️ これがないとWebhookが動作しない
3. 「Save」をクリック

### 11.3 Slack認証情報の設定

#### 11.3.1 Credentials作成

1. 左メニュー → **Credentials**
2. **Add Credential** → 検索で「Slack」→ **Slack API** を選択
3. 以下を入力:

| 項目 | 値 |
|------|-----|
| Credential Name | `Slack Bot` |
| Access Token | `xoxb-xxxxx...`（Slack Appから取得したBot Token） |

4. **Save** をクリック
5. **Test** で接続確認

#### 11.3.2 Slack App側の設定（Event Subscriptions）

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

### 11.4 ワークフローのインポート

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

### 11.5 MCP Server接続設定（任意）

> Cortex Agent/Searchを使う場合のみ

#### 11.5.1 OAuth認証情報の取得

```sql
-- Snowflakeで実行（Step 4で作成したSecurity Integration）
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('HELPDESK_MCP_OAUTH');
```

出力から以下をメモ:
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`

#### 11.5.2 n8nでのMCP設定

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

### 11.6 ワークフローの有効化

1. ワークフロー画面右上の **Active** トグルを **ON**
2. 「Workflow activated」と表示されればOK

### 11.7 Slack連携テスト

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

## Step 12: AWS Lambda デプロイ

> Slack連携のためのLambda関数をデプロイ

### 12.1 ローカルファイル構成

```
smart_helpdesk/
├── slack_app.py           # Lambda関数のソースコード
└── package/               # 依存ライブラリ（pip installで作成）
    ├── slack_sdk/
    ├── requests/
    └── ...
```

### 12.2 Lambda パッケージ作成

```bash
# 作業ディレクトリに移動
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk

# slack_app.py を package/ にコピー（lambda_function.py としてリネーム）
# package/ 内のライブラリと一緒にZIP化
cp slack_app.py ./package/lambda_function.py && cd package && zip -r ../lambda_package.zip . -q && cd ..

# 確認
ls -lh lambda_package.zip
```

### 12.3 依存ライブラリのインストール（初回のみ）

```bash
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk

# package/ ディレクトリに依存ライブラリをインストール
pip install slack_sdk requests -t ./package/
```

### 12.4 AWS Lambda へのアップロード

**AWS Console から:**
1. AWS Console → Lambda → `smart-helpdesk-slack` 関数
2. 「コード」タブ → 「Upload from」 → 「.zip file」
3. `lambda_package.zip` を選択してアップロード
4. 「Deploy」をクリック

**AWS CLI から:**
```bash
aws lambda update-function-code \
  --function-name smart-helpdesk-slack \
  --zip-file fileb://lambda_package.zip
```

### 12.5 Lambda 環境変数

| 変数名 | 説明 | 値 |
|--------|------|-----|
| `SLACK_BOT_TOKEN` | Slack Bot Token | `xoxb-xxxxx...` |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | （Slack Appから取得） |
| `N8N_WEBHOOK_URL` | n8n Webhook URL | `https://nqa4qd3u-sfseapac-fsi-japan.snowflakecomputing.app/webhook/helpdesk` |
| `N8N_EVALUATION_URL` | 評価フロー用URL | `https://nqa4qd3u-sfseapac-fsi-japan.snowflakecomputing.app/webhook/helpdesk-evaluation` |
| `SNOWFLAKE_PAT` | SPCS認証用PAT | N8N_USER用のProgrammatic Access Token |

### 12.6 Lambda テスト

1. AWS Console → Lambda → `smart-helpdesk-slack`
2. 「テスト」タブ → テストイベントを作成
3. テストイベント例:
```json
{
  "body": "{\"type\":\"url_verification\",\"challenge\":\"test123\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```
4. 「テスト」をクリック → `{"challenge": "test123"}` が返ればOK

### 12.7 API Gateway 設定

1. AWS Console → API Gateway → `smart-helpdesk-api`
2. リソース: `/slack/events` (POST)
3. 統合: Lambda関数 `smart-helpdesk-slack`
4. エンドポイントURL: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/slack/events`

### 12.8 Slack App 設定

1. https://api.slack.com/apps でAppを選択
2. **Event Subscriptions** → Enable Events: **On**
3. **Request URL**: API Gateway のエンドポイントURL
4. **Subscribe to bot events**:
   - `app_mention`
   - `message.im`
5. **Interactivity & Shortcuts** → Enable: **On**
6. **Request URL**: API Gateway のエンドポイントURL（同じ）

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
