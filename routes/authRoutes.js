// routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import User from "../models/User.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const FRONTEND =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  "https://oltenitaimobiliare.ro";
const BACKEND = process.env.BACKEND_URL || "https://oltenitaimobiliare-backend.onrender.com";

/** Helper: semnează token JWT */
function signJwt(user) {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
router.post("/register", async (req, res) => {
  try {
    const { name = "", email = "", password = "" } = req.body || {};
    if (!name.trim() || !email.trim() || !password)
      return res.status(400).json({ error: "Completează nume, email și parolă" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.verified === false) {
        // utilizator neconfirmat – retrimitem mailul
        existing.verificationToken = crypto.randomBytes(32).toString("hex");
        existing.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await existing.save();

        const verifyUrl = `${BACKEND}/api/auth/verify?token=${existing.verificationToken}`;
        await sendEmail({
          to: email,
          subject: "Confirmă-ți contul - Oltenița Imobiliare",
          html: `<p>Bună, ${name}!</p>
                 <p>Confirmă-ți contul apăsând pe link:</p>
                 <p><a href="${verifyUrl}" target="_blank">${verifyUrl}</a></p>
                 <p>Linkul expiră în 24h.</p>`,
        });
        return res.status(200).json({ ok: true, message: "Email de verificare retrimis." });
      }
      return res.status(400).json({ error: "Email deja folosit" });
    }

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      verified: false,
      verificationToken: token,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verifyUrl = `${BACKEND}/api/auth/verify?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Confirmă-ți contul - Oltenița Imobiliare",
      html: `<p>Bună, ${user.name}!</p>
             <p>Apasă pentru a-ți confirma contul:</p>
             <p><a href="${verifyUrl}" target="_blank">${verifyUrl}</a></p>
             <p>Linkul expiră în 24h.</p>`,
    });

    res.json({ ok: true, message: "Cont creat. Verifică emailul pentru activare." });
  } catch (e) {
    console.error("register error:", e);
    res.status(500).json({ error: "Eroare internă la înregistrare" });
  }
});

/**
 * GET /api/auth/verify?token=...
 * Activează contul
 */
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("Token lipsă");

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).send("Token invalid sau expirat");

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // redirecționăm spre login cu mesaj
    return res.redirect(`${FRONTEND}/login?verified=1`);
  } catch (e) {
    console.error("verify error:", e);
    res.status(500).send("Eroare la verificare");
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: "Email sau parolă incorecte" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Email sau parolă incorecte" });

    if (user.verified === false) {
      return res.status(403).json({ error: "Cont neconfirmat. Verifică emailul." });
    }

    const token = signJwt(user);
    res.json({
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: "Eroare internă la autentificare" });
  }
});

/**
 * POST /api/auth/test-email  (opțional pentru test)
 * Body: { to }
 */
router.post("/test-email", async (req, res) => {
  try {
    const to = req.body?.to;
    if (!to) return res.status(400).json({ error: "Lipsește 'to'" });
    await sendEmail({
      to,
      subject: "Test email - Oltenița Imobiliare",
      html: "<p>Funcționează ✅</p>",
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("test-email error:", e);
    res.status(500).json({ error: e.message || "Eroare test email" });
  }
});

export default router;
