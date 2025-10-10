import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * ✅ Alias pentru /users/profile
 * Rezolvă eroarea 404 venită din frontend (Anunturile Mele)
 */
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Utilizator negăsit." });
    }
    res.json(user);
  } catch (error) {
    console.error("Eroare la /profile:", error);
    res.status(500).json({ message: "Eroare server la profil." });
  }
});

/**
 * 🔹 Exemplu de rută admin (poate rămâne sau fi ignorată)
 * (dacă ai nevoie să vezi toți utilizatorii)
 */
router.get("/all", protect, admin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error("Eroare la /users/all:", error);
    res.status(500).json({ message: "Eroare la obținerea utilizatorilor." });
  }
});

export default router;
