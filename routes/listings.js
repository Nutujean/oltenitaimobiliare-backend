// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
   - Afișează toate anunțurile active sau fără expirare
   - Ascunde doar cele clar expirate (free sau promovate)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const now = new Date();

    const listings = await Listing.find({
      $or: [
        { featuredUntil: { $gte: now } },        // ✅ promovate valabile
        { expiresAt: { $gte: now } },            // ✅ gratuite încă active
        { featuredUntil: null, expiresAt: null }, // ✅ anunțuri vechi (fără expirare)
        { isFree: { $exists: false } },          // ✅ anunțuri dinaintea sistemului nou
      ],
    })
      .sort({ createdAt: -1 })
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
    const myListings = await Listing.find({
      user: req.user._id || req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 GET un singur anunț
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id)
      .populate("user", "_id name email")
      .lean();

    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    res.json(listing);
  } catch (e) {
    console.error("Eroare la GET /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (autentificat)
======================================================= */
router.post("/", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // verifică dacă utilizatorul are deja un anunț gratuit activ
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

    // creează anunțul nou gratuit cu expirare 10 zile
    const newListing = new Listing({
      ...req.body,
      user: userId,
      isFree: true,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 zile
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (e) {
    console.error("Eroare la POST /api/listings:", e);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/* =======================================================
   🟩 PUT - Editează un anunț (doar proprietarul)
======================================================= */
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      console.warn(
        `❌ Tentativă editare neautorizată: ${req.user._id || req.user.id}`
      );
      return res
        .status(403)
        .json({ error: "Nu ai permisiunea să editezi acest anunț." });
    }

    Object.assign(listing, req.body);
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
      console.warn(
        `❌ Tentativă ștergere neautorizată: ${req.user._id || req.user.id}`
      );
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

export default router;
