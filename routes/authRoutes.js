import express from "express";
import { protect, } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

/* --------------------------------------------------------------
   ✅ FUNCȚII MINIME INTEGRATE (înlocuiesc authController.js lipsă)
-------------------------------------------------------------- */

// Înregistrare utilizator
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "Email deja înregistrat" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, phone });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      }),
    });
  } catch (err) {
    res.status(500).json({ message: "Eroare server la înregistrare" });
  }
};

// Login utilizator
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email inexistent" });
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Parolă incorectă" });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      }),
    });
  } catch (err) {
    res.status(500).json({ message: "Eroare server la autentificare" });
  }
};

// Obține profil utilizator
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "Utilizator negăsit" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Eroare server la profil" });
  }
};

// ✅ Funcții placeholder (pentru compatibilitate)
const getAllUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};
const updateUserProfile = async (req, res) => {
  res.json({ message: "updateUserProfile neimplementat (dar existent)" });
};
const forgotPassword = async (req, res) => {
  res.json({ message: "forgotPassword neimplementat (dar existent)" });
};
const resetPassword = async (req, res) => {
  res.json({ message: "resetPassword neimplementat (dar existent)" });
};
const verifyEmail = async (req, res) => {
  res.json({ message: "verifyEmail neimplementat (dar existent)" });
};

/* --------------------------------------------------------------
   🔹 RUTE API ORIGINALE (tot ce aveai înainte rămâne identic)
-------------------------------------------------------------- */

/* 🧩 Autentificare de bază */
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getUserProfile);
router.get("/all", protect, admin, getAllUsers);

/* 🧩 Recuperare / Resetare parolă */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-email/:token", verifyEmail);

/* 🧩 Actualizare profil utilizator (nume & telefon) */
router.put("/update/:id", protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.params.id;

    // Verificăm permisiunea
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

    // Actualizăm doar câmpurile primite
    if (name) user.name = name;
    if (phone) user.phone = phone;

    const updatedUser = await user.save();
    const responseUser = updatedUser.toObject
      ? updatedUser.toObject()
      : updatedUser;
    delete responseUser.password;
    delete responseUser.__v;

    res.json(responseUser);
  } catch (error) {
    console.error("Eroare la actualizare utilizator:", error);
    res.status(500).json({ message: "Eroare la actualizare utilizator" });
  }
});

/* ✅ fallback pentru profil (în caz că controllerul lipsea complet) */
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

export default router;
