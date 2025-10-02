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

async function getAuthIdentity(req) {
  const userId = req.userId || req.user?.id || req.user?._id || null;
  let email = null;
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    const u = await User.findById(userId).select("email").lean();
    email = u?.email || null;
  }
  return { userId: userId ? new mongoose.Types.ObjectId(userId) : null, email };
}

function userOwnsListing(listing, userId, email) {
  const ownsById = listing.user && userId && String(listing.user) === String(userId);
  const ownsByEmail = listing.userEmail && email && listing.userEmail === email;
  return Boolean(ownsById || ownsByEmail);
}

/* ---------------- CREATE (POST) ---------------- */
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
      phone,
    } = req.body;

    if (!String(title).trim()) return res.status(400).json({ error: "Titlul este obligatoriu" });
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Preț invalid" });
    }

    let imgs = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imgs.length === 0 && imageUrl) imgs = [imageUrl];

    const { userId, email } = await getAuthIdentity(req);

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

    if (userId) listingData.user = userId;
    if (email) listingData.userEmail = email;
    if (phone) listingData.phone = String(phone);

    const created = await Listing.create(listingData);
    return res.status(201).json(created);
  } catch (err) {
    if (err?.name === "ValidationError") {
      const details = Object.fromEntries(
        Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
      );
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

/** GET /api/listings/me — anunțurile utilizatorului curent */
router.get("/me", auth, async (req, res) => {
  try {
    const { userId, email } = await getAuthIdentity(req);
    if (!userId && !email) {
      return res.status(401).json({ error: "Nu ești autentificat" });
    }
    const or = [];
    if (userId) or.push({ user: userId });
    if (email) or.push({ userEmail: email });
    const match = { $or: or };
    const pipeline = buildPipeline(match, { createdAt: -1 });
    const docs = await Listing.aggregate(pipeline);
    res.json(docs);
  } catch (err) {
    console.error("❌ Eroare GET /listings/me:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor mele" });
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

/* ---------------- UPDATE + DELETE ---------------- */

/** PUT /api/listings/:id — update (doar de către proprietar) */
router.put("/:id([0-9a-fA-F]{24})", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    const { userId, email } = await getAuthIdentity(req);
    if (!userOwnsListing(listing, userId, email)) {
      return res.status(403).json({ error: "Nu ai dreptul să modifici acest anunț" });
    }

    const {
      title, description, price, category, location,
      images = [], imageUrl = "", status, rezervat, phone
    } = req.body;

    const update = {};
    if (title !== undefined) update.title = String(title);
    if (description !== undefined) update.description = String(description);
    if (price !== undefined) update.price = Number(price);
    if (category !== undefined) update.category = String(category);
    if (location !== undefined) update.location = String(location);
    if (Array.isArray(images)) update.images = images.filter(Boolean);
    if (imageUrl !== undefined) update.imageUrl = String(imageUrl);
    if (status !== undefined) update.status = String(status);
    if (rezervat !== undefined) update.rezervat = Boolean(rezervat);
    if (phone !== undefined) update.phone = String(phone);

    if (update.images && update.images.length > 0 && !update.imageUrl) {
      update.imageUrl = update.images[0];
    }

    const updated = await Listing.findByIdAndUpdate(id, update, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("❌ Eroare PUT /listings/:id:", err);
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

/** DELETE /api/listings/:id — ștergere (doar de către proprietar) */
router.delete("/:id([0-9a-fA-F]{24})", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    const { userId, email } = await getAuthIdentity(req);
    if (!userOwnsListing(listing, userId, email)) {
      return res.status(403).json({ error: "Nu ai dreptul să ștergi acest anunț" });
    }

    await Listing.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Eroare DELETE /listings/:id:", err);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
