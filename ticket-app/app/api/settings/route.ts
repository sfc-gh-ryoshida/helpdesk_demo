import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface Setting {
  id: number;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  description: string | null;
  updated_at: string;
}

export async function GET() {
  try {
    const settings = await query<Setting>(
      `SELECT * FROM app.system_settings ORDER BY setting_key`
    );

    const settingsMap = settings.reduce((acc, s) => {
      let value: string | number | boolean = s.setting_value || "";
      if (s.setting_type === "number") value = parseInt(s.setting_value || "0");
      if (s.setting_type === "boolean") value = s.setting_value === "true";
      return { ...acc, [s.setting_key]: value };
    }, {});

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      await query(
        `UPDATE app.system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2`,
        [String(value), key]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
