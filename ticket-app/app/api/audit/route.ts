import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface AuditLog {
  id: number;
  ticket_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  author: string;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "";
    const author = searchParams.get("author") || "";
    const limit = parseInt(searchParams.get("limit") || "100");

    let sql = `SELECT * FROM app.ticket_history WHERE 1=1`;
    const params: (string | number)[] = [];

    if (action && action !== "all") {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }

    if (author && author !== "all") {
      params.push(author);
      sql += ` AND author = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;
    params.push(limit);
    sql += ` LIMIT $${params.length}`;

    const logs = await query<AuditLog>(sql, params);

    const authors = await query<{ author: string }>(
      `SELECT DISTINCT author FROM app.ticket_history ORDER BY author`
    );

    return NextResponse.json({
      logs,
      authors: authors.map(a => a.author)
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
