// routes/users.js
import express from "express";
import User from "../models/User.js";
import auth from "../middleware/auth.js"; // ← dacă la tine se numește altfel (ex: verifyToken), modifică aici

const router = express.Router();

/**
 * GET /api/users/me
 * Returnează profilul utilizatorului autentificat (name, email, phone)
 * Necesită middleware-ul de auth care setează req.userId
 */
router.get("/me", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("name email phone");
    if (!me) return res.status(404).json({ error: "Utilizator inexistent" });
    res.json(me);
  } catch (err) {
    console.error("❌ Eroare GET /users/me:", err);
    res.status(500).json({ error: "Eroare la preluarea profilului" });
  }
});

export default router;
