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

/** Lookup by email (listings.userEmail → users.email) ca să obținem telefonul din profil */
function buildPipeline(match, sortObj) {
  return [
    { $match: match },
    { $sort: sortObj },
    {
      $lookup: {
        from: "users",            // colecția de utilizatori
        localField: "userEmail",  // câmp în listings
        foreignField: "email",    // câmp în users
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

/** DEBUG: /api/listings/__debug — înainte de /:id, dar oricum nu mai contează cu regex */
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

/** (opțional) /api/listings/__ids — ca să poți copia rapid un _id valid */
router.get("/__ids", async (_req, res) => {
  try {
    const ids = await Listing.find({}, { _id: 1 }).sort({ createdAt: -1 }).limit(10).lean();
    res.json(ids.map((d) => d._id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/listings/:id — acceptează DOAR ObjectId valid (24 hex) */
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
