import { getSharesCollection } from "../_lib/mongodb.js";
import { validateCreatePayload, validateChunkPayload } from "../_lib/validate.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
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

    // Upsert — a slug's page is always editable, so saving again just
    // updates the existing document instead of failing as a duplicate.
    // `createdAt` is only set on first insert ($setOnInsert), preserved on
    // every subsequent edit.
    const update = validated.encoding === "gzip-base64"
      ? {
          $set: {
            [`chunkData.${validated.chunkIndex}`]: validated.data,
            chunkCount: validated.totalChunks,
            encoding: validated.encoding,
            transferId: validated.transferId,
            updatedAt: now,
          },
          $setOnInsert: { shareId: validated.slug, createdAt: now },
        }
      : {
          $set: { code: validated.code, updatedAt: now },
          $unset: { chunkData: "", chunkCount: "", encoding: "", transferId: "" },
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
