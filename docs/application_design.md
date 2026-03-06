# アプリケーション設計書

## Smart Helpdesk v2 - チケット管理システム

**バージョン**: 2.2.0  
**最終更新日**: 2026-03-06

---

## 1. システム概要

### 1.1 目的
社内ヘルプデスク業務を効率化するためのチケット管理・対話ログ閲覧Webアプリケーション。
Slack経由で受け付けた問い合わせをCortex Agentで処理し、その結果を管理者が可視化・対応できるダッシュボードを提供する。

### 1.2 システム構成図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ユーザー層                                    │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────┐             │
│  │  Slack   │    │ Ticket App    │    │ 管理者ブラウザ    │             │
│  │ (入力)   │    │ (本アプリ)     │    │                  │             │
│  └────┬─────┘    └───────┬───────┘    └────────┬─────────┘             │
└───────┼──────────────────┼─────────────────────┼────────────────────────┘
        │                  │                     │
        ▼                  │                     │
┌────────────────┐         │                     │
│ AWS Lambda     │         │                     │
│ (slack_app.py) │         │                     │
│ カテゴリ選択・  │         │                     │
│ n8nルーティング │         │                     │
└──────┬─────────┘         │                     │
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Snowflake 環境                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   n8n on SPCS   │  │  Cortex Agent   │  │  Cortex Search  │         │
│  │ (4 Workflows)  │  │  (3 Agents)    │  │  (4 Services)  │         │
│  │ IT/Finance/    │  │  Helpdesk/     │  │  Knowledge/    │         │
│  │ HR/General     │  │  Finance/HR    │  │  Asset/Fin/HR  │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           └────────────────────┴────────────────────┘                   │
│                                │                                        │
│                                ▼                                        │
│                    ┌─────────────────────┐                              │
│                    │  Snowflake Postgres │                              │
│                    │   (データ永続化)     │                              │
│                    └─────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | 14.2.18 |
| 言語 | TypeScript | 5.x |
| UI | React | 18.x |
| スタイル | Tailwind CSS | 3.4.x |
| UIコンポーネント | shadcn/ui | - |
| アイコン | lucide-react | - |
| データベース | Snowflake Postgres | - |
| グラフ | Recharts | - |
| テーマ | next-themes | - |
| 通知 | sonner | - |
| Node.js | >= 18.17.0 | 推奨: 22.16.0 |

---

## 2. アーキテクチャ

### 2.1 ディレクトリ構成

```
ticket-app/
├── app/                          # Next.js App Router
│   ├── api/                      # APIルート
│   │   ├── tickets/              # チケットAPI
│   │   │   ├── route.ts          # GET: 一覧
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET/PATCH: 詳細・更新
│   │   │       ├── comments/     # コメントAPI
│   │   │       └── history/      # 履歴API
│   │   ├── logs/route.ts         # 対話ログAPI
│   │   ├── similar/route.ts      # 類似検索API (Cortex Search)
│   │   ├── knowledge/route.ts    # ナレッジベースAPI
│   │   ├── assets/route.ts       # 資産管理API
│   │   ├── catalog/route.ts      # サービスカタログAPI
│   │   ├── hr/tickets/route.ts   # 人事チケットAPI
│   │   ├── finance/tickets/route.ts # 経理チケットAPI
│   │   ├── settings/route.ts     # 設定API
│   │   └── audit/route.ts        # 監査ログAPI
│   │
│   ├── page.tsx                  # ITチケット一覧
│   ├── hr/page.tsx               # 人事チケット一覧
│   ├── finance/page.tsx          # 経理チケット一覧
│   ├── analytics/page.tsx        # 分析ダッシュボード
│   ├── logs/page.tsx             # 対話ログ
│   ├── knowledge/page.tsx        # ナレッジベース
│   ├── assets/page.tsx           # 資産管理
│   ├── catalog/page.tsx          # サービスカタログ
│   ├── settings/page.tsx         # システム設定
│   ├── audit/page.tsx            # 監査ログ
│   ├── layout.tsx                # ルートレイアウト
│   └── globals.css               # グローバルスタイル
│
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── Sidebar.tsx               # サイドバーナビ
│   ├── TicketModal.tsx           # チケット詳細モーダル
│   ├── SLAIndicator.tsx          # SLA表示
│   ├── theme-provider.tsx        # テーマプロバイダー
│   ├── theme-toggle.tsx          # テーマ切替
│   └── tickets/
│       └── TicketList.tsx        # チケットリスト
│
├── lib/
│   ├── db.ts                     # PostgreSQL接続
│   └── utils.ts                  # ユーティリティ
│
├── scripts/                      # 管理スクリプト
│   ├── create-tables.js
│   ├── seed-knowledge.ts
│   └── sync-assets.ts
│
├── .env.local                    # 環境変数 (git除外)
├── snowflake-connection.toml     # Snowflake接続 (git除外)
└── package.json
```

### 2.2 データフロー

```
[ユーザー操作]
      │
      ▼
[Next.js Page] ─────────────────────────────────┐
      │                                         │
      │ API呼び出し                              │
      ▼                                         │
[API Route Handler]                             │
      │                                         │
      ├── PostgreSQL Query (チケット/ログ)        │
      │         │                               │
      │         ▼                               │
      │   [Snowflake Postgres]                  │
      │         │                               │
      │         └── 結果返却 ────────────────────┤
      │                                         │
      └── Snowflake Query (類似検索)             │
                │                               │
                ▼                               │
          [Cortex Search Service]               │
                │                               │
                └── 結果返却 ────────────────────┤
                                                │
      ◀─────────────────────────────────────────┘
      │
      ▼
[UI更新・表示]
```

---

## 3. 画面設計

### 3.1 画面一覧

| パス | 画面名 | 説明 | テーマカラー |
|------|--------|------|-------------|
| `/` | ITチケット一覧 | ITヘルプデスクチケット管理 | 青 |
| `/hr` | 人事チケット一覧 | 人事関連チケット管理 | 緑 |
| `/finance` | 経理チケット一覧 | 経理関連チケット管理 | 紫 |
| `/analytics` | 分析ダッシュボード | KPI・統計表示 | - |
| `/logs` | 対話ログ | Slack対話履歴 | - |
| `/knowledge` | ナレッジベース | FAQ・マニュアル管理 | - |
| `/assets` | 資産管理 | IT資産一覧・検索 | - |
| `/catalog` | サービスカタログ | 申請可能サービス一覧 | - |
| `/settings` | 設定 | SLA・通知設定 | - |
| `/audit` | 監査ログ | 操作履歴 | - |

### 3.2 チケット一覧画面

#### 機能
- チケット一覧表示（テーブル形式）
- ステータス・緊急度フィルタリング
- キーワード検索
- 統計カード表示（総数、未対応、対応中、高緊急度）
- 30秒自動更新
- クリックで詳細モーダル表示

#### 表示カラム
| カラム | 説明 |
|--------|------|
| ID | チケットID (TKT-YYYYMMDD-HHMMSS) |
| 報告者 | reporter_name |
| 場所 | location |
| 種別 | issue_type (Badge) |
| 緊急度 | HIGH/MEDIUM/LOW (色分けBadge) |
| 要約 | summary (truncate) |
| ステータス | OPEN/IN_PROGRESS/RESOLVED/CLOSED |
| SLA | 残り時間・超過表示 |
| 担当者 | assigned_to |
| 作成日 | created_at |

### 3.3 チケット詳細モーダル

#### タブ構成
1. **詳細** - チケット情報・編集フォーム
2. **コメント** - 内部コメント履歴
3. **履歴** - ステータス変更履歴
4. **会話** - Slack対話ログ
5. **類似** - Cortex Searchによる類似チケット/ナレッジ検索

#### 編集可能項目
- ステータス（プルダウン）
- 担当者（プルダウン）
- 対応メモ（テキストエリア）

### 3.4 分析ダッシュボード

#### グラフ
- 日別チケット推移（LineChart）
- ステータス分布（PieChart）
- カテゴリ別集計（BarChart）

---

## 4. API設計

### 4.1 チケットAPI

#### GET /api/tickets
チケット一覧取得

**クエリパラメータ**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| status | string | × | ステータスフィルタ |
| urgency | string | × | 緊急度フィルタ |
| search | string | × | キーワード検索 |
| page | number | × | ページ番号 |
| limit | number | × | 件数 (default: 10) |

**レスポンス**
```json
{
  "tickets": [...],
  "total": 100,
  "page": 1,
  "totalPages": 10
}
```

#### GET /api/tickets/[id]
チケット詳細取得

#### PATCH /api/tickets/[id]
チケット更新

**リクエストボディ**
```json
{
  "status": "RESOLVED",
  "assigned_to": "担当者名",
  "resolution_notes": "対応内容"
}
```

### 4.2 類似検索API

#### GET /api/similar
Cortex Searchによる類似検索

**クエリパラメータ**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| query | string | ○ | 検索クエリ |
| category | string | × | it/hr/finance |
| limit | number | × | 件数 (default: 5) |

**対応サービス**
- IT: `HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE`
- HR: `HELPDESK_DB.APP.HR_SEARCH_SERVICE`
- Finance: `HELPDESK_DB.APP.FINANCE_SEARCH_SERVICE`

---

## 5. コンポーネント設計

### 5.1 共通コンポーネント

| コンポーネント | 説明 | Props |
|---------------|------|-------|
| Sidebar | サイドバーナビゲーション | - |
| TicketModal | チケット詳細モーダル | ticket, onClose, onSave |
| SLAIndicator | SLA残時間表示 | createdAt, urgency |
| Badge | ステータス/緊急度表示 | variant, children |

### 5.2 Badge Variants

| Variant | 用途 | 色 |
|---------|------|-----|
| default | デフォルト | グレー |
| high | 高緊急度 | 赤 |
| medium | 中緊急度 | 黄 |
| low | 低緊急度 | 緑 |
| open | 未対応 | 青 |
| in_progress | 対応中 | オレンジ |
| resolved | 解決済み | 緑 |
| closed | クローズ | グレー |

---

## 6. 外部連携

### 6.1 Snowflake連携

| サービス | 用途 |
|----------|------|
| Cortex Agent | AI問い合わせ処理 |
| Cortex Search | 類似チケット/ナレッジ検索 |
| Snowflake Postgres | データ永続化 |

### 6.2 Slack連携

| 機能 | 説明 |
|------|------|
| Incoming Webhook | チケット通知 |
| Events API | 問い合わせ受付 |

---

## 7. セキュリティ

### 7.1 認証情報管理
- 環境変数（`.env.local`）でDB接続情報管理
- `snowflake-connection.toml`でSnowflake接続管理
- 上記ファイルは`.gitignore`で除外

### 7.2 除外ファイル
```
.env.local
snowflake-connection.toml
*.snowflake.toml
snowflake.log
```

---

## 8. 開発・運用

### 8.1 ローカル開発
```bash
cd ticket-app
npm install
npm run dev -- -p 3002
```

### 8.2 環境変数
```
POSTGRES_HOST=xxx.postgres.snowflake.app
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=xxx
POSTGRES_PASSWORD=xxx
POSTGRES_SSL=true

SNOWFLAKE_ACCOUNT=xxx
SNOWFLAKE_USER=xxx
SNOWFLAKE_PASSWORD=xxx
SNOWFLAKE_WAREHOUSE=xxx
```

### 8.3 ビルド・デプロイ
```bash
npm run build
npm run start
```

SPCSデプロイの場合は `setup/05_spcs_deploy.sql` を参照。

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-03-03 | 1.0.0 | 初版作成 |
| 2026-03-04 | 2.0.0 | shadcn/ui, ダークモード, 分析ページ追加 |
| 2026-03-05 | 2.1.0 | マルチカテゴリ対応、ITSM機能追加 |
| 2026-03-05 | 2.1.1 | セキュリティ強化、設計書作成 |
| 2026-03-06 | 2.2.0 | Lambda stateless修正、n8nワークフロー修正（Postgres 0行問題、ノード位置） |
