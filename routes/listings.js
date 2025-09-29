import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// Înregistrare utilizator
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii!" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "Email deja folosit!" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Parola trebuie să aibă minim 6 caractere!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "✅ Utilizator creat cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la înregistrare:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Login utilizator
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Email sau parolă incorectă!" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Email sau parolă incorectă!" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "✅ Autentificare reușită!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("❌ Eroare la login:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
