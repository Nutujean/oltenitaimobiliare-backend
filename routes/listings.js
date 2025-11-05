// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js"; // 🟢 Multer + Cloudinary

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const sortParam = req.query.sort || "newest";

    let sortQuery = { createdAt: -1 };
    if (sortParam === "cheapest") sortQuery = { price: 1 };
    if (sortParam === "expensive") sortQuery = { price: -1 };

    const listings = await Listing.find({
      $or: [
        { featuredUntil: { $gte: now } },
        { expiresAt: { $gte: now } },
        { featuredUntil: null, expiresAt: null },
        { isFree: { $exists: false } },
      ],
    })
      .sort(sortQuery)
      .lean();

    res.json(listings);
  } catch (e) {
    console.error("Eroare la GET /api/listings:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor" });
  }
});

/* =======================================================
   🟩 GET anunțurile utilizatorului logat
======================================================= */
router.get("/my", protect, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id || req.user.id);
    const myListings = await Listing.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (cu imagini)
======================================================= */
router.post("/", protect, upload.array("images", 10), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // Limitează un singur anunț gratuit activ
    const existingFree = await Listing.findOne({
      user: userId,
      isFree: true,
      expiresAt: { $gt: new Date() },
    });

    if (existingFree) {
      return res.status(403).json({
        error:
          "Ai deja un anunț gratuit activ. Poți promova sau aștepta expirarea (10 zile).",
      });
    }

    // 🔹 Preia imaginile urcate pe Cloudinary
    const imageUrls = req.files ? req.files.map((f) => f.path) : [];

    const newListing = new Listing({
      ...req.body,
      images: imageUrls,
      user: userId,
      isFree: true,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (e) {
    console.error("Eroare la POST /api/listings:", e);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/* =======================================================
   🟩 PUT - Editează un anunț (cu update imagini)
======================================================= */
router.put("/:id", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      return res
        .status(403)
        .json({ error: "Nu ai permisiunea să editezi acest anunț." });
    }

    const updatedData = { ...req.body };

    if (req.files && req.files.length > 0) {
      updatedData.images = req.files.map((f) => f.path);
    }

    Object.assign(listing, updatedData);
    await listing.save();

    res.json({ ok: true, message: "Anunț actualizat cu succes.", listing });
  } catch (e) {
    console.error("Eroare la PUT /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la editarea anunțului" });
  }
});

/* =======================================================
   🟩 DELETE - Șterge un anunț (doar proprietarul)
======================================================= */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      return res
        .status(403)
        .json({ error: "Nu ai permisiunea să ștergi acest anunț." });
    }

    await listing.deleteOne();
    res.json({ ok: true, message: "Anunț șters cu succes." });
  } catch (e) {
    console.error("Eroare la DELETE /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

/* =======================================================
   🟩 GET un singur anunț după ID (public)
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const listing = await Listing.findById(id).lean();
    if (!listing) {
      return res.status(404).json({ error: "Anunț inexistent" });
    }

    res.json(listing);
  } catch (e) {
    console.error("Eroare la GET /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

export default router;
