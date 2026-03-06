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
  host?: string;
  token?: string;
  authenticator?: string;
}

let cachedConnection: snowflake.Connection | null = null;
let connectionPromise: Promise<snowflake.Connection> | null = null;
let connectionCreatedAt: number = 0;
const CONNECTION_TTL_MS = 5 * 60 * 1000;

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

function isRunningInSpcs(): boolean {
  try {
    fs.accessSync("/snowflake/session/token");
    return true;
  } catch {
    return false;
  }
}

function getConnectionConfig(): ConnectionConfig {
  if (isRunningInSpcs() && process.env.SNOWFLAKE_PAT) {
    return {
      account: process.env.SNOWFLAKE_ACCOUNT || "SFSEAPAC-FSI_JAPAN",
      user: process.env.SNOWFLAKE_PAT_USER || "N8N_USER",
      host: process.env.SNOWFLAKE_HOST || "sfseapac-fsi-japan.snowflakecomputing.com",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "RYOSHIDA_WH",
      database: "HELPDESK_DB",
      schema: "APP",
      authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
      token: process.env.SNOWFLAKE_PAT,
    };
  }

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
    host: process.env.SNOWFLAKE_HOST,
  };
}

function isConnectionExpired(): boolean {
  if (!connectionCreatedAt) return true;
  return Date.now() - connectionCreatedAt > CONNECTION_TTL_MS;
}

function destroyCachedConnection() {
  if (cachedConnection) {
    try {
      cachedConnection.destroy(() => {});
    } catch {
      // ignore
    }
    cachedConnection = null;
    connectionPromise = null;
    connectionCreatedAt = 0;
  }
}

async function getConnection(): Promise<snowflake.Connection> {
  if (cachedConnection && cachedConnection.isUp() && !isConnectionExpired()) {
    return cachedConnection;
  }
  if (cachedConnection && isConnectionExpired()) {
    console.log("[similar] Connection TTL expired, reconnecting...");
    destroyCachedConnection();
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = new Promise((resolve, reject) => {
    const config = getConnectionConfig();
    console.log("[similar] Connecting with authenticator:", config.authenticator || "password");

    const connectionOptions: snowflake.ConnectionOptions = {
      account: config.account,
      username: config.user,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
      ...(config.host ? { host: config.host } : {}),
      ...(config.authenticator === "PROGRAMMATIC_ACCESS_TOKEN"
        ? { authenticator: "PROGRAMMATIC_ACCESS_TOKEN", token: config.token }
        : { password: config.password }),
    };
    const connection = snowflake.createConnection(connectionOptions);
    connection.connect((err) => {
      connectionPromise = null;
      if (err) {
        cachedConnection = null;
        connectionCreatedAt = 0;
        console.error("[similar] Snowflake connection error:", err.message);
        reject(err);
        return;
      }
      cachedConnection = connection;
      connectionCreatedAt = Date.now();
      console.log("[similar] Snowflake connection established");
      resolve(connection);
    });
  });
  return connectionPromise;
}

function getServiceConfig(category: string) {
  if (category === "finance") {
    return { serviceName: "FINANCE_SEARCH_SERVICE", columns: ["ID", "CATEGORY", "QUESTION", "ANSWER"] };
  } else if (category === "hr") {
    return { serviceName: "HR_SEARCH_SERVICE", columns: ["ID", "CATEGORY", "QUESTION", "ANSWER"] };
  } else {
    return { serviceName: "KNOWLEDGE_SEARCH_SERVICE", columns: ["KB_ID", "CATEGORY", "QUESTION", "ANSWER"] };
  }
}

async function searchViaSql(query: string, category: string, limit: number = 5) {
  const connection = await getConnection();
  const { serviceName, columns } = getServiceConfig(category);
  const fullServiceName = `HELPDESK_DB.APP.${serviceName}`;

  return new Promise((resolve, reject) => {
    const searchParams = JSON.stringify({ query, columns, limit }).replace(/'/g, "''");
    const sql = `SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${fullServiceName}', '${searchParams}') AS result`;
    connection.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("[similar] SQL execution error:", err.message);
          destroyCachedConnection();
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

async function searchSimilar(query: string, category: string, limit: number = 5) {
  try {
    return await searchViaSql(query, category, limit);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("390104") || errMsg.includes("395092") || errMsg.includes("login") || errMsg.includes("token") || errMsg.includes("auth")) {
      console.log("[similar] Auth error detected, retrying with fresh connection...");
      destroyCachedConnection();
      return await searchViaSql(query, category, limit);
    }
    throw error;
  }
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
    console.error("[similar] Error searching similar:", error);
    return NextResponse.json({ error: "Failed to search similar items" }, { status: 500 });
  }
}
