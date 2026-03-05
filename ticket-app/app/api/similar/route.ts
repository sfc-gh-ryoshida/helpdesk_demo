import { NextResponse } from "next/server";
import snowflake from "snowflake-sdk";
import * as fs from "fs";
import * as path from "path";

interface ConnectionConfig {
  account: string;
  user: string;
  password?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
}

let cachedConnection: snowflake.Connection | null = null;
let connectionPromise: Promise<snowflake.Connection> | null = null;

function parseToml(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = {};
      continue;
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
    if (kvMatch && currentSection) {
      result[currentSection][kvMatch[1]] = kvMatch[2];
    }
  }
  return result;
}

function getConnectionConfig(): ConnectionConfig {
  const connectionsPath = path.join(process.cwd(), "snowflake-connection.toml");

  try {
    const content = fs.readFileSync(connectionsPath, "utf-8");
    const connections = parseToml(content);
    const conn = connections["fsi_japan_connection"];

    if (conn) {
      return {
        account: conn.account,
        user: conn.user,
        password: conn.password,
        warehouse: conn.warehouse,
        database: conn.database || "HELPDESK_DB",
        schema: conn.schema || "APP",
      };
    }
  } catch (e) {
    console.log("Could not read snowflake-connection.toml:", e);
  }

  return {
    account: process.env.SNOWFLAKE_ACCOUNT || "YOUR_ACCOUNT",
    user: process.env.SNOWFLAKE_USER || "YOUR_USER",
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "YOUR_WAREHOUSE",
    database: "HELPDESK_DB",
    schema: "APP",
  };
}

async function getConnection(): Promise<snowflake.Connection> {
  if (cachedConnection && cachedConnection.isUp()) {
    return cachedConnection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    const config = getConnectionConfig();

    const connectionOptions: snowflake.ConnectionOptions = {
      account: config.account,
      username: config.user,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
    };

    const connection = snowflake.createConnection(connectionOptions);

    connection.connect((err) => {
      connectionPromise = null;
      if (err) {
        cachedConnection = null;
        reject(err);
        return;
      }
      cachedConnection = connection;
      resolve(connection);
    });
  });

  return connectionPromise;
}

async function searchSimilar(query: string, category: string, limit: number = 5) {
  const connection = await getConnection();

  return new Promise((resolve, reject) => {
    let serviceName: string;
    let columns: string[];

    if (category === "finance") {
      serviceName = "HELPDESK_DB.APP.FINANCE_SEARCH_SERVICE";
      columns = ["ID", "CATEGORY", "QUESTION", "ANSWER"];
    } else if (category === "hr") {
      serviceName = "HELPDESK_DB.APP.HR_SEARCH_SERVICE";
      columns = ["ID", "CATEGORY", "QUESTION", "ANSWER"];
    } else {
      serviceName = "HELPDESK_DB.APP.KNOWLEDGE_SEARCH_SERVICE";
      columns = ["KB_ID", "CATEGORY", "QUESTION", "ANSWER"];
    }

    const searchParams = JSON.stringify({
      query: query,
      columns: columns,
      limit: limit,
    }).replace(/'/g, "''");

    const sql = `SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${serviceName}', '${searchParams}') AS result`;

    connection.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) {
          cachedConnection = null;
          reject(err);
          return;
        }

        if (rows && rows.length > 0) {
          try {
            const resultStr = rows[0].RESULT as string;
            const result = JSON.parse(resultStr);
            resolve(result.results || []);
          } catch {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      },
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const category = searchParams.get("category") || "it";
  const limit = parseInt(searchParams.get("limit") || "5");

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    const results = await searchSimilar(query, category, limit);

    const formattedResults = (results as Record<string, unknown>[]).map((r) => {
      const scores = r["@scores"] as { cosine_similarity?: number; reranker_score?: number } | undefined;
      return {
        id: r.KB_ID || r.ID,
        category: r.CATEGORY,
        question: r.QUESTION,
        answer: r.ANSWER,
        similarity: scores?.cosine_similarity || 0,
        reranker_score: scores?.reranker_score || 0,
      };
    });

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Error searching similar:", error);
    return NextResponse.json({ error: "Failed to search similar items" }, { status: 500 });
  }
}
