// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

/* ---------------- helpers ---------------- */
function buildMatchQuery(qs) {
  const { category, q, location, price } = qs;
  const query = {};
  if (category) query.category = { $regex: new RegExp("^" + category + "$", "i") };
  if (q) {
    const rx = new RegExp(q, "i");
    query.$or = [{ title: rx }, { description: rx }];
  }
  if (location) query.location = { $regex: new RegExp("^" + location + "$", "i") };
  if (price) {
    const max = Number(price);
    if (!Number.isNaN(max)) query.price = { ...(query.price || {}), $lte: max };
  }
  return query;
}

function buildSort(sort) {
  let sortObj = { createdAt: -1 };
  if (sort === "oldest") sortObj = { createdAt: 1 };
  if (sort === "price_asc") sortObj = { price: 1, createdAt: -1 };
  if (sort === "price_desc") sortObj = { price: -1, createdAt: -1 };
  return sortObj;
}

/** Lookup users fie după email (listings.userEmail), fie după _id (listings.user) */
function buildPipeline(match, sortObj) {
  return [
    { $match: match },
    { $sort: sortObj },
    {
      $lookup: {
        from: "users",
        let: { ue: "$userEmail", uid: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $and: [
                      { $ne: ["$$ue", null] },
                      { $ne: ["$$ue", ""] },
                      { $eq: ["$email", "$$ue"] },
                    ],
                  },
                  {
                    $and: [
                      { $ne: ["$$uid", null] },
                      { $eq: ["$_id", "$$uid"] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { phone: 1, email: 1, name: 1 } },
        ],
        as: "ownerUser",
      },
    },
    {
      $addFields: {
        contactPhone: {
          $let: {
            vars: { owner: { $arrayElemAt: ["$ownerUser", 0] } },
            in: { $ifNull: ["$phone", "$$owner.phone"] },
          },
        },
      },
    },
    { $project: { ownerUser: 0 } },
  ];
}

/* ---------------- routes ---------------- */

/** GET /api/listings — listă cu filtre + contactPhone */
router.get("/", async (req, res) => {
  try {
    const match = buildMatchQuery(req.query);
    const sortObj = buildSort(req.query.sort);
    const pipeline = buildPipeline(match, sortObj);
    const docs = await Listing.aggregate(pipeline);
    res.json(docs);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/** DEBUG: /api/listings/__debug */
router.get("/__debug", async (_req, res) => {
  try {
    const count = await Listing.countDocuments();
    const sample = await Listing.findOne().lean();
    res.json({
      count,
      hasSample: !!sample,
      sampleKeys: sample ? Object.keys(sample) : [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DEBUG: /api/listings/__ids — câteva _id-uri recente */
router.get("/__ids", async (_req, res) => {
  try {
    const ids = await Listing.find({}, { _id: 1 }).sort({ createdAt: -1 }).limit(10).lean();
    res.json(ids.map((d) => d._id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** AUX: /api/listings/by-id/:id — test fără ambiguitate de path */
router.get("/by-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "ID invalid" });
    const match = { _id: new mongoose.Types.ObjectId(id) };
    const pipeline = buildPipeline(match, { createdAt: -1 });
    const out = await Listing.aggregate(pipeline).limit(1);
    if (!out || out.length === 0) return res.status(404).json({ error: "Anunțul nu există" });
    res.json(out[0]);
  } catch (err) {
    console.error("❌ Eroare GET /listings/by-id/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/** PROD: /api/listings/:id — acceptează DOAR 24 hex (pt. frontend) */
router.get("/:id([0-9a-fA-F]{24})", async (req, res) => {
  try {
    const { id } = req.params;
    const match = { _id: new mongoose.Types.ObjectId(id) };
    const pipeline = buildPipeline(match, { createdAt: -1 });
    const out = await Listing.aggregate(pipeline).limit(1);
    if (!out || out.length === 0) return res.status(404).json({ error: "Anunțul nu există" });
    res.json(out[0]);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

export default router;
