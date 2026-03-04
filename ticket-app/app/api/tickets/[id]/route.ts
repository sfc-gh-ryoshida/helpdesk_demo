import { NextResponse } from "next/server";import type { NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tickets = await query(
      `SELECT * FROM app.helpdesk_tickets WHERE ticket_id = $1`,
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
    const { status, assigned_to, resolution_notes } = body;

    const result = await query(
      `UPDATE app.helpdesk_tickets 
       SET status = COALESCE($1, status),
           assigned_to = COALESCE($2, assigned_to),
           resolution_notes = COALESCE($3, resolution_notes),
           resolved_at = CASE WHEN $1 IN ('RESOLVED', 'CLOSED') THEN NOW() ELSE resolved_at END
       WHERE ticket_id = $4
       RETURNING *`,
      [status, assigned_to, resolution_notes, id]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
