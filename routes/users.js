// routes/users.js
import express from "express";
import User from "../models/User.js";
// 👇 importă exact numele fișierului tău
import auth from "../middleware/authMiddlewaare.js"; // atenție: numele/calea corecte și .js inclus

const router = express.Router();

/**
 * GET /api/users/me
 * Necesită middleware de auth. Acceptă:
 *  - req.userId  sau
 *  - req.user.id / req.user._id  (dacă middleware-ul atașează obiectul user)
 */
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Neautorizat: lipsă userId" });

    const me = await User.findById(userId).select("name email phone");
    if (!me) return res.status(404).json({ error: "Utilizator inexistent" });

    res.json(me);
  } catch (err) {
    console.error("❌ Eroare GET /users/me:", err);
    res.status(500).json({ error: "Eroare la preluarea profilului" });
  }
});

export default router;
