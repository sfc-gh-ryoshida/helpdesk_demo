import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface Comment {
  id: number;
  ticket_id: string;
  author: string;
  content: string;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = await query<Comment>(
      `SELECT id, ticket_id, author, content, created_at
       FROM app.ticket_comments
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
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
    const { author, content } = body;

    if (!author || !content) {
      return NextResponse.json(
        { error: "Author and content are required" },
        { status: 400 }
      );
    }

    const result = await query<Comment>(
      `INSERT INTO app.ticket_comments (ticket_id, author, content)
       VALUES ($1, $2, $3)
       RETURNING id, ticket_id, author, content, created_at`,
      [id, author, content]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
