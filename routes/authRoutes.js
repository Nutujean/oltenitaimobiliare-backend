import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

/* 🧩 Înregistrare utilizator */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "Email deja înregistrat" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, phone });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      token,
    });
  } catch (error) {
    console.error("Eroare la înregistrare:", error);
    res.status(500).json({ message: "Eroare server la înregistrare." });
  }
});

/* 🧩 Login utilizator */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Email inexistent." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Parolă incorectă." });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      token,
    });
  } catch (error) {
    console.error("Eroare la login:", error);
    res.status(500).json({ message: "Eroare server la autentificare." });
  }
});

/* 🧩 Profil utilizator logat */
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user)
      return res.status(404).json({ message: "Utilizator negăsit." });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Eroare server la profil." });
  }
});

/* 🧩 Toți utilizatorii (doar admin) */
router.get("/all", protect, admin, async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

/* 🧩 Actualizare profil (nume & telefon) */
router.put("/update/:id", protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.params.id;

    if (req.user._id.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Acces interzis." });
    }

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilizatorul nu există." });

    if (name) user.name = name;
    if (phone) user.phone = phone;

    const updated = await user.save();
    const userObj = updated.toObject();
    delete userObj.password;
    delete userObj.__v;

    res.json(userObj);
  } catch (error) {
    console.error("Eroare la actualizare utilizator:", error);
    res.status(500).json({ message: "Eroare la actualizare utilizator." });
  }
});

export default router;
