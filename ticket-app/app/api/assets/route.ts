import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface Asset {
  id: number;
  asset_id: string;
  asset_type: string;
  name: string;
  assignee: string | null;
  location: string | null;
  status: string;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";

    let sql = `SELECT * FROM app.assets WHERE 1=1`;
    const params: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (asset_id ILIKE $${params.length} OR name ILIKE $${params.length} OR assignee ILIKE $${params.length})`;
    }

    if (type && type !== "all") {
      params.push(type);
      sql += ` AND asset_type = $${params.length}`;
    }

    if (status && status !== "all") {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY asset_id`;

    const assets = await query<Asset>(sql, params);

    const stats = await query<{ asset_type: string; count: string }>(
      `SELECT asset_type, COUNT(*) as count FROM app.assets GROUP BY asset_type`
    );
    const maintenanceCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM app.assets WHERE status = '修理中'`
    );
    const totalCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM app.assets`
    );

    return NextResponse.json({
      assets,
      stats: {
        total: parseInt(totalCount[0]?.count || "0"),
        byType: stats.reduce((acc, s) => ({ ...acc, [s.asset_type]: parseInt(s.count) }), {}),
        maintenance: parseInt(maintenanceCount[0]?.count || "0")
      }
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asset_id, asset_type, name, assignee, location, status } = body;

    if (!asset_id || !asset_type || !name) {
      return NextResponse.json({ error: "asset_id, asset_type, name required" }, { status: 400 });
    }

    const result = await query<Asset>(
      `INSERT INTO app.assets (asset_id, asset_type, name, assignee, location, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [asset_id, asset_type, name, assignee || null, location || null, status || "ACTIVE"]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, asset_type, name, assignee, location, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const result = await query<Asset>(
      `UPDATE app.assets 
       SET asset_type = COALESCE($2, asset_type),
           name = COALESCE($3, name),
           assignee = COALESCE($4, assignee),
           location = COALESCE($5, location),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, asset_type, name, assignee, location, status]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await query(`DELETE FROM app.assets WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
