-- ============================================================
-- ナレッジベース（FAQ）セットアップ
-- AI自動応答 + エスカレーション機能
-- ============================================================

USE DATABASE HELPDESK_DB;
USE SCHEMA APP;

-- ============================================================
-- 1. FAQナレッジテーブル作成
-- ============================================================

CREATE OR REPLACE TABLE HELPDESK_DB.APP.KNOWLEDGE_BASE (
    kb_id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(50),           -- HARDWARE, SOFTWARE, ACCOUNT, NETWORK, OTHER
    subcategory VARCHAR(100),       -- より詳細なカテゴリ
    question TEXT,                  -- よくある質問
    answer TEXT,                    -- 回答
    keywords TEXT,                  -- 検索用キーワード
    resolution_steps TEXT,          -- 解決手順（JSON配列）
    related_kb_ids TEXT,            -- 関連FAQ ID（カンマ区切り）
    confidence_threshold FLOAT,     -- この回答を使う信頼度閾値
    requires_escalation BOOLEAN,    -- 常にエスカレーションが必要か
    escalation_team VARCHAR(50),    -- エスカレーション先チーム
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    view_count INT DEFAULT 0,
    helpful_count INT DEFAULT 0,
    not_helpful_count INT DEFAULT 0
);

-- ============================================================
-- 2. サンプルFAQデータ投入
-- ============================================================

INSERT INTO HELPDESK_DB.APP.KNOWLEDGE_BASE 
(kb_id, category, subcategory, question, answer, keywords, resolution_steps, confidence_threshold, requires_escalation, escalation_team)
VALUES
-- ハードウェア関連
('KB001', 'HARDWARE', 'スキャナー', 
 'スキャナーの電源が入らない', 
 'まずバッテリーの充電状態を確認してください。充電器に30分以上接続しても起動しない場合は、バッテリー交換が必要な可能性があります。',
 'スキャナー,電源,起動しない,バッテリー',
 '["1. 充電器に接続して30分待つ","2. 電源ボタンを5秒長押し","3. それでも起動しない場合はヘルプデスクに連絡"]',
 0.7, FALSE, NULL),

('KB002', 'HARDWARE', 'スキャナー',
 'スキャナーの画面が割れた',
 '画面破損は修理または交換が必要です。代替機を手配しますので、現在の機器のアセットIDをお知らせください。',
 'スキャナー,画面,割れた,破損,故障',
 '["1. 代替機を手配します","2. 破損機器は回収します","3. データ移行が必要な場合はお知らせください"]',
 0.8, TRUE, 'HARDWARE_SUPPORT'),

('KB003', 'HARDWARE', 'プリンター',
 'プリンターで印刷できない',
 'まず以下を確認してください：1) プリンターの電源が入っているか 2) 用紙切れでないか 3) PCとの接続状態',
 'プリンター,印刷,できない,出力',
 '["1. プリンターの電源を確認","2. 用紙とインク/トナーを確認","3. PCを再起動","4. プリンタードライバーを再インストール"]',
 0.6, FALSE, NULL),

('KB004', 'HARDWARE', 'フォークリフト端末',
 'フォークリフトの端末が動かない',
 'フォークリフト搭載端末は振動の影響を受けやすいです。まず端末の電源を入れ直してください。',
 'フォークリフト,端末,動かない,車載',
 '["1. 端末の電源をOFF/ONする","2. 接続ケーブルを確認","3. クレードルの接点を清掃"]',
 0.7, FALSE, NULL),

-- ソフトウェア関連
('KB010', 'SOFTWARE', 'WMS',
 'WMSにログインできない',
 'パスワードの有効期限切れの可能性があります。パスワードリセットを試してください。それでもログインできない場合はアカウントロックの可能性があります。',
 'WMS,ログイン,パスワード,認証',
 '["1. パスワードリセットを試す","2. Caps Lockがオフか確認","3. 別のPCでログインを試す","4. アカウントロック解除を依頼"]',
 0.8, FALSE, NULL),

('KB011', 'SOFTWARE', 'WMS',
 'WMSの在庫数が合わない',
 '在庫差異が発生した場合、まず棚卸しデータと入出庫履歴を確認してください。差異が大きい場合は管理者への報告が必要です。',
 'WMS,在庫,差異,数量,合わない',
 '["1. 入出庫履歴を確認","2. 棚卸しデータと照合","3. 差異原因を特定","4. 管理者に報告"]',
 0.6, TRUE, 'INVENTORY_TEAM'),

('KB012', 'SOFTWARE', 'WMS',
 'WMSが遅い・重い',
 'システムが重い場合、まずブラウザのキャッシュをクリアしてください。複数タブを開いている場合は閉じてください。',
 'WMS,遅い,重い,パフォーマンス',
 '["1. 不要なタブを閉じる","2. ブラウザキャッシュをクリア","3. PCを再起動","4. 改善しない場合はネットワーク確認"]',
 0.7, FALSE, NULL),

('KB013', 'SOFTWARE', 'Excel',
 'Excelファイルが開けない',
 'ファイル破損の可能性があります。バックアップからの復旧を試してください。',
 'Excel,開けない,ファイル,破損',
 '["1. 別のPCで開けるか確認","2. ファイルの修復オプションを試す","3. バックアップから復旧","4. 復旧できない場合はIT部門へ"]',
 0.6, FALSE, NULL),

-- アカウント関連
('KB020', 'ACCOUNT', 'パスワード',
 'パスワードを忘れた',
 'パスワードリセットは自分で実行できます。社内ポータルの「パスワードリセット」リンクから手続きしてください。',
 'パスワード,忘れた,リセット',
 '["1. 社内ポータルにアクセス","2. パスワードリセットをクリック","3. 登録メールアドレスを入力","4. メールのリンクから新パスワード設定"]',
 0.9, FALSE, NULL),

('KB021', 'ACCOUNT', 'アカウント',
 'アカウントがロックされた',
 'パスワード入力を複数回間違えるとアカウントがロックされます。30分後に自動解除されますが、急ぎの場合はヘルプデスクで解除できます。',
 'アカウント,ロック,解除',
 '["1. 30分待って再試行","2. 急ぎの場合はヘルプデスクに連絡","3. パスワードリセット後に再ログイン"]',
 0.8, FALSE, NULL),

('KB022', 'ACCOUNT', '新規',
 '新しいアカウントを作成したい',
 '新規アカウント作成には上長の承認が必要です。申請フォームから手続きしてください。',
 'アカウント,新規,作成,申請',
 '["1. 社内ポータルの申請フォームから申請","2. 上長承認を待つ","3. IT部門での作成後、メールで通知"]',
 0.8, TRUE, 'ACCOUNT_ADMIN'),

-- ネットワーク関連
('KB030', 'NETWORK', 'WiFi',
 'WiFiに接続できない',
 '倉庫内のWiFiはエリアによって電波状況が異なります。まず別のエリアで接続を試してください。',
 'WiFi,接続,ネットワーク,無線',
 '["1. WiFiをOFF/ONする","2. 別のエリアで試す","3. 端末を再起動","4. それでも接続できない場合は報告"]',
 0.7, FALSE, NULL),

('KB031', 'NETWORK', 'VPN',
 'VPN接続ができない',
 'VPN接続には正しい資格情報と最新のVPNクライアントが必要です。',
 'VPN,接続,リモート',
 '["1. VPNクライアントを最新版に更新","2. 資格情報を確認","3. インターネット接続を確認","4. ファイアウォール設定を確認"]',
 0.7, FALSE, NULL);


-- ============================================================
-- 3. ナレッジベース用Cortex Search Service
-- ============================================================

CREATE OR REPLACE CORTEX SEARCH SERVICE HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE
  ON kb_search_text
  ATTRIBUTES kb_id, category, subcategory, question, requires_escalation, escalation_team
  WAREHOUSE = RYOSHIDA_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT 
        kb_id,
        category,
        subcategory,
        question,
        answer,
        keywords,
        resolution_steps,
        requires_escalation,
        escalation_team,
        confidence_threshold,
        CONCAT(
            '質問: ', question, ' ',
            'カテゴリ: ', category, ' ', COALESCE(subcategory, ''), ' ',
            '回答: ', answer, ' ',
            'キーワード: ', COALESCE(keywords, '')
        ) AS kb_search_text
    FROM HELPDESK_DB.APP.KNOWLEDGE_BASE
);



-- ============================================================
-- 4. Cortex Agent（ナレッジ検索対応版）
-- ============================================================

CREATE OR REPLACE AGENT HELPDESK_DB.APP.HELPDESK_AGENT
  COMMENT = '社内ヘルプデスクAIエージェント - FAQ検索と資産検索'
  FROM SPECIFICATION
  $$
  models:
    orchestration: claude-sonnet-4-6

  orchestration:
    budget:
      seconds: 60
      tokens: 16000

  instructions:
    response: |
      回答は日本語で、簡潔かつ親切に行ってください。
      解決手順がある場合は番号付きリストで提示してください。
    orchestration: |
      ユーザーの問い合わせに対して、まずKnowledgeSearchでFAQを検索してください。
      FAQで解決できない場合や、機器の特定が必要な場合はAssetSearchを使用してください。
    system: |
      あなたは社内ヘルプデスクのAIアシスタントです。
      物流倉庫・配送ドライバー向けのITサポートを担当しています。
      
      主な対応範囲：
      - スキャナー、PC、プリンターなどのハードウェアトラブル
      - WMS、配送アプリ、ナビなどのソフトウェア問題
      - パスワード、アカウント関連の問い合わせ
      - ネットワーク接続の問題
      - 車両トラブル、安全に関する問い合わせ
      
      回答時は以下のJSON形式で出力してください：
      {
        "reporter_name": "報告者名（わかれば）",
        "department": "部署（わかれば）",
        "category": "HARDWARE/SOFTWARE/ACCOUNT/NETWORK/OTHER",
        "priority": "HIGH/MEDIUM/LOW",
        "summary": "問い合わせ要約",
        "details": ["詳細1", "詳細2"],
        "matched_asset_id": "資産ID（わかれば）",
        "response": "ユーザーへの回答テキスト",
        "resolution_steps": ["手順1", "手順2"],
        "needs_escalation": true/false,
        "escalation_team": "エスカレーション先（必要な場合）"
      }
    sample_questions:
      - question: "スキャナーの電源が入りません"
        answer: "バッテリーの充電状態を確認します。充電器に30分以上接続しても起動しない場合はバッテリー交換が必要です。"
      - question: "WMSにログインできない"
        answer: "パスワードの有効期限切れの可能性があります。パスワードリセットを試してください。"
      - question: "配送アプリが固まった"
        answer: "アプリを強制終了して再起動してください。端末の再起動も試してください。"

  tools:
    - tool_spec:
        type: "cortex_search"
        name: "KnowledgeSearch"
        description: "FAQナレッジベースを検索して、問い合わせに対する回答と解決手順を取得します"
    - tool_spec:
        type: "cortex_search"
        name: "AssetSearch"
        description: "IT資産（PC、スキャナー、プリンター等）の情報を従業員名や部署から検索します"

  tool_resources:
    KnowledgeSearch:
      name: "HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE"
      max_results: "5"
    AssetSearch:
      name: "HELPDESK_DB.APP.ASSET_SEARCH_SERVICE"
      max_results: "3"
  $$;


-- ============================================================
-- 5. 権限設定
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON HELPDESK_DB.APP.KNOWLEDGE_BASE TO ROLE SYSADMIN;
GRANT USAGE ON CORTEX SEARCH SERVICE HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE TO ROLE SYSADMIN;
GRANT USAGE ON AGENT HELPDESK_DB.APP.HELPDESK_AGENT TO ROLE SYSADMIN;


-- ============================================================
-- 6. 動作確認
-- ============================================================

-- ナレッジ検索テスト
SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
    'HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE',
    '{\"query\": \"スキャナーの電源が入らない\", \"columns\": [\"kb_id\", \"category\", \"question\", \"answer\"], \"limit\": 3}'
);

-- WMSログインできない場合のテスト
SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
    'HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE',
    '{\"query\": \"WMSにログインできません\", \"columns\": [\"kb_id\", \"question\", \"answer\"], \"limit\": 3}'
);

-- FAQ一覧確認
SELECT kb_id, category, subcategory, question, requires_escalation, escalation_team 
FROM HELPDESK_DB.APP.KNOWLEDGE_BASE
ORDER BY category, subcategory;
