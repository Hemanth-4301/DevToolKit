import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";
import { requireAdminOrFlag } from "../_lib/featureFlags.js";
import { withConnection, friendlyConnectionError } from "../_lib/migration/mssqlClient.js";

function validateCreds(body) {
  const { server, database, username, password, port } = body || {};
  if (
    typeof server !== "string" || !server.trim() ||
    typeof database !== "string" || !database.trim() ||
    typeof username !== "string" || !username.trim() ||
    typeof password !== "string" || !password
  ) {
    return { error: "Server, database, username, and password are all required." };
  }
  if (port !== undefined && port !== "" && Number.isNaN(Number(port))) {
    return { error: "Port must be a number." };
  }
  return { server: server.trim(), database: database.trim(), username: username.trim(), password, port };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`migration-test-connection:${clientKeyFor(req)}`, 15)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = await requireAdminOrFlag(req, res, "migrationGenerator");
  if (!session) return;

  const validated = validateCreds(req.body);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  try {
    await withConnection(validated, async (pool) => {
      await pool.request().query("SELECT 1");
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Migration test-connection failed:", err.message);
    return res.status(400).json({ error: friendlyConnectionError(err) });
  }
}
