// routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// 🔹 Înregistrare utilizator
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // verifică dacă există deja utilizator
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email deja folosit!" });
    }

    // hash la parolă
    const hashedPassword = await bcrypt.hash(password, 10);

    // crează utilizator nou
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();
    res.status(201).json({ message: "Utilizator înregistrat cu succes!" });
  } catch (err) {
    console.error("Eroare la register:", err);
    res.status(500).json({ message: "Eroare server." });
  }
});

// 🔹 Login utilizator
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email invalid!" });
    }

    // verifică parola
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Parolă greșită!" });
    }

    // generează token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Autentificare reușită",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Eroare la login:", err);
    res.status(500).json({ message: "Eroare server." });
  }
});

export default router;
