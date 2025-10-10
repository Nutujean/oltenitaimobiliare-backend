import express from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  getAllUsers,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/* 🧩 AUTENTIFICARE DE BAZĂ */
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getUserProfile);
// ✅ fallback sigur pentru /api/auth/profile (evită 404 în aplicație)
router.get("/profile", protect, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: "Utilizator negăsit." });
    }

    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || "",
    });
  } catch (err) {
    console.error("Eroare la profil:", err);
    res.status(500).json({ message: "Eroare server la profil." });
  }
});

router.get("/all", protect, admin, getAllUsers);

/* 🧩 RECUPERARE / RESETARE PAROLĂ */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-email/:token", verifyEmail);

/* 🧩 ACTUALIZARE PROFIL UTILIZATOR (Nume + Telefon) */
router.put("/update/:id", protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: "ID utilizator lipsă." });
    }

    // verificăm permisiunea
    if (
      req.user &&
      req.user._id?.toString() !== userId &&
      !req.user.isAdmin
    ) {
      return res
        .status(403)
        .json({ message: "Nu ai permisiunea să modifici acest utilizator." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilizatorul nu există." });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;

    const updatedUser = await user.save();
    const safeUser = {
      _id: updatedUser._id,
      name: updatedUser.name,
      phone: updatedUser.phone || "",
      email: updatedUser.email,
    };

    res.json(safeUser);
  } catch (error) {
    console.error("Eroare la actualizare utilizator:", error);
    res.status(500).json({ message: "Eroare server la actualizare utilizator." });
  }
});

export default router;
