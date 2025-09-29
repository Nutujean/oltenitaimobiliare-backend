import express from "express";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Eroare la încărcarea anunțurilor" });
  }
});

// GET un anunț după id
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Anunțul nu a fost găsit" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Eroare la încărcarea anunțului" });
  }
});

// POST - adaugă anunț (doar logat)
router.post("/", protect, async (req, res) => {
  try {
    const newListing = new Listing({ ...req.body, user: req.user.id });
    const saved = await newListing.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: "Eroare la adăugare anunț" });
  }
});

// PUT - doar proprietarul poate edita
router.put("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Anunțul nu există" });

    if (listing.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Nu ai voie să editezi acest anunț" });
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Eroare la actualizare anunț" });
  }
});

// DELETE - doar proprietarul poate șterge
router.delete("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Anunțul nu există" });

    if (listing.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Nu ai voie să ștergi acest anunț" });
    }

    await listing.deleteOne();
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    res.status(500).json({ message: "Eroare la ștergere anunț" });
  }
});

export default router;
