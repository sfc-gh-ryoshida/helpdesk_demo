import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notifyStatusChange, notifyAssigneeChange, notifyNewComment } from "@/lib/slack";

interface Ticket {
  ticket_id: string;
  summary: string;
  reporter_name: string;
  urgency: string;
  status: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  thread_ts: string | null;
  source_channel: string | null;
}

function getTable(ticketId: string): string {
  return ticketId.startsWith("FIN-") ? "app.finance_tickets" : "app.helpdesk_tickets";
}

async function recordHistory(
  ticketId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  author: string
) {
  if (oldValue !== newValue) {
    try {
      await query(
        `INSERT INTO app.ticket_history (ticket_id, action, field, old_value, new_value, author)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ticketId, "変更", field, oldValue || "null", newValue || "null", author]
      );
    } catch (err) {
      console.warn("recordHistory skipped (FK constraint):", ticketId, field);
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const table = getTable(id);
    const tickets = await query(
      `SELECT * FROM ${table} WHERE ticket_id = $1`,
      [id]
    );
    if (tickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json(tickets[0]);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, assigned_to, resolution_notes, author = "システム" } = body;

    const table = getTable(id);
    const existing = await query<Ticket>(
      `SELECT ticket_id, summary, reporter_name, urgency, status, assigned_to, resolution_notes, thread_ts, source_channel FROM ${table} WHERE ticket_id = $1`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const oldTicket = existing[0];

    const result = await query<Ticket>(
      `UPDATE ${table} 
       SET status = COALESCE($1, status),
           assigned_to = COALESCE($2, assigned_to),
           resolution_notes = COALESCE($3, resolution_notes),
           updated_at = NOW(),
           resolved_at = CASE WHEN $1 IN ('RESOLVED', 'CLOSED') THEN NOW() ELSE resolved_at END
       WHERE ticket_id = $4
       RETURNING *`,
      [status, assigned_to, resolution_notes, id]
    );

    if (status && status !== oldTicket.status) {
      await recordHistory(id, "ステータス", oldTicket.status, status, author);
      notifyStatusChange(
        { ticket_id: id, summary: oldTicket.summary, reporter_name: oldTicket.reporter_name, urgency: oldTicket.urgency, thread_ts: oldTicket.thread_ts || undefined, source_channel: oldTicket.source_channel || undefined },
        oldTicket.status,
        status,
        author
      ).catch(err => console.error("Slack notification error:", err));
    }
    if (assigned_to !== undefined && assigned_to !== oldTicket.assigned_to) {
      await recordHistory(id, "担当者", oldTicket.assigned_to, assigned_to, author);
      notifyAssigneeChange(
        { ticket_id: id, summary: oldTicket.summary, reporter_name: oldTicket.reporter_name, urgency: oldTicket.urgency, thread_ts: oldTicket.thread_ts || undefined, source_channel: oldTicket.source_channel || undefined },
        oldTicket.assigned_to,
        assigned_to,
        author
      ).catch(err => console.error("Slack notification error:", err));
    }
    if (resolution_notes !== undefined && resolution_notes !== oldTicket.resolution_notes) {
      await recordHistory(id, "対応メモ", oldTicket.resolution_notes, resolution_notes, author);
      notifyNewComment(
        { ticket_id: id, summary: oldTicket.summary, reporter_name: oldTicket.reporter_name, urgency: oldTicket.urgency, thread_ts: oldTicket.thread_ts || undefined, source_channel: oldTicket.source_channel || undefined },
        author,
        resolution_notes || ""
      ).catch(err => console.error("Slack notification error:", err));
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
