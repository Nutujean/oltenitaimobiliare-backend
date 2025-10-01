// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * Build query din ?category, ?q, ?location, ?price
 */
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

/**
 * Build sort din ?sort
 */
function buildSort(sort) {
  let sortObj = { createdAt: -1 };
  if (sort === "oldest") sortObj = { createdAt: 1 };
  if (sort === "price_asc") sortObj = { price: 1, createdAt: -1 };
  if (sort === "price_desc") sortObj = { price: -1, createdAt: -1 };
  return sortObj;
}

/**
 * Pipeline comun: JOIN după userEmail -> users.email pentru a obține telefonul
 * Notă: colecția de utilizatori în Mongo e "users" (plural, lowercase).
 */
function buildPipeline(match, sortObj) {
  return [
    { $match: match },
    { $sort: sortObj },
    {
      $lookup: {
        from: "users",
        localField: "userEmail",
        foreignField: "email",
        as: "ownerUser",
      },
    },
    {
      $addFields: {
        // dacă ai un camp phone pe listing, el are prioritate; altfel ia din profil
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

/**
 * GET /api/listings — listă cu filtre + contactPhone din profil (by email)
 */
router.get("/", async (req, res) => {
  try {
    const match = buildMatchQuery(req.query);
    const sortObj = buildSort(req.query.sort);
    const pipeline = buildPipeline(match, sortObj);

    const docs = await Listing.aggregate(pipeline);
    return res.json(docs);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    return res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/**
 * GET /api/listings/__debug — rapid check colecție
 * (ține ruta asta ÎNAINTE de /:id)
 */
router.get("/__debug", async (req, res) => {
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

/**
 * GET /api/listings/:id — un anunț + contactPhone din profil (by email)
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const match = { _id: new mongoose.Types.ObjectId(id) };
    const pipeline = buildPipeline(match, { createdAt: -1 });

    const out = await Listing.aggregate(pipeline).limit(1);
    if (!out || out.length === 0) {
      return res.status(404).json({ error: "Anunțul nu există" });
    }

    return res.json(out[0]);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    return res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

export default router;
