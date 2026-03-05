import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await query(
      `UPDATE app.knowledge_articles SET views = views + 1 WHERE id = $1`,
      [params.id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update views" }, { status: 500 });
  }
}
