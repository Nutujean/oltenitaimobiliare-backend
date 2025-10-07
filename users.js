import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

/**
 * ✅ POST /api/users/register
 * Creează un cont nou
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Există deja un cont cu acest email" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (err) {
    console.error("Eroare la înregistrare:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

/**
 * ✅ POST /api/users/login
 * Autentificare utilizator existent
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Introdu emailul și parola" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Email sau parolă incorectă" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Email sau parolă incorectă" });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (err) {
    console.error("Eroare la autentificare:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

/**
 * ✅ GET /api/users/me
 * Returnează datele utilizatorului logat (necesită token)
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId || req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "Utilizator inexistent" });

    res.json(user);
  } catch (err) {
    console.error("Eroare la obținerea profilului:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
