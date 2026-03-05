import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key) env[key.trim()] = val.join("=").trim();
});

const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: parseInt(env.POSTGRES_PORT || "5432"),
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const ASSETS = [
  { asset_id: "AST-001", asset_type: "ノートPC", name: "ノートPC ThinkPad X1", assignee: "田中太郎", location: "東京本社 3F", status: "使用中", purchase_date: "2024-01-15", notes: "メモリ16GB、SSD 512GB" },
  { asset_id: "AST-002", asset_type: "ノートPC", name: "ノートPC MacBook Pro", assignee: "佐藤花子", location: "東京本社 4F", status: "使用中", purchase_date: "2024-03-01", notes: "メモリ18GB、SSD 512GB" },
  { asset_id: "AST-003", asset_type: "デスクトップPC", name: "デスクトップPC OptiPlex", assignee: "鈴木一郎", location: "東京本社 2F", status: "使用中", purchase_date: "2023-06-20", notes: "メモリ32GB、SSD 1TB" },
  { asset_id: "AST-004", asset_type: "モニター", name: "モニター 27インチ", assignee: "田中太郎", location: "東京本社 3F", status: "使用中", purchase_date: "2024-02-10", notes: "4K対応、USB-Cハブ内蔵" },
  { asset_id: "AST-005", asset_type: "プリンター", name: "プリンター カラー複合機", assignee: null, location: "東京本社 1F 共有エリア", status: "共有", purchase_date: "2023-09-01", notes: "カラー印刷、スキャン、FAX対応" },
  { asset_id: "AST-006", asset_type: "ノートPC", name: "ノートPC ThinkPad予備", assignee: null, location: "IT倉庫", status: "在庫", purchase_date: "2024-04-01", notes: "貸出用予備機" },
  { asset_id: "AST-007", asset_type: "ノートPC", name: "ノートPC 修理中", assignee: "山田次郎", location: "IT部", status: "修理中", purchase_date: "2023-08-15", notes: "キーボード故障、修理依頼中" },
  { asset_id: "AST-008", asset_type: "スマートフォン", name: "スマートフォン iPhone", assignee: "高橋美咲", location: "東京本社 3F", status: "使用中", purchase_date: "2024-05-01", notes: "会社支給携帯" },
  { asset_id: "AST-009", asset_type: "タブレット", name: "タブレット iPad", assignee: "渡辺健", location: "大阪支社", status: "使用中", purchase_date: "2024-02-20", notes: "プレゼン用" },
  { asset_id: "AST-010", asset_type: "ノートPC", name: "ノートPC 廃棄予定", assignee: null, location: "IT倉庫", status: "廃棄予定", purchase_date: "2020-01-10", notes: "保証切れ、データ消去待ち" },
];

const client = await pool.connect();
try {
  await client.query("DELETE FROM app.assets");
  console.log("既存データを削除しました");

  for (const asset of ASSETS) {
    await client.query(
      `INSERT INTO app.assets (asset_id, asset_type, name, assignee, location, status, purchase_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [asset.asset_id, asset.asset_type, asset.name, asset.assignee, asset.location, asset.status, asset.purchase_date, asset.notes]
    );
  }
  console.log(`${ASSETS.length}件の資産データを同期しました`);
} finally {
  client.release();
  await pool.end();
}
