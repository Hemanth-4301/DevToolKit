import { getSharesCollection } from "../../_lib/mongodb.js";
import { requireAdmin } from "../../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../../_lib/rateLimit.js";

const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const DAYS_BACK = 30;
const SIZE_BUCKETS = [0, 1_000, 10_000, 100_000, 1_000_000, Infinity];
const SIZE_BUCKET_LABELS = ["<1KB", "1-10KB", "10-100KB", "100KB-1MB", ">1MB"];

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function zeroFilledDays() {
  const days = [];
  const now = new Date();
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

export default async function handler(req, res) {
  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const hasId = typeof id === "string" && id.length > 0;

  // GET /api/admin/shares — list all shares with stats
  if (!hasId) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }

    if (isRateLimited(`admin-shares:${clientKeyFor(req)}`, 60)) {
      return res.status(429).json({ error: "Too many requests — please slow down." });
    }

    const session = requireAdmin(req, res);
    if (!session) return;

    try {
      const collection = await getSharesCollection();
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - DAYS_BACK);

      const [rows, totals, byDay, bySize] = await Promise.all([
        collection
          .aggregate([
            {
              $project: {
                _id: 0,
                id: "$shareId",
                createdAt: 1,
                updatedAt: 1,
                size: {
                  $cond: [
                    { $ne: ["$originalSize", null] },
                    "$originalSize",
                    { $strLenCP: { $ifNull: ["$code", ""] } },
                  ],
                },
                preview: {
                  $cond: [
                    { $ne: ["$originalSize", null] },
                    "[large share — compressed, preview unavailable]",
                    { $substrCP: [{ $ifNull: ["$code", ""] }, 0, 200] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
          ])
          .toArray(),
        collection
          .aggregate([
            {
              $project: {
                size: {
                  $cond: [
                    { $ne: ["$originalSize", null] },
                    "$originalSize",
                    { $strLenCP: { $ifNull: ["$code", ""] } },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalLinks: { $sum: 1 },
                avgSize: { $avg: "$size" },
                maxSize: { $max: "$size" },
              },
            },
          ])
          .toArray(),
        collection
          .aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        collection
          .aggregate([
            {
              $project: {
                size: {
                  $cond: [
                    { $ne: ["$originalSize", null] },
                    "$originalSize",
                    { $strLenCP: { $ifNull: ["$code", ""] } },
                  ],
                },
              },
            },
            {
              $bucket: {
                groupBy: "$size",
                boundaries: SIZE_BUCKETS.slice(0, -1),
                default: SIZE_BUCKETS[SIZE_BUCKETS.length - 2],
                output: { count: { $sum: 1 } },
              },
            },
          ])
          .toArray(),
      ]);

      const byDayMap = new Map(byDay.map((d) => [d._id, d.count]));
      const linksPerDay = zeroFilledDays().map((date) => ({ date, count: byDayMap.get(date) || 0 }));

      const bucketMap = new Map(bySize.map((b) => [b._id, b.count]));
      const sizeDistribution = SIZE_BUCKETS.slice(0, -1).map((boundary, i) => ({
        bucket: SIZE_BUCKET_LABELS[i],
        count: bucketMap.get(boundary) || 0,
      }));

      const totalsDoc = totals[0] || { totalLinks: 0, avgSize: 0, maxSize: 0 };

      return res.status(200).json({
        shares: rows,
        stats: {
          totalLinks: totalsDoc.totalLinks,
          avgSize: Math.round(totalsDoc.avgSize || 0),
          maxSize: totalsDoc.maxSize || 0,
          linksPerDay,
          sizeDistribution,
        },
      });
    } catch (err) {
      console.error("Failed to load admin share stats:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }

  // DELETE /api/admin/shares/:id
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-shares-delete:${clientKeyFor(req)}`, 30)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  if (!SHARE_ID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  try {
    const collection = await getSharesCollection();
    const result = await collection.deleteOne({ shareId: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "This snippet was not found." });
    }
    return res.status(204).end();
  } catch (err) {
    console.error("Admin delete share failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
