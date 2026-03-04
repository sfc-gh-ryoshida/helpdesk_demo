import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface Log {
  id: number;
  log_type: string;
  inquiry_id: number | null;
  user_id: string;
  channel_id: string;
  thread_ts: string;
  message: string;
  category: string;
  priority: string;
  summary: string;
  ai_response: string;
  evaluation: string;
  evaluation_comment: string;
  status: string;
  created_at: string;
  resolved_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const logType = searchParams.get("log_type");
  const ticketId = searchParams.get("ticket_id");
  const threadTs = searchParams.get("thread_ts");

  let sql = `
    SELECT * FROM app.helpdesk_logs
    WHERE 1=1
  `;
  const params: string[] = [];

  if (logType) {
    params.push(logType);
    sql += ` AND log_type = $${params.length}`;
  }

  if (threadTs) {
    params.push(threadTs);
    sql += ` AND thread_ts = $${params.length}`;
  } else if (ticketId) {
    params.push(ticketId);
    sql += ` AND thread_ts LIKE '%' || $${params.length} || '%'`;
  }

  sql += ` ORDER BY created_at ${(threadTs || ticketId) ? 'ASC' : 'DESC'} LIMIT 100`;

  try {
    const logs = await query<Log>(sql, params);
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
