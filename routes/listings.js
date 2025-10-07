// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

/* Utils */
function parseObjectIdFromSlug(slugOrId = "") {
  const maybeId = String(slugOrId).includes("-")
    ? String(slugOrId).split("-").pop()
    : String(slugOrId);
  return maybeId;
}

function buildFilters({ q, category, location, userId }) {
  const filter = {};
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { description: rx }, { location: rx }, { category: rx }];
  }
  if (category && category.trim()) filter.category = category.trim();
  if (location && location.trim()) filter.location = location.trim();
  if (userId) filter.user = userId;
  return filter;
}

function buildSort(sort = "latest") {
  switch (sort) {
    case "oldest":
      return { createdAt: 1 };
    case "price_asc":
      return { price: 1, createdAt: -1 };
    case "price_desc":
      return { price: -1, createdAt: -1 };
    // implicit: cele mai noi primele
    default:
      return { createdAt: -1 };
  }
}

/* ----------------------------------------------------------------------------
 * GET /api/listings
 *  - filtre: ?q=...&category=...&location=...&sort=latest|oldest|price_asc|price_desc
 * ---------------------------------------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const { q = "", category = "", location = "", sort = "latest", limit = 60 } = req.query;
    const filter = buildFilters({ q, category, location });
    const sortBy = buildSort(sort);

    const items = await Listing.find(filter)
      .sort(sortBy)
      .limit(Math.min(Number(limit) || 60, 200))
      .select("-__v")
      .lean();

    res.json(items);
  } catch (e) {
    console.error("Eroare GET /listings:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/* ----------------------------------------------------------------------------
 * GET /api/listings/me  (necesită login) – anunțurile utilizatorului curent
 * ---------------------------------------------------------------------------*/
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Neautorizat" });

    const items = await Listing.find({ user: userId })
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    res.json(items);
  } catch (e) {
    console.error("Eroare GET /listings/me:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor mele" });
  }
});

/* ----------------------------------------------------------------------------
 * GET /api/listings/:id (acceptă și slug-uri de forma titlu-...-<id>)
 *  - populate user (_id, name, email, phone)
 * ---------------------------------------------------------------------------*/
router.get("/:id", async (req, res) => {
  try {
    const raw = parseObjectIdFromSlug(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const doc = await Listing.findById(raw)
      .populate("user", "_id name email phone")
      .select("-__v")
      .lean();

    if (!doc) return res.status(404).json({ error: "Anunț inexistent" });
    res.json(doc);
  } catch (e) {
    console.error("Eroare GET /listings/:id:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/* ----------------------------------------------------------------------------
 * POST /api/listings  (create) – necesită login
 * Body câmpuri acceptate:
 *  title, description, price, category, location, images (array), imageUrl (string),
 *  phone, status ("vanzare"|"inchiriere"), floor (etaj), surface (mp), rooms (camere),
 *  rezervat (bool)
 *  – max 15 imagini
 * ---------------------------------------------------------------------------*/
router.post("/", auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Neautorizat" });

    const {
      title = "",
      description = "",
      price,
      category = "",
      location = "",
      images = [],
      imageUrl = "",
      phone = "",
      status = "vanzare", // "vanzare" | "inchiriere"
      floor, // etaj
      surface, // suprafata
      rooms, // camere
      rezervat = false,
    } = req.body || {};

    if (!title.trim() || !description.trim() || !category.trim() || !location.trim()) {
      return res.status(400).json({ error: "Titlu, descriere, categorie și locație sunt obligatorii" });
    }

    let priceNum = Number.parseFloat(price);
    if (Number.isNaN(priceNum)) {
      return res.status(400).json({ error: "Preț invalid" });
    }

    // normalizează imagini – max 15
    let imgs = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imageUrl && !imgs.includes(imageUrl)) imgs.unshift(imageUrl);
    imgs = imgs.slice(0, 15);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      category: category.trim(),
      location: location.trim(),
      images: imgs,
      imageUrl: imgs[0] || "",
      phone: phone.trim(),
      status: ["vanzare", "inchiriere"].includes(String(status).toLowerCase())
        ? String(status).toLowerCase()
        : "vanzare",
      floor: floor ?? null,
      surface: surface ?? null,
      rooms: rooms ?? null,
      rezervat: Boolean(rezervat),
      user: userId,
    };

    const created = await Listing.create(payload);
    res.status(201).json(created);
  } catch (e) {
    console.error("Eroare POST /listings:", e);
    res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
});

/* ----------------------------------------------------------------------------
 * PUT /api/listings/:id  (update) – necesită login + proprietar
 *  – aplică aceleași validări ca la POST; max 15 imagini
 * ---------------------------------------------------------------------------*/
router.put("/:id", auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const raw = parseObjectIdFromSlug(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const existing = await Listing.findById(raw);
    if (!existing) return res.status(404).json({ error: "Anunț inexistent" });
    if (String(existing.user) !== String(userId)) {
      return res.status(403).json({ error: "Nu ai dreptul să modifici acest anunț" });
    }

    const allow = [
      "title",
      "description",
      "price",
      "category",
      "location",
      "images",
      "imageUrl",
      "phone",
      "status",
      "floor",
      "surface",
      "rooms",
      "rezervat",
      "featuredUntil",
    ];

    const patch = {};
    for (const k of allow) {
      if (req.body.hasOwnProperty(k)) patch[k] = req.body[k];
    }

    if (patch.price !== undefined) {
      const p = Number.parseFloat(patch.price);
      if (Number.isNaN(p)) return res.status(400).json({ error: "Preț invalid" });
      patch.price = p;
    }

    if (patch.images) {
      let imgs = Array.isArray(patch.images) ? patch.images.filter(Boolean) : [];
      if (patch.imageUrl && !imgs.includes(patch.imageUrl)) imgs.unshift(patch.imageUrl);
      patch.images = imgs.slice(0, 15);
      patch.imageUrl = patch.images[0] || existing.imageUrl || "";
    }

    if (patch.title) patch.title = String(patch.title).trim();
    if (patch.description) patch.description = String(patch.description).trim();
    if (patch.category) patch.category = String(patch.category).trim();
    if (patch.location) patch.location = String(patch.location).trim();
    if (patch.phone) patch.phone = String(patch.phone).trim();
    if (patch.status) {
      const st = String(patch.status).toLowerCase();
      patch.status = ["vanzare", "inchiriere"].includes(st) ? st : existing.status;
    }

    const updated = await Listing.findByIdAndUpdate(existing._id, patch, { new: true }).lean();
    res.json(updated);
  } catch (e) {
    console.error("Eroare PUT /listings/:id:", e);
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

/* ----------------------------------------------------------------------------
 * DELETE /api/listings/:id – necesită login + proprietar
 * ---------------------------------------------------------------------------*/
router.delete("/:id", auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const raw = parseObjectIdFromSlug(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const existing = await Listing.findById(raw);
    if (!existing) return res.status(404).json({ error: "Anunț inexistent" });
    if (String(existing.user) !== String(userId)) {
      return res.status(403).json({ error: "Nu ai dreptul să ștergi acest anunț" });
    }

    await Listing.findByIdAndDelete(raw);
    res.json({ ok: true });
  } catch (e) {
    console.error("Eroare DELETE /listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
