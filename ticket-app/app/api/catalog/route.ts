import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface CatalogItem {
  id: number;
  title: string;
  description: string | null;
  category: string;
  icon: string | null;
  sla_hours: number;
  active: boolean;
  created_at: string;
}

export async function GET() {
  try {
    const items = await query<CatalogItem>(
      `SELECT * FROM app.service_catalog WHERE active = true ORDER BY id`
    );
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching catalog:", error);
    return NextResponse.json({ error: "Failed to fetch catalog" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, category, icon, sla_hours } = body;

    if (!title || !category) {
      return NextResponse.json({ error: "Title and category required" }, { status: 400 });
    }

    const result = await query<CatalogItem>(
      `INSERT INTO app.service_catalog (title, description, category, icon, sla_hours)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description || null, category, icon || null, sla_hours || 24]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating catalog item:", error);
    return NextResponse.json({ error: "Failed to create catalog item" }, { status: 500 });
  }
}
