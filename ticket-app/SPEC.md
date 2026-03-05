# チケット管理システム - 仕様書

## 概要

スマート社内ヘルプデスクのチケット管理・対話ログ閲覧Webアプリケーション。
Slack経由で受け付けた問い合わせをCortex Agentで処理し、その結果をPostgreSQLに保存。
本アプリはそれらのデータを可視化・管理するための管理者向けダッシュボード。

---

## システム構成

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Slack     │────▶│  AWS Lambda │────▶│  n8n on SPCS    │
│  (入力)     │     │  (ルーティング)  │     │ (ワークフロー)   │
└─────────────┘     └─────────────┘     └────────┬────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            ▼                            │
                    │  ┌─────────────────┐  ┌─────────────────┐              │
                    │  │ Cortex Agent    │  │ PostgreSQL      │              │
                    │  │ (AI処理)        │  │ (データ保存)    │              │
                    │  └─────────────────┘  └────────┬────────┘              │
                    │                                │                        │
                    │  Snowflake                     │                        │
                    └────────────────────────────────┼────────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────┐
                                          │ Ticket App      │
                                          │ (本アプリ)       │
                                          └─────────────────┘
```

### 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 14.2.18 (App Router) |
| 言語 | TypeScript |
| UI | React 18, Tailwind CSS 3.4, shadcn/ui |
| アイコン | lucide-react |
| データベース | Snowflake Postgres (pg ライブラリ) |
| ユーティリティ | clsx, tailwind-merge |
| グラフ | Recharts |
| テーマ | next-themes |
| 通知 | sonner |
| **Node.js** | **>= v18.17.0 必須** (推奨: v22.16.0) |

### ディレクトリ構成

```
ticket-app/
├── app/
│   ├── api/
│   │   ├── tickets/
│   │   │   ├── route.ts          # GET: チケット一覧（検索・ページネーション対応）
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET/PATCH: チケット詳細・更新
│   │   └── logs/
│   │       └── route.ts          # GET: ログ一覧取得
│   ├── analytics/
│   │   └── page.tsx              # 分析ダッシュボード（Recharts）
│   ├── logs/
│   │   └── page.tsx              # 対話ログページ
│   ├── layout.tsx                # ルートレイアウト（ThemeProvider）
│   ├── page.tsx                  # メインページ（チケット一覧）
│   └── globals.css               # グローバルスタイル
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   ├── theme-provider.tsx        # ダークモードプロバイダー
│   ├── theme-toggle.tsx          # テーマ切替ボタン
│   └── TicketModal.tsx           # チケット詳細モーダル
├── lib/
│   ├── db.ts                     # PostgreSQL接続
│   └── utils.ts                  # ユーティリティ関数
├── package.json
└── tsconfig.json
```

### 関連システム

| システム | 説明 |
|----------|------|
| n8n Workflow | Smart Helpdesk - Snowflake Agent |
| Slack App | ryoshida_demo_helpdesk |
| Cortex Agent | HELPDESK_DB.APP.HELPDESK_AGENT |
| Cortex Search | HELPDESK_DB.APP.ASSET_SEARCH_SERVICE |

---

## 画面仕様

### 1. ITヘルプデスク チケット一覧ページ (`/`)

#### 機能
- ITカテゴリのチケット一覧表示（テーブル形式）
- ステータス・緊急度によるフィルタリング
- 統計情報の表示（総チケット数、未対応、対応中、高緊急度）
- チケットクリックで詳細モーダル表示
- **青色アクセントテーマ**

### 1b. 人事 チケット一覧ページ (`/hr`)

#### 機能
- 人事カテゴリのチケット一覧表示（app.hr_ticketsテーブル）
- ITと同様の機能
- **緑色アクセントテーマ**

### 1c. 経理 チケット一覧ページ (`/finance`)

#### 機能
- 経理カテゴリのチケット一覧表示（app.finance_ticketsテーブル）
- ITと同様の機能
- **紫色アクセントテーマ**

#### 表示項目
| カラム | 説明 |
|--------|------|
| ID | チケットID (TKT-YYYYMMDD-HHMMSS形式) |
| 報告者 | reporter_name |
| 場所 | location |
| 種別 | issue_type (Badge表示) |
| 緊急度 | urgency: HIGH/MEDIUM/LOW (色分けBadge) |
| 要約 | summary (truncate) |
| ステータス | OPEN/IN_PROGRESS/RESOLVED/CLOSED |
| 担当者 | assigned_to |
| 作成日 | created_at |

#### フィルタ
- ステータス: 全ステータス / OPEN / IN_PROGRESS / RESOLVED / CLOSED
- 緊急度: 全緊急度 / HIGH / MEDIUM / LOW

### 2. チケット詳細モーダル

#### 機能
- チケットの詳細情報表示
- 関連する会話履歴の表示（thread_tsでログ取得）
- ステータス・担当者・対応メモの編集・保存

#### 編集可能項目
- ステータス（プルダウン）
- 担当者（プルダウン：高橋美咲、田中太郎、佐藤花子）
- 対応メモ（テキストエリア）

### 3. 対話ログページ (`/logs`)

#### 機能
- Slackスレッド単位でグループ化したログ表示
- アコーディオン形式で詳細展開
- 統計情報（総スレッド、解決済み、エスカレ、評価待ち）

#### ログタイプ
| タイプ | 説明 | アイコン |
|--------|------|---------|
| INQUIRY | ユーザーからの問い合わせ | MessageSquare (青) |
| AI_RESPONSE | AIの回答 | Bot (紫) |
| EVALUATION | ユーザー評価 | ThumbsUp (緑) |
| INFO_RECEIVED | 情報受領 | - |

#### 評価ステータス
- `resolved` / `helpful`: ✅ 解決
- `not_helpful`: 👎 未解決
- `escalate`: 🚨 エスカレ

---

## API仕様

### GET /api/tickets

チケット一覧を取得

#### クエリパラメータ
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| status | string | ステータスでフィルタ |
| urgency | string | 緊急度でフィルタ |

#### レスポンス
```json
[
  {
    "ticket_id": "TKT-20260303-120000",
    "reporter_name": "山田太郎",
    "location": "本社3F",
    "issue_type": "PC_TROUBLE",
    "urgency": "HIGH",
    "summary": "パソコンが起動しない",
    "status": "OPEN",
    "assigned_to": null,
    "created_at": "2026-03-03T12:00:00Z"
  }
]
```

### GET /api/tickets/[id]

チケット詳細を取得

### PATCH /api/tickets/[id]

チケットを更新

#### リクエストボディ
```json
{
  "status": "RESOLVED",
  "assigned_to": "担当者名",
  "resolution_notes": "対応内容"
}
```

### GET /api/logs

対話ログを取得

#### クエリパラメータ
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| log_type | string | ログタイプでフィルタ |
| thread_ts | string | スレッドタイムスタンプ |
| ticket_id | string | チケットIDで関連ログ取得 |

---

## データベース

### 接続情報（環境変数）
| 変数名 | 説明 |
|--------|------|
| POSTGRES_HOST | ホスト名 |
| POSTGRES_PORT | ポート (デフォルト: 5432) |
| POSTGRES_DB | データベース名 |
| POSTGRES_USER | ユーザー名 |
| POSTGRES_PASSWORD | パスワード |
| POSTGRES_SSL | SSL有効化 ("true") |

### テーブル: app.helpdesk_tickets
| カラム | 型 | 説明 |
|--------|-----|------|
| ticket_id | VARCHAR(50) | PK, チケットID |
| reporter_name | VARCHAR(255) | 報告者名 |
| reporter_employee_id | VARCHAR(50) | 社員番号 |
| location | VARCHAR(255) | 場所 |
| issue_type | VARCHAR(100) | 問題種別 |
| urgency | VARCHAR(20) | 緊急度 (HIGH/MEDIUM/LOW) |
| summary | TEXT | 要約 |
| details | JSONB | 詳細情報 |
| matched_asset_id | VARCHAR(50) | マッチした資産ID |
| status | VARCHAR(50) | ステータス |
| assigned_to | VARCHAR(255) | 担当者 |
| resolution_notes | TEXT | 対応メモ |
| source_channel | VARCHAR(50) | ソースチャネル |
| thread_ts | VARCHAR(100) | Slackスレッドts |
| log_id | INTEGER | 関連ログID |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |
| resolved_at | TIMESTAMP | 解決日時 |

### テーブル: app.helpdesk_logs
| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | PK |
| log_type | VARCHAR(50) | ログタイプ |
| inquiry_id | INTEGER | 問い合わせID |
| user_id | VARCHAR(100) | SlackユーザーID |
| channel_id | VARCHAR(100) | SlackチャネルID |
| thread_ts | VARCHAR(100) | Slackスレッドts |
| message | TEXT | メッセージ本文 |
| category | VARCHAR(50) | カテゴリ |
| priority | VARCHAR(20) | 優先度 |
| summary | TEXT | 要約 |
| ai_response | TEXT | AI回答（JSON） |
| ai_response_text | TEXT | AI回答テキスト |
| evaluation | VARCHAR(20) | 評価結果 |
| evaluation_comment | TEXT | 評価コメント |
| status | VARCHAR(50) | ステータス |
| created_at | TIMESTAMP | 作成日時 |
| resolved_at | TIMESTAMP | 解決日時 |

---

## コンポーネント

### Badge
ステータス/緊急度表示用バッジ

| Variant | 色 |
|---------|-----|
| default | グレー |
| high | 赤 |
| medium | 黄 |
| low | 緑 |
| open | 青 |
| resolved | 緑 |
| closed | グレー |

### TicketModal
チケット詳細・編集モーダル

---

## 改善提案

### ✅ 実装済み

1. **shadcn/ui導入** - Card, Table, Badge, Button, Select, Dialog, Tabs, Skeleton, Input
2. **ダークモード** - next-themes + テーマトグル
3. **Toast通知** - sonner
4. **Skeleton UI** - ローディング状態
5. **30秒自動更新** - ポーリング実装
6. **分析ダッシュボード** - Recharts (LineChart, PieChart, BarChart)
7. **検索機能** - ILIKE検索
8. **ページネーション** - 10件/ページ

### 🟡 今後の改善候補

### 🟢 優先度: 低

#### 10. レスポンシブデザイン
- モバイル表示の最適化

#### 11. ソート機能
- カラムヘッダークリックでソート

#### 12. キーボードショートカット
- Escでモーダル閉じる等

#### 13. 通知機能
- 高緊急度チケット発生時のブラウザ通知
- 担当者アサイン時のSlack通知

#### 14. エクスポート機能
- CSV/Excel形式でのチケットエクスポート

#### 15. 監査ログ
- 誰がいつ何を変更したかの履歴

#### 16. SLAトラッキング
- 対応時間の計測
- SLA違反アラート

#### 17. AI機能強化
- 類似チケット検出
- 自動カテゴリ推奨
- 回答テンプレート提案

---

## 推奨アーキテクチャ変更

### 現在
```
ticket-app/
├── app/
│   ├── page.tsx          # チケット一覧
│   ├── logs/page.tsx     # ログ一覧
│   └── api/              # APIルート
├── components/           # UIコンポーネント
└── lib/                  # ユーティリティ
```

### 推奨
```
ticket-app/
├── app/
│   ├── (dashboard)/      # グループルート
│   │   ├── page.tsx
│   │   ├── logs/page.tsx
│   │   └── analytics/page.tsx  # 新規: 分析
│   ├── api/
│   └── layout.tsx
├── components/
│   ├── ui/               # shadcn/ui
│   ├── tickets/          # チケット関連
│   ├── logs/             # ログ関連
│   └── layout/           # サイドバー等
├── lib/
│   ├── db.ts
│   ├── utils.ts
│   └── hooks/            # カスタムフック
└── types/                # 型定義
```

---

## 開発・実行

### 前提条件
- **Node.js >= v18.17.0** (Next.js 14の要件)
- 推奨: v22.16.0

### ローカル開発
```bash
cd ticket-app
npm install

# Node.jsバージョンを明示的に指定して起動（推奨）
export PATH="/Users/ryoshida/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run dev -- -p 3001

# または nvm を使用
nvm use 22
npm run dev
```

### よくある問題
- **CSS/レイアウトが崩れる場合**: Node.jsバージョンが古い可能性。v22.16.0を使用してください
- **エラー: "Node.js version >= v18.17.0 is required"**: Node.jsをアップグレードしてください

### 環境変数 (.env.local)
```
POSTGRES_HOST=fjf7gro575djnc7hampgj7jqam.sfseapac-fsi-japan.us-west-2.aws.postgres.snowflake.app
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=snowflake_admin
POSTGRES_PASSWORD=xxxxx
POSTGRES_SSL=true
```

### ビルド
```bash
npm run build
npm run start
```

---

## 次のステップ

1. React Query導入でデータフェッチ最適化
2. サイドバーナビゲーション追加
3. レスポンシブデザイン対応
4. キーボードショートカット
5. エクスポート機能（CSV）

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-03-03 | 1.0.0 | 初版作成 |
| 2026-03-04 | 1.1.0 | 改善提案・アーキテクチャ推奨を統合 |
| 2026-03-04 | 2.0.0 | shadcn/ui, ダークモード, 分析ページ, 検索, ページネーション実装 |
| 2026-03-05 | 2.1.0 | マルチカテゴリ対応（IT/人事/経理）、サイドバー追加 |
| 2026-03-05 | 2.1.1 | Node.jsバージョン要件追記、レイアウト修正 |
