# データベース設計書

## Smart Helpdesk v2 - PostgreSQL Schema

**バージョン**: 2.1.1  
**最終更新日**: 2026-03-05  
**データベース**: Snowflake Postgres

---

## 1. 概要

### 1.1 データベース構成
- **ホスト**: Snowflake Postgres (*.postgres.snowflake.app)
- **スキーマ**: `app`
- **文字コード**: UTF-8

### 1.2 ER図

```
┌─────────────────────┐       ┌─────────────────────┐
│   helpdesk_logs     │       │  helpdesk_tickets   │
├─────────────────────┤       ├─────────────────────┤
│ PK id               │◀──────│ FK log_id           │
│    log_type         │       │ PK ticket_id        │
│    inquiry_id       │       │    reporter_name    │
│    thread_ts        │───────│    thread_ts        │
│    message          │       │    status           │
│    ai_response      │       │    ...              │
│    ...              │       └──────────┬──────────┘
└─────────────────────┘                  │
                                         │
┌─────────────────────┐                  │
│   escalation_log    │                  │
├─────────────────────┤                  │
│ PK escalation_id    │                  │
│ FK ticket_id        │◀─────────────────┘
│ FK log_id           │
│    ...              │
└─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    hr_tickets       │  │  finance_tickets    │  │  knowledge_articles │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ PK id               │  │ PK id               │  │ PK id               │
│    category         │  │    category         │  │    title            │
│    ...              │  │    ...              │  │    content          │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│      assets         │  │   service_catalog   │  │   system_settings   │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ PK id               │  │ PK id               │  │ PK id               │
│    asset_id         │  │    title            │  │    setting_key      │
│    ...              │  │    ...              │  │    setting_value    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 2. テーブル定義

### 2.1 app.helpdesk_logs（メインログテーブル）

問い合わせ・AI回答・評価を統合管理するログテーブル。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| log_type | VARCHAR(50) | NO | - | ログ種別 |
| inquiry_id | INTEGER | YES | - | 親問い合わせID |
| user_id | VARCHAR(100) | YES | - | SlackユーザーID |
| channel_id | VARCHAR(100) | YES | - | SlackチャネルID |
| thread_ts | VARCHAR(100) | YES | - | Slackスレッドts |
| message | TEXT | YES | - | メッセージ本文 |
| category | VARCHAR(50) | YES | - | カテゴリ |
| priority | VARCHAR(20) | YES | - | 優先度 |
| summary | TEXT | YES | - | 要約 |
| ai_response | TEXT | YES | - | AI回答（JSON） |
| ai_response_text | TEXT | YES | - | AI回答テキスト |
| resolution_steps | JSONB | YES | - | 解決手順 |
| needs_escalation | BOOLEAN | YES | FALSE | エスカレ必要 |
| escalation_team | VARCHAR(100) | YES | - | エスカレ先チーム |
| matched_kb_ids | TEXT | YES | - | マッチKB ID |
| confidence_scores | JSONB | YES | - | 信頼度スコア |
| tokens_input | INTEGER | YES | - | 入力トークン数 |
| tokens_output | INTEGER | YES | - | 出力トークン数 |
| model_name | VARCHAR(50) | YES | - | モデル名 |
| raw_agent_response | JSONB | YES | - | 生レスポンス |
| turn_number | INTEGER | YES | 1 | ターン番号 |
| is_multi_turn | BOOLEAN | YES | FALSE | マルチターン |
| evaluation | VARCHAR(20) | YES | - | 評価結果 |
| evaluation_comment | TEXT | YES | - | 評価コメント |
| status | VARCHAR(20) | YES | 'OPEN' | ステータス |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| resolved_at | TIMESTAMP | YES | - | 解決日時 |

**ログタイプ (log_type)**
| 値 | 説明 |
|----|------|
| INQUIRY | ユーザーからの問い合わせ |
| AI_RESPONSE | AIの回答 |
| EVALUATION | ユーザー評価 |
| INFO_RECEIVED | 情報受領 |

**インデックス**
```sql
CREATE INDEX idx_logs_log_type ON app.helpdesk_logs(log_type);
CREATE INDEX idx_logs_thread_ts ON app.helpdesk_logs(thread_ts);
CREATE INDEX idx_logs_inquiry_id ON app.helpdesk_logs(inquiry_id);
CREATE INDEX idx_logs_status ON app.helpdesk_logs(status);
CREATE INDEX idx_logs_created_at ON app.helpdesk_logs(created_at);
CREATE INDEX idx_logs_user_id ON app.helpdesk_logs(user_id);
```

---

### 2.2 app.helpdesk_tickets（ITチケットテーブル）

エスカレーションされたITヘルプデスクチケット。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| ticket_id | VARCHAR(50) | NO | - | 主キー (TKT-YYYYMMDD-HHMMSS) |
| reporter_name | VARCHAR(255) | YES | - | 報告者名 |
| reporter_employee_id | VARCHAR(50) | YES | - | 社員番号 |
| location | VARCHAR(255) | YES | - | 場所 |
| issue_type | VARCHAR(100) | YES | - | 問題種別 |
| urgency | VARCHAR(20) | YES | - | 緊急度 |
| summary | TEXT | YES | - | 要約 |
| details | JSONB | YES | - | 詳細情報 |
| matched_asset_id | VARCHAR(50) | YES | - | マッチ資産ID |
| log_id | INTEGER | YES | - | FK: helpdesk_logs.id |
| thread_ts | VARCHAR(100) | YES | - | Slackスレッドts |
| source_channel | VARCHAR(50) | YES | - | ソースチャネル |
| status | VARCHAR(50) | YES | 'OPEN' | ステータス |
| assigned_to | VARCHAR(255) | YES | - | 担当者 |
| resolution_notes | TEXT | YES | - | 対応メモ |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |
| resolved_at | TIMESTAMP | YES | - | 解決日時 |

**チケットID形式**
```
TKT-YYYYMMDD-HHMMSS
例: TKT-20260305-143022
```

**ステータス (status)**
| 値 | 説明 |
|----|------|
| OPEN | 未対応 |
| IN_PROGRESS | 対応中 |
| RESOLVED | 解決済み |
| CLOSED | クローズ |

**緊急度 (urgency)**
| 値 | SLA | 説明 |
|----|-----|------|
| HIGH | 2時間 | 業務停止レベル |
| MEDIUM | 8時間 | 業務影響あり |
| LOW | 24時間 | 軽微な問題 |

**インデックス**
```sql
CREATE INDEX idx_tickets_status ON app.helpdesk_tickets(status);
CREATE INDEX idx_tickets_log_id ON app.helpdesk_tickets(log_id);
CREATE INDEX idx_tickets_created_at ON app.helpdesk_tickets(created_at);
```

---

### 2.3 app.hr_tickets（人事チケットテーブル）

人事関連の問い合わせチケット。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| ticket_id | VARCHAR(50) | YES | - | チケットID |
| category | VARCHAR(50) | YES | - | カテゴリ |
| reporter_name | VARCHAR(255) | YES | - | 報告者名 |
| reporter_employee_id | VARCHAR(50) | YES | - | 社員番号 |
| department | VARCHAR(100) | YES | - | 部署 |
| issue_type | VARCHAR(100) | YES | - | 問題種別 |
| urgency | VARCHAR(20) | YES | - | 緊急度 |
| summary | TEXT | YES | - | 要約 |
| details | JSONB | YES | - | 詳細情報 |
| status | VARCHAR(50) | YES | 'OPEN' | ステータス |
| assigned_to | VARCHAR(255) | YES | - | 担当者 |
| resolution_notes | TEXT | YES | - | 対応メモ |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |
| resolved_at | TIMESTAMP | YES | - | 解決日時 |

**人事カテゴリ (category)**
| 値 | 説明 |
|----|------|
| ATTENDANCE | 勤怠関連 |
| BENEFITS | 福利厚生 |
| TRAINING | 研修・教育 |
| LEAVE | 休暇申請 |
| OTHER | その他 |

---

### 2.4 app.finance_tickets（経理チケットテーブル）

経理関連の問い合わせチケット。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| ticket_id | VARCHAR(50) | YES | - | チケットID |
| category | VARCHAR(50) | YES | - | カテゴリ |
| reporter_name | VARCHAR(255) | YES | - | 報告者名 |
| reporter_employee_id | VARCHAR(50) | YES | - | 社員番号 |
| department | VARCHAR(100) | YES | - | 部署 |
| issue_type | VARCHAR(100) | YES | - | 問題種別 |
| urgency | VARCHAR(20) | YES | - | 緊急度 |
| summary | TEXT | YES | - | 要約 |
| amount | DECIMAL(15,2) | YES | - | 金額 |
| details | JSONB | YES | - | 詳細情報 |
| status | VARCHAR(50) | YES | 'OPEN' | ステータス |
| assigned_to | VARCHAR(255) | YES | - | 担当者 |
| resolution_notes | TEXT | YES | - | 対応メモ |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |
| resolved_at | TIMESTAMP | YES | - | 解決日時 |

**経理カテゴリ (category)**
| 値 | 説明 |
|----|------|
| EXPENSE | 経費精算 |
| INVOICE | 請求書 |
| BUDGET | 予算関連 |
| TAX | 税務 |
| OTHER | その他 |

---

### 2.5 app.escalation_log（エスカレーション履歴）

エスカレーションの詳細追跡用テーブル。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| escalation_id | VARCHAR(50) | NO | - | 主キー |
| ticket_id | VARCHAR(50) | YES | - | FK: helpdesk_tickets |
| log_id | INTEGER | YES | - | FK: helpdesk_logs |
| original_message | TEXT | YES | - | 元メッセージ |
| ai_response | TEXT | YES | - | AI回答 |
| ai_confidence | FLOAT | YES | - | AI信頼度 |
| escalation_reason | VARCHAR(200) | YES | - | エスカレ理由 |
| escalation_team | VARCHAR(50) | YES | - | エスカレ先 |
| assigned_to | VARCHAR(100) | YES | - | 担当者 |
| resolution_notes | TEXT | YES | - | 対応メモ |
| feedback_rating | INTEGER | YES | - | 評価 (1-5) |
| escalated_at | TIMESTAMPTZ | YES | NOW() | エスカレ日時 |
| resolved_at | TIMESTAMPTZ | YES | - | 解決日時 |

---

### 2.6 app.knowledge_articles（ナレッジベース）

FAQ・マニュアル記事。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| title | VARCHAR(500) | NO | - | タイトル |
| content | TEXT | YES | - | 本文 |
| category | VARCHAR(50) | NO | - | カテゴリ |
| tags | VARCHAR(200) | YES | - | タグ（カンマ区切り） |
| views | INTEGER | YES | 0 | 閲覧数 |
| author | VARCHAR(100) | YES | - | 作成者 |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |

**カテゴリ (category)**
| 値 | 説明 |
|----|------|
| HARDWARE | ハードウェア |
| SOFTWARE | ソフトウェア |
| NETWORK | ネットワーク |
| ACCOUNT | アカウント |
| OTHER | その他 |

---

### 2.7 app.assets（資産管理）

IT資産管理テーブル。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| asset_id | VARCHAR(50) | NO | - | 資産ID (UNIQUE) |
| asset_type | VARCHAR(50) | NO | - | 資産タイプ |
| name | VARCHAR(200) | NO | - | 資産名 |
| assignee | VARCHAR(100) | YES | - | 使用者 |
| location | VARCHAR(200) | YES | - | 設置場所 |
| status | VARCHAR(20) | YES | 'ACTIVE' | ステータス |
| purchase_date | DATE | YES | - | 購入日 |
| notes | TEXT | YES | - | 備考 |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |

**資産タイプ (asset_type)**
| 値 | 説明 |
|----|------|
| PC | パソコン |
| SCANNER | スキャナー |
| TABLET | タブレット |
| PRINTER | プリンター |
| PHONE | 電話機 |
| OTHER | その他 |

**資産ステータス (status)**
| 値 | 説明 |
|----|------|
| ACTIVE | 稼働中 |
| MAINTENANCE | メンテナンス中 |
| RETIRED | 廃棄 |

---

### 2.8 app.service_catalog（サービスカタログ）

申請可能なサービス一覧。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| title | VARCHAR(200) | NO | - | サービス名 |
| description | TEXT | YES | - | 説明 |
| category | VARCHAR(50) | NO | - | カテゴリ |
| icon | VARCHAR(50) | YES | - | アイコン名 |
| sla_hours | INTEGER | YES | 24 | SLA時間 |
| active | BOOLEAN | YES | TRUE | 有効フラグ |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |

---

### 2.9 app.system_settings（システム設定）

アプリケーション設定。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| setting_key | VARCHAR(100) | NO | - | 設定キー (UNIQUE) |
| setting_value | TEXT | YES | - | 設定値 |
| setting_type | VARCHAR(20) | YES | 'string' | 値の型 |
| description | VARCHAR(500) | YES | - | 説明 |
| updated_at | TIMESTAMP | YES | NOW() | 更新日時 |

**デフォルト設定**
| キー | 値 | 型 | 説明 |
|------|-----|-----|------|
| sla_high | 2 | number | HIGH緊急度SLA（時間） |
| sla_medium | 8 | number | MEDIUM緊急度SLA（時間） |
| sla_low | 24 | number | LOW緊急度SLA（時間） |
| auto_escalate | true | boolean | 自動エスカレーション |
| notify_new_ticket | true | boolean | 新規チケット通知 |
| notify_assign | true | boolean | アサイン通知 |
| notify_sla_warning | true | boolean | SLA警告通知 |
| notify_sla_breach | true | boolean | SLA超過通知 |

---

### 2.10 app.ticket_comments（チケットコメント）

チケットへの内部コメント。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| ticket_id | VARCHAR(50) | NO | - | FK: helpdesk_tickets |
| author | VARCHAR(100) | NO | - | 投稿者 |
| content | TEXT | NO | - | コメント内容 |
| created_at | TIMESTAMP | YES | NOW() | 作成日時 |

---

### 2.11 app.ticket_history（チケット履歴）

チケット変更履歴。

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|----------|----------|------|-----------|------|
| id | SERIAL | NO | auto | 主キー |
| ticket_id | VARCHAR(50) | NO | - | FK: helpdesk_tickets |
| field | VARCHAR(50) | NO | - | 変更フィールド |
| old_value | TEXT | YES | - | 変更前の値 |
| new_value | TEXT | YES | - | 変更後の値 |
| changed_by | VARCHAR(100) | YES | - | 変更者 |
| changed_at | TIMESTAMP | YES | NOW() | 変更日時 |

---

## 3. ビュー定義

### 3.1 app.v_ticket_summary（チケットサマリー）

```sql
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
```

### 3.2 app.v_daily_kpi（日次KPI）

```sql
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
```

---

## 4. テーブル作成SQL

### 4.1 初期セットアップ

```sql
-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS app;

-- メインテーブル作成（postgres_schema.sql参照）
-- 追加テーブル作成（ticket-app/scripts/create-tables.js参照）
```

### 4.2 サンプルデータ投入

```sql
-- ナレッジベース
INSERT INTO app.knowledge_articles (title, content, category, views, author)
VALUES 
  ('スキャナーが起動しない場合の対処法', '1. 電源ケーブルを確認...', 'HARDWARE', 128, '高橋美咲'),
  ('VPN接続エラーの解決手順', '1. ネットワーク接続を確認...', 'SOFTWARE', 95, '田中太郎');

-- 資産
INSERT INTO app.assets (asset_id, asset_type, name, assignee, location, status)
VALUES 
  ('DEV-00123', 'SCANNER', 'Zebra TC52', '田中太郎', '第3倉庫', 'ACTIVE'),
  ('DEV-00124', 'PC', 'Dell Latitude 5520', '佐藤花子', '第1倉庫', 'ACTIVE');

-- サービスカタログ
INSERT INTO app.service_catalog (title, description, category, icon, sla_hours)
VALUES 
  ('PC申請', '新規PC・交換の申請', 'HARDWARE', 'Laptop', 72),
  ('アカウント作成', '新規システムアカウントの発行', 'ACCOUNT', 'Key', 24);

-- システム設定
INSERT INTO app.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('sla_high', '2', 'number', 'HIGH緊急度のSLA時間'),
  ('sla_medium', '8', 'number', 'MEDIUM緊急度のSLA時間'),
  ('sla_low', '24', 'number', 'LOW緊急度のSLA時間');
```

---

## 5. バックアップ・リストア

### 5.1 バックアップ
```bash
pg_dump -h <host> -U <user> -d postgres -n app > backup_$(date +%Y%m%d).sql
```

### 5.2 リストア
```bash
psql -h <host> -U <user> -d postgres < backup_YYYYMMDD.sql
```

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-03-03 | 1.0.0 | 初版作成 |
| 2026-03-05 | 2.0.0 | ITSM機能追加（HR/Finance/Knowledge/Assets等） |
| 2026-03-05 | 2.1.1 | 設計書作成 |
