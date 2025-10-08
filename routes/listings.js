// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 }).lean();
    res.json(listings);
  } catch (e) {
    console.error("Eroare la GET /api/listings:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor" });
  }
});

/* =======================================================
   🟩 GET anunțurile utilizatorului logat — ⚠️ înainte de /:id
======================================================= */
router.get("/my", auth, async (req, res) => {
  try {
    const myListings = await Listing.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    return res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 GET un singur anunț (public)
======================================================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID anunț invalid" });
  }

  const listing = await Listing.findById(id)
    .populate("user", "_id name email")
    .lean();

  if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

  res.json(listing);
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (doar autentificat)
======================================================= */
router.post("/", auth, async (req, res) => {
  try {
    const newListing = new Listing({
      ...req.body,
      user: req.user.id,
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
router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID anunț invalid" });
  }

  const listing = await Listing.findById(id);
  if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

  if (String(listing.user) !== String(req.user.id)) {
    console.warn(`⚠️ Tentativă editare neautorizată: ${req.user.id}`);
    return res.status(403).json({ error: "Nu ai permisiunea să editezi." });
  }

  Object.assign(listing, req.body);
  await listing.save();
  res.json({ ok: true, listing });
});

/* =======================================================
   🟩 DELETE - Șterge un anunț (doar proprietarul)
======================================================= */
router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID anunț invalid" });
  }

  const listing = await Listing.findById(id);
  if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

  if (String(listing.user) !== String(req.user.id)) {
    console.warn(`⚠️ Tentativă ștergere neautorizată: ${req.user.id}`);
    return res.status(403).json({ error: "Nu ai permisiunea să ștergi." });
  }

  await listing.deleteOne();
  res.json({ ok: true, message: "Anunț șters." });
});

/* =======================================================
   🟥 fallback pentru rute invalide
======================================================= */
router.all("*", (_req, res) => {
  res.status(404).json({ error: "Ruta inexistentă." });
});

export default router;
