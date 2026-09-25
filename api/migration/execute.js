import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";
import { requireAdminOrFlag } from "../_lib/featureFlags.js";
import { withConnection, friendlyConnectionError } from "../_lib/migration/mssqlClient.js";
import { splitQueries, parseQuery } from "../_lib/migration/parseQuery.js";
import { resolveTables } from "../_lib/migration/resolveTables.js";
import { executeTableStatements } from "../_lib/migration/executeTable.js";

const MAX_QUERIES = 50;
const MAX_TOTAL_QUERY_LENGTH = 200_000;

function validateCreds(creds, label) {
  const { server, database, username, password, port } = creds || {};
  if (
    typeof server !== "string" || !server.trim() ||
    typeof database !== "string" || !database.trim() ||
    typeof username !== "string" || !username.trim() ||
    typeof password !== "string" || !password
  ) {
    return { error: `${label}: server, database, username, and password are all required.` };
  }
  if (port !== undefined && port !== "" && Number.isNaN(Number(port))) {
    return { error: `${label}: port must be a number.` };
  }
  return { creds: { server: server.trim(), database: database.trim(), username: username.trim(), password, port } };
}

function validateBody(body) {
  const { source, target, queries, includeDelete, includeIdentityInsert, confirm } = body || {};

  const sourceValidated = validateCreds(source, "Source database");
  if (sourceValidated.error) return { error: sourceValidated.error };

  // Executing requires an explicit target — running "into itself" isn't
  // a real migration and DELETE+INSERT-ing the source from the source's
  // own just-read rows is a foot-gun this endpoint shouldn't allow.
  const targetValidated = validateCreds(target, "Target database");
  if (targetValidated.error) return { error: targetValidated.error };

  // A second, explicit confirmation flag required in the body (on top of
  // whatever the UI's own confirm dialog does) — belt-and-suspenders
  // against this endpoint ever being called by accident or by a stray
  // retry that doesn't carry real user intent.
  if (confirm !== true) {
    return { error: "Execution must be explicitly confirmed." };
  }

  if (!Array.isArray(queries) || queries.length === 0) {
    return { error: "At least one query is required." };
  }
  if (queries.length > MAX_QUERIES) {
    return { error: `Too many queries — max ${MAX_QUERIES} per run.` };
  }
  const totalLength = queries.reduce((sum, q) => sum + (typeof q === "string" ? q.length : 0), 0);
  if (totalLength > MAX_TOTAL_QUERY_LENGTH) {
    return { error: "Combined query text is too large." };
  }
  if (queries.some((q) => typeof q !== "string" || !q.trim())) {
    return { error: "Invalid query in list." };
  }

  return {
    source: sourceValidated.creds,
    target: targetValidated.creds,
    queries,
    includeDelete: includeDelete !== false,
    includeIdentityInsert: includeIdentityInsert !== false,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Tighter than generate/test-connection — this endpoint writes to a
  // real database, so it gets the same ceiling as Code Share's save
  // route rather than a read-like allowance.
  if (isRateLimited(`migration-execute:${clientKeyFor(req)}`, 10)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = await requireAdminOrFlag(req, res, "migrationGenerator");
  if (!session) return;

  const validated = validateBody(req.body);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  const parsedQueries = [];
  for (const queryText of validated.queries) {
    const parsed = parseQuery(queryText);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    parsedQueries.push(parsed);
  }

  try {
    const results = await withConnection(validated.source, (sourcePool) =>
      withConnection(validated.target, async (targetPool) => {
        const tables = await resolveTables(sourcePool, targetPool, parsedQueries);

        // Tables run sequentially, each in its own transaction (see
        // executeTableStatements) — a failure on one table stops the
        // run and leaves later tables untouched, while every table that
        // already committed stays committed. The response reports
        // exactly how far it got so the admin knows what to re-run.
        const outcomes = [];
        for (const t of tables) {
          try {
            const outcome = await executeTableStatements(targetPool, {
              ...t,
              includeDelete: validated.includeDelete,
              includeIdentityInsert: validated.includeIdentityInsert,
            });
            outcomes.push(outcome);
          } catch (err) {
            outcomes.push({
              schema: t.schema,
              table: t.table,
              ok: false,
              error: err.tableError?.message || err.message,
            });
            // Stop at the first failure — later tables in the list are
            // simply never attempted, not run-and-ignored.
            return outcomes;
          }
        }
        return outcomes;
      }),
    );

    const allOk = results.every((r) => r.ok);
    return res.status(allOk ? 200 : 207).json({ results });
  } catch (err) {
    if (err.userFacing) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Migration execute failed:", err.message);
    return res.status(400).json({ error: friendlyConnectionError(err) });
  }
}
