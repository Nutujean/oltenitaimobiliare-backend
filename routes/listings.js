import express from "express";
import Listing from "../models/Listing.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ LISTA PUBLICĂ DE ANUNȚURI (fără token)
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADAUGĂ ANUNȚ (doar utilizator logat)
router.post("/", verifyToken, async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.json(newListing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
