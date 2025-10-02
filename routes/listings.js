// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

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

/* ---------------- CREATE (POST) ---------------- */
/**
 * POST /api/listings  (alias: /api/listings/create)
 * Body:
 *  { title, description, price, category, location, images: string[], imageUrl, status, phone? }
 * Necesită auth (Bearer). Setează automat user și userEmail (dacă există).
 */
async function handleCreate(req, res) {
  try {
    const {
      title = "",
      description = "",
      price,
      category = "",
      location = "",
      images = [],
      imageUrl = "",
      status = "disponibil",
      phone, // opțional – dacă vrei să salvezi numărul direct pe anunț
    } = req.body;

    // log minimal pt. diagnoză
    console.log("→ POST /listings body:", {
      title: String(title).slice(0, 60),
      price,
      category,
      location,
      imagesCount: Array.isArray(images) ? images.length : 0,
      hasImageUrl: Boolean(imageUrl),
    });

    // validări de bază
    if (!String(title).trim()) return res.status(400).json({ error: "Titlul este obligatoriu" });
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Preț invalid" });
    }

    // pregătește imaginile
    let imgs = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imgs.length === 0 && imageUrl) imgs = [imageUrl];

    // normalizează userId din middleware (acceptă diverse variante)
    const userId = req.userId || req.user?.id || req.user?._id || null;

    const listingData = {
      title: String(title).trim(),
      description: String(description || ""),
      price: numericPrice,
      category: String(category || ""),
      location: String(location || ""),
      images: imgs,
      imageUrl: imgs.length > 0 ? imgs[0] : String(imageUrl || ""),
      status,
      rezervat: false,
    };

    // setează user dacă îl avem (nu forțăm required aici; lăsăm schema să decidă)
    if (userId) {
      listingData.user = new mongoose.Types.ObjectId(userId);
    }

    // setează userEmail dacă putem
    try {
      if (userId) {
        const u = await User.findById(userId).select("email").lean();
        if (u?.email) listingData.userEmail = u.email;
      }
    } catch (_) {
      // nu blocăm create dacă nu găsim user
    }

    if (phone) listingData.phone = String(phone);

    const created = await Listing.create(listingData);
    return res.status(201).json(created);
  } catch (err) {
    // diferențiază erorile de validare pentru răspuns 400 clar
    if (err?.name === "ValidationError") {
      const details = Object.fromEntries(
        Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
      );
      console.error("❌ ValidationError POST /listings:", details);
      return res.status(400).json({ error: "Validare eșuată", details });
    }
    console.error("❌ Eroare POST /listings:", err);
    return res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
}

router.post("/", auth, handleCreate);
router.post("/create", auth, handleCreate);

/* ---------------- LIST + READ ---------------- */

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
