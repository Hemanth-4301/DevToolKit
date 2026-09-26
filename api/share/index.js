import { getSharesCollection } from "../_lib/mongodb.js";
import { validateCreatePayload, validateChunkPayload } from "../_lib/validate.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export default async function handler(req, res) {
  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const hasId = typeof id === "string" && id.length > 0;

  // POST /api/share — create or update a share
  if (!hasId) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    if (isRateLimited(`save:${clientKeyFor(req)}`)) {
      return res.status(429).json({ error: "Too many requests — please slow down." });
    }

    const validated = req.body?.encoding === "gzip-base64"
      ? validateChunkPayload(req.body)
      : validateCreatePayload(req.body);
    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    try {
      const collection = await getSharesCollection();
      const now = new Date();

      const update = validated.encoding === "gzip-base64"
        ? {
            $set: {
              [`chunkData.${validated.chunkIndex}`]: validated.data,
              chunkCount: validated.totalChunks,
              encoding: validated.encoding,
              transferId: validated.transferId,
              ...(validated.originalSize != null ? { originalSize: validated.originalSize } : {}),
              updatedAt: now,
            },
            $setOnInsert: { shareId: validated.slug, createdAt: now },
          }
        : {
            $set: { code: validated.code, updatedAt: now },
            $unset: { chunkData: "", chunkCount: "", encoding: "", transferId: "", originalSize: "" },
            $setOnInsert: { shareId: validated.slug, createdAt: now },
          };
      const result = await collection.findOneAndUpdate(
        { shareId: validated.slug },
        update,
        { upsert: true, returnDocument: "after" },
      );

      return res.status(201).json({
        id: validated.slug,
        createdAt: result.createdAt.toISOString(),
        updatedAt: (result.updatedAt || result.createdAt).toISOString(),
      });
    } catch (err) {
      console.error("Failed to save share:", err);
      return res.status(500).json({ error: "Failed to save. Please try again." });
    }
  }

  // GET /api/share/:id or DELETE /api/share/:id
  if (!SHARE_ID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  const readLimited = isRateLimited(`read:${clientKeyFor(req)}`, 120);
  const writeLimited = req.method === "DELETE" && isRateLimited(`delete:${clientKeyFor(req)}`, 20);
  if (readLimited || writeLimited) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  try {
    const collection = await getSharesCollection();

    if (req.method === "GET") {
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
        const buffer = Buffer.from(chunks.join(""), "base64");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("X-Share-Encoding", "gzip");
        res.setHeader("X-Share-Id", doc.shareId);
        res.setHeader("X-Share-Created-At", doc.createdAt.toISOString());
        res.setHeader("X-Share-Updated-At", (doc.updatedAt || doc.createdAt).toISOString());
        return res.status(200).send(buffer);
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
