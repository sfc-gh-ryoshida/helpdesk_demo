const { Pool } = require('pg');

// Load from environment variables or .env.local
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'your-host.postgres.snowflake.app',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'your_user',
  password: process.env.POSTGRES_PASSWORD || 'your_password',
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.knowledge_articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        category VARCHAR(50) NOT NULL,
        tags VARCHAR(200),
        views INTEGER DEFAULT 0,
        author VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created: knowledge_articles');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app.assets (
        id SERIAL PRIMARY KEY,
        asset_id VARCHAR(50) UNIQUE NOT NULL,
        asset_type VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        assignee VARCHAR(100),
        location VARCHAR(200),
        status VARCHAR(20) DEFAULT 'ACTIVE',
        purchase_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created: assets');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app.service_catalog (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        icon VARCHAR(50),
        sla_hours INTEGER DEFAULT 24,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created: service_catalog');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app.system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(20) DEFAULT 'string',
        description VARCHAR(500),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created: system_settings');

    // Insert sample data
    await client.query(`
      INSERT INTO app.knowledge_articles (title, content, category, views, author)
      VALUES 
        ('スキャナーが起動しない場合の対処法', '1. 電源ケーブルを確認\n2. バッテリーを確認\n3. 再起動を試す', 'HARDWARE', 128, '高橋美咲'),
        ('VPN接続エラーの解決手順', '1. ネットワーク接続を確認\n2. VPNクライアントを再起動\n3. IT部門に連絡', 'SOFTWARE', 95, '田中太郎'),
        ('パスワードリセット手順', '1. ログイン画面で「パスワードを忘れた」をクリック\n2. メールアドレスを入力\n3. メールのリンクからリセット', 'ACCOUNT', 234, '佐藤花子'),
        ('プリンター設定ガイド', '1. プリンターをネットワークに接続\n2. ドライバーをインストール\n3. テスト印刷', 'HARDWARE', 67, '高橋美咲')
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted: knowledge_articles sample data');

    await client.query(`
      INSERT INTO app.assets (asset_id, asset_type, name, assignee, location, status)
      VALUES 
        ('DEV-00123', 'SCANNER', 'Zebra TC52', '田中太郎', '第3倉庫', 'ACTIVE'),
        ('DEV-00124', 'PC', 'Dell Latitude 5520', '佐藤花子', '第1倉庫', 'ACTIVE'),
        ('DEV-00125', 'TABLET', 'iPad Pro 11', '鈴木一郎', '本社', 'MAINTENANCE'),
        ('DEV-00126', 'SCANNER', 'Zebra TC57', '山田次郎', '第2倉庫', 'ACTIVE'),
        ('DEV-00127', 'PC', 'HP EliteBook', '高橋美咲', '本社', 'ACTIVE')
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted: assets sample data');

    await client.query(`
      INSERT INTO app.service_catalog (title, description, category, icon, sla_hours)
      VALUES 
        ('PC申請', '新規PC・交換の申請', 'HARDWARE', 'Laptop', 72),
        ('アカウント作成', '新規システムアカウントの発行', 'ACCOUNT', 'Key', 24),
        ('VPN設定', 'リモートアクセス設定の申請', 'SOFTWARE', 'Wifi', 48),
        ('その他問い合わせ', '上記以外の問い合わせ', 'OTHER', 'HelpCircle', 120)
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted: service_catalog sample data');

    await client.query(`
      INSERT INTO app.system_settings (setting_key, setting_value, setting_type, description)
      VALUES 
        ('sla_high', '2', 'number', 'HIGH緊急度のSLA時間'),
        ('sla_medium', '8', 'number', 'MEDIUM緊急度のSLA時間'),
        ('sla_low', '24', 'number', 'LOW緊急度のSLA時間'),
        ('auto_escalate', 'true', 'boolean', 'SLA超過時の自動エスカレーション'),
        ('notify_new_ticket', 'true', 'boolean', '新規チケット通知'),
        ('notify_assign', 'true', 'boolean', 'アサイン通知'),
        ('notify_sla_warning', 'true', 'boolean', 'SLA警告通知'),
        ('notify_sla_breach', 'true', 'boolean', 'SLA超過通知')
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted: system_settings sample data');

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
