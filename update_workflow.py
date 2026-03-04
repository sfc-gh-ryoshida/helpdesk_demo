import json

with open('/Users/ryoshida/Desktop/env/n8n/smart_helpdesk/Smart_Helpdesk___Snowflake_Agent.json', 'r') as f:
    data = json.load(f)

new_skip_code = r'''const webhookData = $('Webhook').first().json.body;
const message = (webhookData.message || '').trim();
const logId = $('Log Inquiry').first().json.id;
const threadTs = webhookData.thread_ts || '';

const thankPatterns = [
  /^(ありがとう|有難う|感謝|サンクス|thanks|thank you)/i,
  /^(了解|りょうかい|わかりました|承知|ok|オッケー)/i,
  /^(助かり|たすかり)/i
];

for (const p of thankPatterns) {
  if (p.test(message)) {
    return {
      json: {
        skipAgent: true,
        skipReason: 'thank_you',
        message: message,
        logId: logId,
        threadTs: threadTs,
        responseText: '👍 ご連絡ありがとうございます。他にご質問があればお気軽にどうぞ！'
      }
    };
  }
}

const infoPatterns = [
  /^[\d\-]{4,}$/,
  /^[\w\.\-]+@[\w\.\-]+\.[a-z]{2,}$/i,
  /社員番号[はがを]?[:：\s]*[\d\-]+/,
  /(社員|従業員)?\s*(番号|No\.?|ナンバー|ID)[はがを]?[:：\s]*[\d\-]+/i,
  /名前[はがを]?[:：\s]*.+です$/,
  /私[はが]?.+です$/,
  /(メール|メアド|email)[はがを]?[:：\s]*[\w\.\-]+@/i,
  /電話[はがを]?[:：\s]*[\d\-]+/,
  /ログインID[はがを]?[:：\s]*/i,
  /^[a-zA-Z][a-zA-Z0-9_]{2,}$/
];

for (const p of infoPatterns) {
  if (p.test(message)) {
    return {
      json: {
        skipAgent: true,
        skipReason: 'info_only',
        message: message,
        logId: logId,
        threadTs: threadTs,
        responseText: '📝 情報を受け取りました。確認いたします。'
      }
    };
  }
}

const cleanMsg = message.replace(/[\n\r]/g, ' ').trim();
if (cleanMsg.length <= 50 && /^[\d\w@\.\-\ \u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+$/.test(cleanMsg)) {
  const hasNumber = /\d/.test(cleanMsg);
  const hasAt = /@/.test(cleanMsg);
  const looksLikeId = /^[a-zA-Z][a-zA-Z0-9_\-]{2,}/.test(cleanMsg);
  if (hasNumber || hasAt || looksLikeId) {
    return {
      json: {
        skipAgent: true,
        skipReason: 'short_data',
        message: message,
        logId: logId,
        threadTs: threadTs,
        responseText: '📝 情報を受け取りました。確認いたします。'
      }
    };
  }
}

return {
  json: {
    skipAgent: false,
    message: message,
    logId: logId,
    threadTs: threadTs
  }
};'''

new_build_code = r'''const webhookData = $('Webhook').first().json.body;
const historyRows = $('Fetch Conversation History').all();
const currentMessage = webhookData.message;

const messages = [];

for (const row of historyRows) {
  if (row.json.log_type === 'INQUIRY') {
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: row.json.message }]
    });
  } else if (row.json.log_type === 'AI_RESPONSE' && row.json.ai_response_text) {
    messages.push({
      role: 'assistant',
      content: [{ type: 'text', text: row.json.ai_response_text }]
    });
  }
}

messages.push({
  role: 'user',
  content: [{ type: 'text', text: currentMessage }]
});

const payload = JSON.stringify({ messages });
const base64Payload = Buffer.from(payload).toString('base64');

return {
  json: {
    messages,
    messageCount: messages.length,
    isMultiTurn: messages.length > 1,
    agentPayloadBase64: base64Payload
  }
};'''

new_query = r'''SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  'HELPDESK_DB.APP.HELPDESK_AGENT',
  PARSE_JSON(BASE64_DECODE_STRING('{{ $json.agentPayloadBase64 }}'))
) AS response;'''

for node in data['nodes']:
    if node['name'] == 'Check Skip Agent':
        node['parameters']['jsCode'] = new_skip_code
        print('Updated Check Skip Agent')
    elif node['name'] == 'Build Messages':
        node['parameters']['jsCode'] = new_build_code
        print('Updated Build Messages')
    elif node['name'] == 'Call Cortex Agent':
        node['parameters']['query'] = new_query
        print('Updated Call Cortex Agent')

with open('/Users/ryoshida/Desktop/env/n8n/smart_helpdesk/Smart_Helpdesk___Snowflake_Agent.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Done!')
