import express from "express";
import Listing from "../models/Listing.js";
import auth from "../authMiddleware.js";

const router = express.Router();

/**
 * ✅ Returnează anunțurile utilizatorului logat
 * - compatibil cu schema nouă (user)
 * - compatibil cu schema veche (userId)
 */
router.get("/anunturile-mele", auth, async (req, res) => {
  try {
    const userMongoId = req.user._id || req.user.id;

    const anunturi = await Listing.find({
      $or: [
        { user: userMongoId },
        { userId: userMongoId }, // fallback pt anunțuri vechi
      ],
    }).sort({ createdAt: -1 });

    res.json(anunturi);
  } catch (err) {
    console.error("❌ Eroare la /api/anunturile-mele:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

export default router;
