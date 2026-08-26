import { getSharesCollection } from "../_lib/mongodb.js";
import { validateCreatePayload } from "../_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const validated = validateCreatePayload(req.body);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  try {
    const collection = await getSharesCollection();
    const now = new Date();

    await collection.insertOne({
      shareId: validated.slug,
      code: validated.code,
      createdAt: now,
    });

    return res.status(201).json({
      id: validated.slug,
      createdAt: now.toISOString(),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: `"${validated.slug}" is already taken. Try a different link.`,
      });
    }
    console.error("Failed to create share:", err);
    return res.status(500).json({ error: "Failed to create share. Please try again." });
  }
}
