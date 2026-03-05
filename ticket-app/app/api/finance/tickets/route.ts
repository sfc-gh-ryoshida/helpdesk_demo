import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface FinanceTicket {
  ticket_id: string;
  reporter_name: string;
  reporter_employee_id: string;
  location: string;
  issue_type: string;
  urgency: string;
  summary: string;
  details: object;
  status: string;
  assigned_to: string;
  resolution_notes: string;
  source_channel: string;
  thread_ts: string;
  log_id: string;
  created_at: string;
  updated_at: string;
  resolved_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const urgency = searchParams.get("urgency");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let sql = `SELECT * FROM app.finance_tickets WHERE 1=1`;
  let countSql = `SELECT COUNT(*) as total FROM app.finance_tickets WHERE 1=1`;
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (status) {
    params.push(status);
    countParams.push(status);
    sql += ` AND status = $${params.length}`;
    countSql += ` AND status = $${countParams.length}`;
  }
  if (urgency) {
    params.push(urgency);
    countParams.push(urgency);
    sql += ` AND urgency = $${params.length}`;
    countSql += ` AND urgency = $${countParams.length}`;
  }
  if (search) {
    const searchPattern = `%${search}%`;
    params.push(searchPattern);
    countParams.push(searchPattern);
    sql += ` AND (ticket_id ILIKE $${params.length} OR reporter_name ILIKE $${params.length} OR summary ILIKE $${params.length} OR location ILIKE $${params.length})`;
    countSql += ` AND (ticket_id ILIKE $${countParams.length} OR reporter_name ILIKE $${countParams.length} OR summary ILIKE $${countParams.length} OR location ILIKE $${countParams.length})`;
  }

  sql += ` ORDER BY created_at DESC`;
  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  params.push(offset);
  sql += ` OFFSET $${params.length}`;

  try {
    const [tickets, countResult] = await Promise.all([
      query<FinanceTicket>(sql, params),
      query<{ total: string }>(countSql, countParams),
    ]);

    const total = parseInt(countResult[0]?.total || "0");

    return NextResponse.json({
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching Finance tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch Finance tickets" },
      { status: 500 }
    );
  }
}
