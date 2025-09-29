import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Emailul este deja folosit" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(newUser._id);

    res.status(201).json({
      token,
      name: newUser.name, // 👈 trimitem numele
    });
  } catch (err) {
    res.status(500).json({ message: "Eroare la înregistrare" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email sau parolă invalidă" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Email sau parolă invalidă" });

    const token = generateToken(user._id);

    res.json({
      token,
      name: user.name, // 👈 trimitem numele
    });
  } catch (err) {
    res.status(500).json({ message: "Eroare la login" });
  }
});

export default router;
