import { getSharesCollection } from "../_lib/mongodb.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

// Matches custom slugs — lowercase letters, numbers, and hyphens (see
// api/_lib/validate.js's SLUG_RE, the source of truth for the format).
const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export default async function handler(req, res) {
  const { id } = req.query;

  if (typeof id !== "string" || !SHARE_ID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  // Reads happen often by design (client-side polling for live sync), so
  // they get a much higher ceiling than writes — this only catches a
  // genuinely runaway client, not normal usage even across many tabs.
  const readLimited = isRateLimited(`read:${clientKeyFor(req)}`, 120);
  const writeLimited = req.method === "DELETE" && isRateLimited(`delete:${clientKeyFor(req)}`, 20);
  if (readLimited || writeLimited) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  try {
    const collection = await getSharesCollection();

    if (req.method === "GET") {
      // Lightweight polling mode — projects only the timestamp fields so a
      // client checking "did this change?" doesn't pull the full (possibly
      // multi-MB, chunked) document over the wire on every poll tick.
      if (req.query.meta === "1") {
        const meta = await collection.findOne(
          { shareId: id },
          { projection: { _id: 0, updatedAt: 1, createdAt: 1 } },
        );
        if (!meta) {
          return res.status(404).json({ error: "Nothing has been shared at this link yet." });
        }
        return res.status(200).json({
          updatedAt: meta.updatedAt || meta.createdAt,
          createdAt: meta.createdAt,
        });
      }

      const doc = await collection.findOne({ shareId: id });
      if (!doc) {
        return res.status(404).json({ error: "Nothing has been shared at this link yet." });
      }
      if (doc.encoding === "gzip-base64" && doc.chunkCount) {
        const chunks = Array.from({ length: doc.chunkCount }, (_, index) => doc.chunkData?.[index]);
        if (chunks.some((chunk) => typeof chunk !== "string")) {
          return res.status(409).json({ error: "Share is still being saved. Please retry." });
        }
        return res.status(200).json({
          id: doc.shareId,
          encoding: doc.encoding,
          data: chunks.join(""),
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt || doc.createdAt,
        });
      }
      return res.status(200).json({
        id: doc.shareId,
        code: doc.code,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt || doc.createdAt,
      });
    }

    if (req.method === "DELETE") {
      const result = await collection.deleteOne({ shareId: id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "This snippet was not found." });
      }
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("Failed to fetch/delete share:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
