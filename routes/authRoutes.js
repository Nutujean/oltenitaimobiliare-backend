import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer"; // păstrat pentru compatibilitate

console.log("✅ authRoutes încărcat corect pe server");
console.log("🔍 CONTACT_EMAIL =", process.env.CONTACT_EMAIL);
console.log("🔍 CONTACT_PASS =", process.env.CONTACT_PASS ? "setat" : "undefined");

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

/* 🟢 Verificare validitate token (pentru frontend ResetPassword.jsx) */
router.get("/check-reset-token", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false, message: "Token lipsă" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(400).json({ valid: false });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ valid: false });

    return res.json({ valid: true });
  } catch (err) {
    console.error("check-reset-token error:", err.message);
    return res.status(400).json({ valid: false });
  }
});

/* 🟢 Resetare parolă - Trimitere email */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "Dacă adresa există, se va trimite un email." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "6h" });
    console.log("🔐 Token generat:", token);
    const resetLink = `https://oltenitaimobiliare.ro/reset-password/${token}`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.CONTACT_PASS || process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Oltenița Imobiliare", email: process.env.CONTACT_EMAIL },
        to: [{ email }],
        subject: "Resetare parolă - Oltenița Imobiliare",
        htmlContent: `
          <h3>Bună,</h3>
          <p>Ai cerut resetarea parolei.</p>
          <p>Apasă pe linkul de mai jos (valabil 6 ore):</p>
          <a href="${resetLink}" style="color:#1a73e8;word-break:break-all;">${resetLink}</a>
          <br/><br/>
          <p>Dacă nu ai cerut această resetare, poți ignora mesajul.</p>
        `,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error("Eroare API Brevo: " + text);
    }

    res.json({ message: "Email de resetare trimis (dacă adresa există)." });
  } catch (err) {
    console.error("❌ Eroare la trimiterea emailului:", err);
    res.status(500).json({ error: "Eroare la trimiterea emailului." });
  }
});

/* 🟢 Resetare parolă - Salvare nouă (cu debug complet JWT) */
router.post("/reset-password/:token", async (req, res) => {
  console.log("🔑 Token primit de la frontend:", req.params.token);
  console.log("🔐 JWT_SECRET folosit:", process.env.JWT_SECRET);

  try {
    const { token } = req.params;
    const { password } = req.body;

    // Debug suplimentar JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("✅ Token decodat corect:", decoded);
    } catch (err) {
      console.error("❌ Verificare JWT a eșuat:", err.message);
      return res.status(400).json({ error: "Token invalid sau expirat. Trimite alt link." });
    }

    // decodăm efectiv tokenul
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      console.error("⚠️ Utilizator negăsit pentru token:", decoded.id);
      return res.status(400).json({ error: "Token invalid sau expirat." });
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    await user.save();

    console.log(`✅ Parolă resetată cu succes pentru utilizatorul ${user.email}`);
    res.json({ message: "Parola a fost resetată cu succes!" });
  } catch (err) {
    console.error("Eroare resetare:", err);
    res.status(400).json({ error: "Token expirat sau invalid." });
  }
});

export default router;
