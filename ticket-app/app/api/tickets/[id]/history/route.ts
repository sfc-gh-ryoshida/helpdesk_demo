import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface HistoryItem {
  id: number;
  ticket_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  author: string;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await query<HistoryItem>(
      `SELECT id, ticket_id, action, field, old_value, new_value, author, created_at
       FROM app.ticket_history
       WHERE ticket_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, field, old_value, new_value, author } = body;

    if (!action || !author) {
      return NextResponse.json(
        { error: "Action and author are required" },
        { status: 400 }
      );
    }

    const result = await query<HistoryItem>(
      `INSERT INTO app.ticket_history (ticket_id, action, field, old_value, new_value, author)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, ticket_id, action, field, old_value, new_value, author, created_at`,
      [id, action, field || null, old_value || null, new_value || null, author]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating history:", error);
    return NextResponse.json(
      { error: "Failed to create history" },
      { status: 500 }
    );
  }
}
