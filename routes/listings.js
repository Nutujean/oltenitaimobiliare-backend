// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();
const { Types } = mongoose;

// GET /api/listings (cu filtre & sort)
router.get("/", async (req, res) => {
  try {
    const { q = "", category = "", location = "", sort = "latest" } = req.query;

    const filter = {};
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }
    if (category) filter.category = category;
    if (location) filter.location = location;

    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };
    const sortSpec = sortMap[sort] || sortMap.latest;

    const listings = await Listing.find(filter).sort(sortSpec).lean();
    res.json(listings);
  } catch (e) {
    console.error("Eroare GET /listings:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// GET /api/listings/me — doar ale utilizatorului curent (token)
router.get("/me", auth, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(listings);
  } catch (e) {
    console.error("Eroare GET /listings/me:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor mele" });
  }
});

// GET /api/listings/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });
    res.json(listing);
  } catch (e) {
    console.error("Eroare GET /listings/:id:", e);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

// POST /api/listings — creează (trebuie token)
router.post("/", auth, async (req, res) => {
  try {
    const payload = req.body || {};
    payload.user = req.userId;
    if (payload.images && !Array.isArray(payload.images)) {
      payload.images = [payload.images].filter(Boolean);
    }
    const created = await Listing.create(payload);
    res.status(201).json(created);
  } catch (e) {
    console.error("Eroare POST /listings:", e);
    res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
});

// PUT /api/listings/:id — update (doar proprietar)
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });
    if (String(listing.user) !== String(req.userId)) {
      return res.status(403).json({ error: "Nu ești proprietarul anunțului" });
    }
    const update = req.body || {};
    if (update.images && !Array.isArray(update.images)) {
      update.images = [update.images].filter(Boolean);
    }
    const updated = await Listing.findByIdAndUpdate(id, update, { new: true });
    res.json(updated);
  } catch (e) {
    console.error("Eroare PUT /listings/:id:", e);
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

// DELETE /api/listings/:id — șterge (doar proprietar)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });
    if (String(listing.user) !== String(req.userId)) {
      return res.status(403).json({ error: "Nu ești proprietarul anunțului" });
    }
    await Listing.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (e) {
    console.error("Eroare DELETE /listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
