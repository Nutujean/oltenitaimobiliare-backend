import express from "express";
import Listing from "../models/Listing.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ✅ Toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// ✅ Anunțurile unui user
router.get("/user/:email", async (req, res) => {
  try {
    const listings = await Listing.find({ userEmail: req.params.email });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțurilor utilizatorului" });
  }
});

// ✅ Un anunț după ID
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

// ✅ Creare anunț
router.post("/", verifyToken, async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
});

// ✅ Ștergere anunț
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

// ✅ Marchează rezervat
router.patch("/:id/rezervat", verifyToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    listing.rezervat = !listing.rezervat;
    await listing.save();

    res.json({ rezervat: listing.rezervat });
  } catch (err) {
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

export default router;
