import { Pool, QueryResult, QueryResultRow } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://seamless_user:seamless_pass123@localhost:5432/seamless_design_studio",
});

// If a connection fails, log and try again
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/** Helper: return first row or null */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/** Helper: transaction runner */
export async function transaction<T>(
  fn: (query: typeof query) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wrappedQuery = async <U extends QueryResultRow = any>(
      text: string,
      params?: any[]
    ) => client.query<U>(text, params);
    const result = await fn(wrappedQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
