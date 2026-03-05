import os
import json
import logging
import requests
from slack_bolt import App
from slack_bolt.adapter.aws_lambda import SlackRequestHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = App(
    token=os.environ.get("SLACK_BOT_TOKEN"),
    signing_secret=os.environ.get("SLACK_SIGNING_SECRET"),
    process_before_response=True
)

N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL")
# N8N_EVALUATION_URL is now derived from N8N_WEBHOOK_URL + "/webhook/helpdesk-evaluation"
SNOWFLAKE_PAT = os.environ.get("SNOWFLAKE_PAT")

CATEGORY_CONFIG = {
    "it_asset": {
        "label": "💻 IT・資産",
        "webhook_path": "/webhook/helpdesk",
        "description": "PC、ソフトウェア、ネットワーク関連"
    },
    "hr": {
        "label": "👤 人事",
        "webhook_path": "/webhook/hr",
        "description": "勤怠、休暇、福利厚生関連"
    },
    "finance": {
        "label": "💰 経理",
        "webhook_path": "/webhook/finance",
        "description": "経費精算、請求書、支払い関連"
    },
    "other": {
        "label": "❓ その他",
        "webhook_path": "/webhook/general",
        "description": "上記以外のお問い合わせ"
    }
}

pending_inquiries = {}

BOT_USER_ID = None
try:
    auth_response = app.client.auth_test()
    BOT_USER_ID = auth_response.get("user_id")
    logger.info(f"Bot User ID: {BOT_USER_ID}")
except Exception as e:
    logger.warning(f"Could not get bot user id: {e}")

def send_to_n8n(payload: dict, url: str = None) -> dict:
    target_url = url or N8N_WEBHOOK_URL
    try:
        headers = {"Content-Type": "application/json"}
        if SNOWFLAKE_PAT:
            headers["Authorization"] = f'Snowflake Token="{SNOWFLAKE_PAT}"'
        
        response = requests.post(
            target_url,
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        if response.text:
            try:
                return response.json()
            except:
                return {"status": "ok", "raw": response.text}
        return {"status": "ok"}
    except requests.exceptions.RequestException as e:
        logger.error(f"n8n webhook error: {e}")
        raise

def show_category_selection(event: dict, say, client):
    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts") or event.get("ts")
    user_id = event.get("user")
    text = event.get("text", "")
    
    import re
    text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()
    
    try:
        user_info = client.users_info(user=user_id)
        user_name = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        user_name = user_id
    
    pending_key = f"{channel_id}:{thread_ts}"
    pending_inquiries[pending_key] = {
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "user_id": user_id,
        "user_name": user_name,
        "message": text,
        "event_ts": event.get("ts")
    }
    
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"📝 お問い合わせを受け付けました。\n\n*ご用件のカテゴリを選択してください:*"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "💻 IT・資産", "emoji": True},
                    "value": f"{pending_key}|it_asset",
                    "action_id": "category_it_asset"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "👤 人事", "emoji": True},
                    "value": f"{pending_key}|hr",
                    "action_id": "category_hr"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "💰 経理", "emoji": True},
                    "value": f"{pending_key}|finance",
                    "action_id": "category_finance"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "❓ その他", "emoji": True},
                    "value": f"{pending_key}|other",
                    "action_id": "category_other"
                }
            ]
        }
    ]
    
    say(text="カテゴリを選択してください", blocks=blocks, thread_ts=thread_ts)

def process_inquiry_with_category(pending_key: str, category: str, say, client, channel_id: str, message_ts: str):
    inquiry = pending_inquiries.pop(pending_key, None)
    if not inquiry:
        logger.warning(f"No pending inquiry found for key: {pending_key}")
        return
    
    config = CATEGORY_CONFIG.get(category, CATEGORY_CONFIG["other"])
    base_url = N8N_WEBHOOK_URL.rsplit("/webhook", 1)[0] if N8N_WEBHOOK_URL else ""
    webhook_url = base_url + config["webhook_path"]
    
    client.chat_update(
        channel=channel_id,
        ts=message_ts,
        text=f"{config['label']} のお問い合わせとして処理中です...",
        blocks=[
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"✅ *{config['label']}* を選択しました。\n処理中です..."
                }
            }
        ]
    )
    
    payload = {
        **inquiry,
        "category": category,
        "category_label": config["label"]
    }
    
    try:
        result = send_to_n8n(payload, webhook_url)
        logger.info(f"n8n response for {category}: {result}")
    except Exception as e:
        client.chat_postMessage(
            channel=channel_id,
            thread_ts=inquiry["thread_ts"],
            text=f"⚠️ エラーが発生しました: {str(e)}"
        )

def process_mention(event: dict, say, client):
    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts") or event.get("ts")
    user_id = event.get("user")
    text = event.get("text", "")
    
    import re
    text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()
    
    try:
        user_info = client.users_info(user=user_id)
        user_name = user_info["user"]["real_name"] or user_info["user"]["name"]
    except Exception:
        user_name = user_id
    
    say(
        text="📝 お問い合わせを受け付けました。確認中です...",
        thread_ts=thread_ts
    )
    
    payload = {
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "user_id": user_id,
        "user_name": user_name,
        "message": text,
        "event_ts": event.get("ts")
    }
    
    try:
        result = send_to_n8n(payload)
        logger.info(f"n8n response: {result}")
    except Exception as e:
        say(
            text=f"⚠️ エラーが発生しました: {str(e)}",
            thread_ts=thread_ts
        )

@app.event("app_mention")
def handle_app_mention(event, say, client, ack):
    ack()
    show_category_selection(event, say, client)

@app.event("message")
def handle_message(event, say, client, ack):
    ack()
    
    logger.info(f"Message event: {json.dumps(event)}")
    
    # Skip bot messages and message subtypes (edits, deletes, etc.)
    if event.get("bot_id"):
        logger.info("Skipping: bot message")
        return
    
    if event.get("subtype"):
        logger.info(f"Skipping: subtype={event.get('subtype')}")
        return
    
    # Handle DM
    if event.get("channel_type") == "im":
        logger.info("Processing as DM")
        show_category_selection(event, say, client)
        return
    
    # Handle thread replies (follow-up messages in existing threads)
    thread_ts = event.get("thread_ts")
    ts = event.get("ts")
    
    logger.info(f"Thread check: thread_ts={thread_ts}, ts={ts}")
    
    if thread_ts and thread_ts != ts:
        logger.info("Processing as thread reply")
        process_mention(event, say, client)
    else:
        logger.info("Not a thread reply, skipping")

@app.command("/helpdesk")
def handle_helpdesk_command(ack, body, say):
    ack()
    user_id = body.get("user_id")
    text = body.get("text", "")
    channel_id = body.get("channel_id")
    
    if not text:
        say("使い方: `/helpdesk [問い合わせ内容]`")
        return
    
    say(text="📝 お問い合わせを受け付けました。確認中です...")
    
    payload = {
        "channel_id": channel_id,
        "thread_ts": None,
        "user_id": user_id,
        "user_name": user_id,
        "message": text,
        "source": "slash_command"
    }
    
    try:
        result = send_to_n8n(payload)
        logger.info(f"n8n response: {result}")
    except Exception as e:
        say(text=f"⚠️ エラーが発生しました: {str(e)}")

@app.action("resolved")
def handle_resolved(ack, body, client):
    ack()
    value_str = body.get("actions", [{}])[0].get("value", "{}")
    try:
        value_data = json.loads(value_str)
        log_id = value_data.get("log_id")
        ticket_id = value_data.get("ticket_id", "")
        category = value_data.get("category", "it")
    except json.JSONDecodeError:
        log_id = value_str
        ticket_id = ""
        category = "it"
    
    user_id = body.get("user", {}).get("id")
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    thread_ts = body.get("message", {}).get("thread_ts") or message_ts
    original_blocks = body.get("message", {}).get("blocks", [])
    
    logger.info(f"Resolved clicked: log_id={log_id}, ticket_id={ticket_id}, category={category}, user={user_id}")
    
    updated_blocks = [b for b in original_blocks if b.get("type") != "actions"]
    updated_blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": f"✅ *解決済み* | <@{user_id}> がマークしました"}]
    })
    
    original_text = body.get("message", {}).get("text", "AI応答")
    
    client.chat_update(
        channel=channel_id,
        ts=message_ts,
        text=original_text,
        blocks=updated_blocks
    )
    
    base_url = N8N_WEBHOOK_URL.rsplit("/webhook", 1)[0] if N8N_WEBHOOK_URL else ""
    evaluation_url = base_url + "/webhook/helpdesk-evaluation"
    
    payload = {
        "value": value_str,
        "log_id": log_id,
        "ticket_id": ticket_id,
        "category": category,
        "user_id": user_id,
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "evaluation": "resolved",
        "comment": ""
    }
    
    try:
        send_to_n8n(payload, evaluation_url)
    except Exception as e:
        logger.error(f"Failed to send resolved to n8n: {e}")

@app.action("escalate")
def handle_escalate(ack, body, client):
    ack()
    value_str = body.get("actions", [{}])[0].get("value", "{}")
    try:
        value_data = json.loads(value_str)
        log_id = value_data.get("log_id")
        ticket_id = value_data.get("ticket_id", "")
        category = value_data.get("category", "it")
    except json.JSONDecodeError:
        log_id = value_str
        ticket_id = ""
        category = "it"
    
    user_id = body.get("user", {}).get("id")
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    thread_ts = body.get("message", {}).get("thread_ts") or message_ts
    original_blocks = body.get("message", {}).get("blocks", [])
    
    logger.info(f"Escalate clicked: log_id={log_id}, ticket_id={ticket_id}, category={category}, user={user_id}")
    
    updated_blocks = [b for b in original_blocks if b.get("type") != "actions"]
    updated_blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": f"🚨 *エスカレーション* | <@{user_id}> が有人対応を要請しました"}]
    })
    
    original_text = body.get("message", {}).get("text", "AI応答")
    
    client.chat_update(
        channel=channel_id,
        ts=message_ts,
        text=original_text,
        blocks=updated_blocks
    )
    
    base_url = N8N_WEBHOOK_URL.rsplit("/webhook", 1)[0] if N8N_WEBHOOK_URL else ""
    evaluation_url = base_url + "/webhook/helpdesk-evaluation"
    
    payload = {
        "value": value_str,
        "log_id": log_id,
        "ticket_id": ticket_id,
        "category": category,
        "user_id": user_id,
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "evaluation": "escalate",
        "comment": ""
    }
    
    try:
        send_to_n8n(payload, evaluation_url)
    except Exception as e:
        logger.error(f"Failed to send escalate to n8n: {e}")

@app.action("category_it_asset")
def handle_category_it_asset(ack, body, client, say):
    ack()
    value = body.get("actions", [{}])[0].get("value", "")
    pending_key, category = value.rsplit("|", 1)
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    process_inquiry_with_category(pending_key, "it_asset", say, client, channel_id, message_ts)

@app.action("category_hr")
def handle_category_hr(ack, body, client, say):
    ack()
    value = body.get("actions", [{}])[0].get("value", "")
    pending_key, category = value.rsplit("|", 1)
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    process_inquiry_with_category(pending_key, "hr", say, client, channel_id, message_ts)

@app.action("category_finance")
def handle_category_finance(ack, body, client, say):
    ack()
    value = body.get("actions", [{}])[0].get("value", "")
    pending_key, category = value.rsplit("|", 1)
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    process_inquiry_with_category(pending_key, "finance", say, client, channel_id, message_ts)

@app.action("category_other")
def handle_category_other(ack, body, client, say):
    ack()
    value = body.get("actions", [{}])[0].get("value", "")
    pending_key, category = value.rsplit("|", 1)
    channel_id = body.get("channel", {}).get("id")
    message_ts = body.get("message", {}).get("ts")
    process_inquiry_with_category(pending_key, "other", say, client, channel_id, message_ts)

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    
    headers = event.get("headers", {})
    if headers.get("X-Slack-Retry-Num") or headers.get("x-slack-retry-num"):
        logger.info("Ignoring Slack retry")
        return {"statusCode": 200, "body": "ok"}
    
    body = event.get("body", "")
    if isinstance(body, str):
        try:
            body_json = json.loads(body)
        except:
            body_json = {}
    else:
        body_json = body
    
    if body_json.get("type") == "url_verification":
        challenge = body_json.get("challenge", "")
        logger.info(f"URL verification challenge: {challenge}")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/plain"},
            "body": challenge
        }
    
    slack_handler = SlackRequestHandler(app=app)
    return slack_handler.handle(event, context)

if __name__ == "__main__":
    app.start(port=3000)
