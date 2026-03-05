import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string | null;
  category: string;
  tags: string | null;
  views: number;
  author: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    let sql = `SELECT * FROM app.knowledge_articles WHERE 1=1`;
    const params: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`;
    }

    if (category && category !== "all") {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY views DESC`;

    const articles = await query<KnowledgeArticle>(sql, params);
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching knowledge:", error);
    return NextResponse.json({ error: "Failed to fetch knowledge" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, category, tags, author } = body;

    if (!title || !category) {
      return NextResponse.json({ error: "Title and category required" }, { status: 400 });
    }

    const result = await query<KnowledgeArticle>(
      `INSERT INTO app.knowledge_articles (title, content, category, tags, author)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, content || null, category, tags || null, author || null]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating knowledge:", error);
    return NextResponse.json({ error: "Failed to create knowledge" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, content, category, tags } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const result = await query<KnowledgeArticle>(
      `UPDATE app.knowledge_articles 
       SET title = COALESCE($2, title),
           content = COALESCE($3, content),
           category = COALESCE($4, category),
           tags = COALESCE($5, tags),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, title, content, category, tags]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating knowledge:", error);
    return NextResponse.json({ error: "Failed to update knowledge" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await query(`DELETE FROM app.knowledge_articles WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting knowledge:", error);
    return NextResponse.json({ error: "Failed to delete knowledge" }, { status: 500 });
  }
}
