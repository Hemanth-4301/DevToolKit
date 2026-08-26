import { getSharesCollection } from "../_lib/mongodb.js";
import { validateCreatePayload } from "../_lib/validate.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`save:${clientKeyFor(req)}`)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const validated = validateCreatePayload(req.body);
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
    const result = await collection.findOneAndUpdate(
      { shareId: validated.slug },
      {
        $set: { code: validated.code, updatedAt: now },
        $setOnInsert: { shareId: validated.slug, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    return res.status(201).json({
      id: validated.slug,
      createdAt: result.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Failed to save share:", err);
    return res.status(500).json({ error: "Failed to save. Please try again." });
  }
}
