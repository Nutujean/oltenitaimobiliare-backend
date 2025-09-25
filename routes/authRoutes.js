import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// 🔹 Înregistrare utilizator
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ msg: "Toate câmpurile sunt obligatorii." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email-ul este deja folosit." });
    }

    // hash parolă
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ msg: "Utilizator înregistrat cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la înregistrare:", err);
    res.status(500).json({ msg: "Eroare server." });
  }
});

// 🔹 Login utilizator
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Completează toate câmpurile." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Utilizator inexistent." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Parolă incorectă." });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Eroare la login:", err);
    res.status(500).json({ msg: "Eroare server." });
  }
});

export default router;
