# Slack → n8n 連携設定ガイド

## 概要

Slackチャンネルに投稿されたメッセージをn8nのワークフローに渡し、AI処理後に結果をSlackに返信する仕組みを構築します。

**社内制約**: Slack Apps（Bot）は使用せず、**ワークフロービルダー**を使用

---

## 全体フロー

```
[ユーザー] 
    │ 
    │ ① メッセージ投稿「スキャナーが動かない」
    ▼
[Slack #ryoshida-demo_helpdesk-request]
    │
    │ ② ワークフロービルダーがトリガー
    │    → 「Webhookを送信」ステップでn8nにPOST
    ▼
[n8n Webhook エンドポイント]
    │
    │ ③ AI処理（Cortex Agent + Knowledge Search）
    │
    │ ④ 結果をSlack Incoming Webhookで返信
    ▼
[Slack #ryoshida-demo_helpdesk-request]
    │
    ▼
[ユーザーに回答が届く]
```

---

## Part 1: Slack側の設定

### Step 1: チャンネル作成

1. Slackで新規チャンネルを作成
   - 名前: `#ryoshida-demo_helpdesk-request`

---

### Step 2: Incoming Webhook作成（n8n → Slack への返信用）

Slackの**Incoming Webhook**アプリを使用して、n8nからSlackにメッセージを投稿できるようにします。

#### 2.1 Incoming Webhookアプリを追加

1. Slack App Directory にアクセス: https://slack.com/apps
2. 「Incoming Webhooks」を検索してインストール
3. 「Add to Slack」をクリック
4. 投稿先チャンネル: `#ryoshida-demo_helpdesk-request` を選択
5. 「Add Incoming Webhooks integration」をクリック

#### 2.2 Webhook URLをコピー

発行されたURLをメモ（n8nで使用）:
```
https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXXXXXXXXXXXXX
```

> **注意**: このURLは秘密情報です。外部に公開しないでください。

---

### Step 3: ワークフロービルダー設定（Slack → n8n への転送用）

#### 3.1 ワークフロー作成

1. Slackで **ツール** → **ワークフロービルダー** を開く
2. **新しいワークフロー** をクリック
3. 名前: `Helpdesk Request Forward`

#### 3.2 トリガー設定

1. 「ワークフローを開始する方法を選択」で **「チャンネルで新しいメッセージが投稿されたとき」** を選択
2. チャンネル: `#ryoshida-demo_helpdesk-request` を選択
3. 続行

#### 3.3 ステップ追加: Webhookを送信

1. **ステップを追加** → **Webhookを送信** を選択
2. 設定:

| 項目 | 値 |
|------|-----|
| URL | `https://<n8n-endpoint>.snowflakecomputing.app/webhook/helpdesk` |
| 認証タイプ | なし（またはBasic認証） |

3. **変数を設定**（リクエスト本文に含める）:

「変数を追加」をクリックして以下を設定:

| 変数名 | 挿入する値 |
|--------|-----------|
| `text` | `メッセージのテキスト` を選択 |
| `user_name` | `送信者の名前` を選択 |
| `user_id` | `送信者のID` を選択 |
| `channel` | `チャンネル` を選択 |
| `ts` | `メッセージのタイムスタンプ` を選択 |

4. **保存**

#### 3.4 公開

1. **公開** をクリック
2. ワークフローが有効になる

---

### Slackから送信されるJSONの例

n8nには以下のようなJSONが届きます:

```json
{
  "text": "第3倉庫の田中です。スキャナーが起動しません。バッテリーは充電したのですが...",
  "user_name": "田中太郎",
  "user_id": "U0123456789",
  "channel": "#ryoshida-demo_helpdesk-request",
  "ts": "1708900000.000000"
}
```

---

## Part 2: n8n側の設定

### Step 1: Webhookノード（受信用）

Slackからのメッセージを受け取るエンドポイントを作成します。

#### ノード設定

| 項目 | 値 |
|------|-----|
| ノードタイプ | `Webhook` |
| HTTP Method | `POST` |
| Path | `helpdesk` |
| Response Mode | `Immediately` |

これにより、以下のURLでリクエストを受け付けます:
```
https://<n8n-endpoint>.snowflakecomputing.app/webhook/helpdesk
```

#### 受信データの参照方法

- メッセージ本文: `{{ $json.text }}`
- 投稿者名: `{{ $json.user_name }}`
- 投稿者ID: `{{ $json.user_id }}`
- チャンネル: `{{ $json.channel }}`
- タイムスタンプ: `{{ $json.ts }}`

---

### Step 2: AI処理ノード（MCP経由でCortex Agent呼び出し）

受信したメッセージをCortex Agentに渡してFAQ検索・回答生成を行います。

#### HTTP Requestノードの設定例（MCP Server呼び出し）

| 項目 | 値 |
|------|-----|
| Method | `POST` |
| URL | Snowflake MCP Server エンドポイント |
| Body | 下記参照 |

```json
{
  "tool": "auto-responder",
  "input": {
    "message": "{{ $json.text }}",
    "user": "{{ $json.user_name }}"
  }
}
```

#### Cortex Agentからの応答例

```json
{
  "can_resolve": true,
  "confidence": 0.85,
  "matched_kb_id": "KB001",
  "response": "バッテリー切れまたはバッテリー劣化の可能性があります。充電器に30分以上接続してから再度電源を入れてください。",
  "resolution_steps": [
    "1. 充電器に接続して30分待つ",
    "2. 電源ボタンを5秒長押し",
    "3. バッテリーを一度外して再装着",
    "4. 改善しない場合はヘルプデスクへ連絡"
  ],
  "needs_escalation": false
}
```

---

### Step 3: 分岐処理（IF Node）

AIが解決可能かどうかで処理を分岐します。

#### 条件

```
{{ $json.can_resolve }} == true AND {{ $json.confidence }} >= 0.6
```

- **True** → AI回答をSlackに返信
- **False** → チケット登録 + エスカレーション通知

---

### Step 4: Slack返信ノード（HTTP Request）

AI処理の結果をSlackに投稿します。

#### ノード設定

| 項目 | 値 |
|------|-----|
| Method | `POST` |
| URL | `https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXXXXXXXXXXXXX`（Step 2.2で取得したURL） |
| Content Type | `JSON` |

#### Body（AI回答の場合）

```json
{
  "text": "🤖 *AIヘルプデスクからの回答*\n\n{{ $json.response }}\n\n📋 *解決手順:*\n{{ $json.resolution_steps.join('\\n') }}\n\n_信頼度: {{ $json.confidence }} | 参照: {{ $json.matched_kb_id }}_"
}
```

#### Body（エスカレーションの場合）

```json
{
  "text": "🎫 *チケットを登録しました*\n\nチケットID: {{ $json.ticket_id }}\n種別: {{ $json.issue_type }}\n緊急度: {{ $json.urgency }}\n\n担当者が順次対応いたします。"
}
```

---

## Part 3: n8nワークフロー全体像

```
┌─────────────────┐
│    Webhook      │  ← Slackからメッセージ受信
│  /helpdesk      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │  ← Cortex Agent呼び出し（FAQ検索・AI回答生成）
│  (MCP Server)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│       IF        │  ← can_resolve && confidence >= 0.6 ?
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   True      False
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│ HTTP  │ │ Postgres  │  ← チケット登録
│Request│ │  Insert   │
│(Slack)│ └─────┬─────┘
└───────┘       │
    │           ▼
    │     ┌───────────┐
    │     │   HTTP    │  ← エスカレーション通知
    │     │  Request  │
    │     │  (Slack)  │
    │     └───────────┘
    │           │
    └─────┬─────┘
          │
          ▼
       [完了]
```

---

## 環境変数

n8nのspec.yamlに以下を追加:

```yaml
env:
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXXXXXXXXXXXXX"
```

---

## 動作確認手順

### テスト1: Slack → n8n

1. `#ryoshida-demo_helpdesk-request` に投稿:
   ```
   テスト投稿です
   ```
2. n8nのWebhookが発火することを確認（n8n UIのExecutionsで確認）

### テスト2: AI回答確認

1. `#ryoshida-demo_helpdesk-request` に投稿:
   ```
   スキャナーの電源が入りません
   ```
2. AIからの回答がSlackに投稿されることを確認

### テスト3: エスカレーション確認

1. `#ryoshida-demo_helpdesk-request` に投稿:
   ```
   スキャナーの画面が割れました
   ```
2. チケット登録通知がSlackに投稿されることを確認

---

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| Slackからn8nにメッセージが届かない | ワークフロービルダーが無効 | Slackでワークフローを「公開」する |
| n8nからSlackに投稿できない | Webhook URLが間違っている | Incoming Webhook URLを再確認 |
| ワークフロービルダーで「チャンネルで新しいメッセージ」が選べない | Slackプランの制限 | ショートカット方式（手動トリガー）に切り替え |

---

## チェックリスト

### Slack側
- [ ] `#ryoshida-demo_helpdesk-request` チャンネル作成
- [ ] Incoming Webhooksアプリ追加
- [ ] Webhook URL取得（n8n → Slack用）
- [ ] ワークフロービルダーでトリガー設定（Slack → n8n用）
- [ ] ワークフローを公開

### n8n側
- [ ] Webhookノード作成（Path: `helpdesk`）
- [ ] MCP Server呼び出し設定
- [ ] IF分岐ノード設定
- [ ] Slack返信用HTTP Requestノード設定
- [ ] 環境変数 `SLACK_WEBHOOK_URL` 設定

### テスト
- [ ] Slack投稿 → n8n受信確認
- [ ] AI回答返信確認
- [ ] エスカレーション通知確認
