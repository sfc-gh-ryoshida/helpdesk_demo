interface TicketInfo {
  ticket_id: string;
  summary: string;
  status?: string;
  assigned_to?: string;
  reporter_name?: string;
  urgency?: string;
  thread_ts?: string;
  source_channel?: string;
}

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_DEFAULT_CHANNEL = process.env.SLACK_DEFAULT_CHANNEL;

async function postToSlack(channel: string, text: string, threadTs?: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn("SLACK_BOT_TOKEN is not configured");
    return false;
  }

  try {
    const payload: Record<string, string> = {
      channel,
      text,
    };
    if (threadTs) {
      payload.thread_ts = threadTs;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("Slack API error:", data.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return false;
  }
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    OPEN: "🆕",
    IN_PROGRESS: "🔄",
    RESOLVED: "✅",
    CLOSED: "🔒",
    ESCALATED: "🚨",
  };
  return emojis[status] || "📋";
}

function resolveChannel(ticket: TicketInfo): string {
  const ch = ticket.source_channel;
  if (ch && ch !== "slack" && ch !== "web" && ch !== "email") {
    return ch;
  }
  return SLACK_DEFAULT_CHANNEL || "";
}

export async function notifyStatusChange(
  ticket: TicketInfo,
  oldStatus: string,
  newStatus: string,
  changedBy: string
): Promise<boolean> {
  const channel = resolveChannel(ticket);
  if (!channel) return false;

  const text = [
    `${getStatusEmoji(newStatus)} *ステータス変更通知*`,
    ``,
    `*チケット:* ${ticket.ticket_id}`,
    `*概要:* ${ticket.summary}`,
    `*変更:* ${oldStatus} → ${newStatus}`,
    `*変更者:* ${changedBy}`,
    `*報告者:* ${ticket.reporter_name || "不明"}`,
  ].join("\n");

  return postToSlack(channel, text, ticket.thread_ts);
}

export async function notifyNewComment(
  ticket: TicketInfo,
  author: string,
  content: string
): Promise<boolean> {
  const channel = resolveChannel(ticket);
  if (!channel) return false;

  const text = [
    `💬 *担当者からのコメント*`,
    ``,
    `*チケット:* ${ticket.ticket_id}`,
    `*担当者:* ${author}`,
    `───────────`,
    content,
  ].join("\n");

  return postToSlack(channel, text, ticket.thread_ts);
}

export async function notifyAssigneeChange(
  ticket: TicketInfo,
  oldAssignee: string | null,
  newAssignee: string,
  changedBy: string
): Promise<boolean> {
  const channel = resolveChannel(ticket);
  if (!channel) return false;

  const text = [
    `👤 *担当者変更通知*`,
    ``,
    `*チケット:* ${ticket.ticket_id}`,
    `*概要:* ${ticket.summary}`,
    `*変更:* ${oldAssignee || "未アサイン"} → ${newAssignee || "未アサイン"}`,
    `*変更者:* ${changedBy}`,
  ].join("\n");

  return postToSlack(channel, text, ticket.thread_ts);
}
