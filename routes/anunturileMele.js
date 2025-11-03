import express from "express";
import Listing from "../models/Listing.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/**
 * ✅ Returnează anunțurile utilizatorului logat
 */
router.get("/anunturile-mele", auth, async (req, res) => {
  try {
    const anunturi = await Listing.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(anunturi);
  } catch (err) {
    console.error("❌ Eroare la /api/anunturile-mele:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

export default router;
