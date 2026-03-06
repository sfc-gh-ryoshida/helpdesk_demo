-- ============================================================
-- SPCS デプロイ
-- スマート社内ヘルプデスク
-- Step 6: Dockerイメージ、spec.yaml、サービス作成
-- ============================================================

USE DATABASE HELPDESK_DB;
USE SCHEMA SPCS;

-- ============================================================
-- 事前準備チェックリスト
-- ============================================================

/*
以下が完了していることを確認してください：

✅ Step 1: 01_snowflake_base.sql 実行済み
   - コンピュートプール作成済み
   - イメージリポジトリ作成済み
   - ステージ作成済み
   - Secrets作成・設定済み
   - 外部アクセス統合作成済み

✅ Step 2: 02_postgres_setup.sql 実行済み
   - Postgresインスタンス作成済み
   - スキーマ・テーブル作成済み
   - POSTGRES_HOST_SECRET にホスト名反映済み

✅ n8n暗号化キー生成済み
   openssl rand -hex 32  # 結果をN8N_ENCRYPTION_SECRETに設定

✅ n8n JWTシークレット生成済み
   openssl rand -hex 32  # 結果をN8N_JWT_SECRETに設定
*/


-- ============================================================
-- 1. 確認クエリ
-- ============================================================

-- コンピュートプール状態
SHOW COMPUTE POOLS LIKE '%POOL';

-- イメージリポジトリURL確認
SHOW IMAGE REPOSITORIES IN SCHEMA HELPDESK_DB.SPCS;

-- Secrets確認
SHOW SECRETS IN SCHEMA HELPDESK_DB.SPCS;


-- ============================================================
-- 2. Docker イメージのビルド・プッシュ（ターミナルで実行）
-- ============================================================

/*
# 1. Snowflake Image Registry にログイン
docker login sfseapac-fsi-japan.registry.snowflakecomputing.com -u FSI_JAPAN
# または
snow spcs image-registry login --connection fsi_japan_connection

# 2. n8n イメージをビルド・プッシュ
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/n8n
docker build --platform linux/amd64 -t sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest .
docker push sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/n8n_repo/n8n:latest

# 3. ticket-app イメージをビルド・プッシュ
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk/ticket-app
docker build --platform linux/amd64 -t sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest .
docker push sfseapac-fsi-japan.registry.snowflakecomputing.com/helpdesk_db/spcs/ticket_app_repo/ticket-app:latest
*/

-- イメージ確認
SELECT SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/N8N_REPO');
SELECT SYSTEM$REGISTRY_LIST_IMAGES('/HELPDESK_DB/SPCS/TICKET_APP_REPO');


-- ============================================================
-- 3. spec.yaml をステージにアップロード（ターミナルで実行）
-- ============================================================

/*
cd /Users/ryoshida/Desktop/env/n8n/smart_helpdesk

# n8n
snow stage copy n8n/n8n_spec.yaml @HELPDESK_DB.SPCS.N8N_DATA --overwrite -c fsi_japan_connection

# ticket-app
snow stage copy ticket-app/ticket_app_spec.yaml @HELPDESK_DB.SPCS.TICKET_APP_DATA --overwrite -c fsi_japan_connection
*/

-- アップロード確認
LIST @HELPDESK_DB.SPCS.N8N_DATA;
LIST @HELPDESK_DB.SPCS.TICKET_APP_DATA;


-- ============================================================
-- 4. n8n サービス作成
-- ============================================================

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.N8N_SVC
  IN COMPUTE POOL HELPDESK_POOL
  FROM @HELPDESK_DB.SPCS.N8N_DATA
  SPECIFICATION_FILE = 'n8n_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- サービス状態確認（READY になるまで待つ）
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.N8N_SVC');

-- エンドポイント確認（ingress_url をメモ）
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.N8N_SVC;

-- ログ確認（エラー時）
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.N8N_SVC', 0, 'n8n', 100);


-- ============================================================
-- 5. ticket-app サービス作成
-- ============================================================

CREATE SERVICE IF NOT EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC
  IN COMPUTE POOL TICKET_APP_POOL  -- 別プール（または HELPDESK_POOL）
  FROM @HELPDESK_DB.SPCS.TICKET_APP_DATA
  SPECIFICATION_FILE = 'ticket_app_spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (HELPDESK_EAI);

-- サービス状態確認
SELECT SYSTEM$GET_SERVICE_STATUS('HELPDESK_DB.SPCS.TICKET_APP_SVC');

-- エンドポイント確認
SHOW ENDPOINTS IN SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- ログ確認（エラー時）
SELECT SYSTEM$GET_SERVICE_LOGS('HELPDESK_DB.SPCS.TICKET_APP_SVC', 0, 'ticket-app', 100);


-- ============================================================
-- 6. 全サービス確認
-- ============================================================

SHOW SERVICES IN SCHEMA HELPDESK_DB.SPCS;


-- ============================================================
-- 7. 運用コマンド
-- ============================================================

-- サービス停止（メンテナンス時）
-- ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC SUSPEND;
-- ALTER SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC SUSPEND;

-- サービス再開
-- ALTER SERVICE HELPDESK_DB.SPCS.N8N_SVC RESUME;
-- ALTER SERVICE HELPDESK_DB.SPCS.TICKET_APP_SVC RESUME;

-- サービス削除（再作成時）
-- DROP SERVICE IF EXISTS HELPDESK_DB.SPCS.N8N_SVC;
-- DROP SERVICE IF EXISTS HELPDESK_DB.SPCS.TICKET_APP_SVC;

-- Compute Pool 停止（コスト節約）
-- ALTER COMPUTE POOL HELPDESK_POOL STOP ALL;
-- ALTER COMPUTE POOL TICKET_APP_POOL STOP ALL;


-- ============================================================
-- トラブルシューティング
-- ============================================================

/*
よくあるエラーと解決策:

1. readinessProbe エラー
   「Invalid spec: missing 'port' for 'readinessProbe'」
   → spec.yaml の readinessProbe を以下の形式に修正:
     readinessProbe:
       port: 5678
       path: /healthz

2. secretKeyRef エラー
   「Secret key reference xxx does not exist」
   → GENERIC_STRING タイプは secretKeyRef: secret_string
   → PASSWORD タイプは secretKeyRef: password

3. permission denied エラー
   「EACCES: permission denied, open '/home/node/.n8n/config'」
   → spec.yaml から volumeMounts と volumes を削除
   → Postgres がデータ永続化を担当

4. DNS解決エラー
   「getaddrinfo ENOTFOUND xxx.postgres.snowflake.app」
   → POSTGRES_RULE ネットワークルールを追加
   → HELPDESK_EAI に POSTGRES_RULE を含める

5. SSL接続エラー
   「no pg_hba.conf entry for host... no encryption」
   → spec.yaml に以下を追加:
     DB_POSTGRESDB_SSL_ENABLED: "true"
     DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: "false"

6. CPUリソース不足
   「Unschedulable due to insufficient CPU resources」
   → 別の Compute Pool を作成して各サービスを分離
*/
