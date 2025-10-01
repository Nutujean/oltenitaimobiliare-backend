// routes/users.js
import express from "express";
import User from "../models/User.js";
// ✔️ importă EXACT calea/numele tău: middleware/authMiddleware.js (case-sensitive pe Render)
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/users/me
 * Necesită autentificare.
 * Acceptă user id din: req.userId SAU req.user.id/_id (în funcție de middleware).
 */
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Neautorizat: lipsă userId" });
    }

    const me = await User.findById(userId).select("name email phone");
    if (!me) return res.status(404).json({ error: "Utilizator inexistent" });

    res.json(me);
  } catch (err) {
    console.error("❌ Eroare GET /users/me:", err);
    res.status(500).json({ error: "Eroare la preluarea profilului" });
  }
});

export default router;
