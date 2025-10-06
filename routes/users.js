// routes/users.js
import express from "express";
import auth from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/users/me
 * Profilul utilizatorului autentificat
 */
router.get("/me", auth, async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id;
    const user = await User.findById(id)
      .select("-password -verificationToken -verificationTokenExpires -__v");
    if (!user) return res.status(404).json({ error: "Utilizator inexistent" });
    res.json(user);
  } catch (e) {
    console.error("GET /users/me error:", e);
    res.status(500).json({ error: "Eroare server la /users/me" });
  }
});

export default router;
