// routes/users.js
import express from "express";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/users/me  -> cere Bearer token și întoarce userul fără parolă
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "Utilizator inexistent" });
    res.json(user);
  } catch (e) {
    console.error("GET /users/me error:", e);
    res.status(500).json({ error: "Eroare la preluarea profilului" });
  }
});

export default router;
