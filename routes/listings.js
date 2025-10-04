// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import requireAuth from "../middleware/authMiddleware.js";

const router = express.Router();

// ------------ Helpers ------------
const MAX_IMAGES = 15;

function normalizeImagesOrThrow(body) {
  const arr = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (body.imageUrl && arr.length === 0) arr.push(body.imageUrl);

  if (arr.length > MAX_IMAGES) {
    const err = new Error(`Maxim ${MAX_IMAGES} imagini permise`);
    err.statusCode = 400;
    throw err;
  }
  return arr.slice(0, MAX_IMAGES);
}

function mapSort(sort) {
  switch ((sort || "").toLowerCase()) {
    case "oldest":
      return { createdAt: 1 };
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "latest":
    default:
      return { createdAt: -1 };
  }
}

// ------------ GET /api/listings ------------
router.get("/", async (req, res) => {
  try {
    const { q, category, location, sort } = req.query;

    const filter = {};

    // text search (simplu, cu regex)
    if (q) {
      const rx = new RegExp(q.trim().replace(/\s+/g, ".*"), "i");
      filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
    }

    if (category) filter.category = category;
    if (location) filter.location = location;

    // tip tranzacție: ?type=vanzare | inchiriere (sau ?transactionType=...)
    const t = (req.query.transactionType || req.query.type || "").toLowerCase();
    if (t && ["vanzare", "inchiriere"].includes(t)) {
      filter.transactionType = t;
    }

    const items = await Listing.find(filter).sort(mapSort(sort));
    res.json(items);
  } catch (e) {
    console.error("Eroare GET /listings:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// ------------ GET /api/listings/me ------------
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const email = (req.user?.email || "").toLowerCase();

    const filter = {
      $or: [
        ...(userId ? [{ user: userId }] : []),
        ...(email ? [{ userEmail: email }] : []),
      ],
    };

    const items = await Listing.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    console.error("Eroare GET /listings/me:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor mele" });
  }
});

// ------------ GET /api/listings/:id ------------
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  // Acceptă și /anunt/<slug>-<id>
  const matchId = (id || "").match(/[0-9a-fA-F]{24}$/)?.[0] || id;

  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    return res.status(400).json({ error: "ID invalid" });
  }

  try {
    const item = await Listing.findById(matchId);
    if (!item) return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    res.json(item);
  } catch (e) {
    console.error("Eroare GET /listings/:id:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

// ------------ POST /api/listings ------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const images = normalizeImagesOrThrow(req.body);
    const payload = { ...req.body, images };

    // normalizare transactionType
    const t = (req.body.transactionType || "").toLowerCase();
    payload.transactionType = ["vanzare", "inchiriere"].includes(t) ? t : "vanzare";

    // atașează proprietarul, dacă vine din token
    if (req.user?.id) payload.user = req.user.id;
    if (req.user?.email) payload.userEmail = (req.user.email || "").toLowerCase();

    delete payload.imageUrl; // evităm dublarea

    const created = await Listing.create(payload);
    res.json(created);
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error("Eroare create listing:", e);
    res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
});

// ------------ PUT /api/listings/:id ------------
router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const matchId = (id || "").match(/[0-9a-fA-F]{24}$/)?.[0] || id;
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    return res.status(400).json({ error: "ID invalid" });
  }

  try {
    const images = normalizeImagesOrThrow(req.body);
    const payload = { ...req.body, images };

    const t = (req.body.transactionType || "").toLowerCase();
    payload.transactionType = ["vanzare", "inchiriere"].includes(t) ? t : "vanzare";

    delete payload.imageUrl;

    const updated = await Listing.findByIdAndUpdate(matchId, payload, { new: true });
    if (!updated) return res.status(404).json({ error: "Nu s-a găsit anunțul" });
    res.json(updated);
  } catch (e) {
    if (e.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error("Eroare update listing:", e);
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

// ------------ DELETE /api/listings/:id ------------
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const matchId = (id || "").match(/[0-9a-fA-F]{24}$/)?.[0] || id;
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    return res.status(400).json({ error: "ID invalid" });
  }

  try {
    const deleted = await Listing.findByIdAndDelete(matchId);
    if (!deleted) return res.status(404).json({ error: "Nu s-a găsit anunțul" });
    res.json({ ok: true });
  } catch (e) {
    console.error("Eroare delete listing:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
