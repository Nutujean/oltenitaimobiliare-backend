// routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "secret";

// ✅ Fallback-uri SIGURE (niciodată localhost)
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  "https://oltenitaimobiliare.ro";
const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://oltenitaimobiliare-backend.onrender.com";

/** Generează token de verificare valabil 24h */
function newVerificationToken() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

/* ========================= REGISTER ========================= */
router.post("/register", async (req, res) => {
  try {
    const { name = "", email = "", password = "" } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email și parolă obligatorii" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Parola trebuie să aibă minim 6 caractere" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // ✔️ Dacă există, dar NU e verificat: regenerează token + retrimite emailul
      if (!existing.verified) {
        const hashed = await bcrypt.hash(password, 10);
        const { token, expires } = newVerificationToken();

        existing.name = name || existing.name;
        existing.password = hashed;
        existing.verificationToken = token;
        existing.verificationTokenExpiresAt = expires;
        await existing.save();

        const verifyLink = `${FRONTEND_URL}/verifica-email?token=${token}`;
        const apiFallback = `${BACKEND_URL}/api/auth/verify-email?token=${token}`;

        await sendEmail({
          to: existing.email,
          subject: "Confirmă-ți emailul — Oltenița Imobiliare",
          html: `
            <p>Salut${existing.name ? " " + existing.name : ""},</p>
            <p>Apasă pentru a-ți activa contul:</p>
            <p><a href="${verifyLink}" target="_blank">Confirmă adresa de email</a></p>
            <p style="font-size:12px;color:#666">
              Dacă linkul de mai sus nu funcționează, folosește varianta de rezervă:<br/>
              <a href="${apiFallback}" target="_blank">${apiFallback}</a>
            </p>
          `,
        });

        return res.status(200).json({
          ok: true,
          message:
            "Cont existent neconfirmat — ți-am retrimis emailul de verificare.",
        });
      }
      return res.status(400).json({ error: "Există deja un cont cu acest email" });
    }

    // ✔️ User nou
    const hashed = await bcrypt.hash(password, 10);
    const { token, expires } = newVerificationToken();

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      verified: false,
      verificationToken: token,
      verificationTokenExpiresAt: expires,
    });

    const verifyLink = `${FRONTEND_URL}/verifica-email?token=${token}`;
    const apiFallback = `${BACKEND_URL}/api/auth/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Confirmă-ți emailul — Oltenița Imobiliare",
      html: `
        <p>Bună${user.name ? " " + user.name : ""},</p>
        <p>Te rugăm să-ți activezi contul apăsând pe linkul de mai jos:</p>
        <p><a href="${verifyLink}" target="_blank">Confirmă adresa de email</a></p>
        <p style="font-size:12px;color:#666">
          Dacă linkul de mai sus nu funcționează, folosește varianta de rezervă:<br/>
          <a href="${apiFallback}" target="_blank">${apiFallback}</a>
        </p>
        <p>Linkul este valabil 24 de ore.</p>
      `,
    });

    res
      .status(201)
      .json({ ok: true, message: "Cont creat. Verifică emailul pentru activare." });
  } catch (e) {
    if (e?.code === 11000) {
      return res
        .status(400)
        .json({ error: "Există deja un cont cu acest email" });
    }
    console.error("register error:", e);
    res.status(500).json({ error: "Eroare la înregistrare" });
  }
});

/* ==================== VERIFY EMAIL (GET) ==================== */
router.get("/verify-email", async (req, res) => {
  try {
    const { token = "" } = req.query;
    if (!token) return res.status(400).json({ error: "Token lipsă" });

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Token invalid sau expirat. Solicită retrimiterea emailului." });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("verify get error:", e);
    res.status(500).json({ error: "Eroare la verificare" });
  }
});

/* ==================== VERIFY EMAIL (POST) =================== */
router.post("/verify-email", async (req, res) => {
  try {
    const { token = "" } = req.body;
    if (!token) return res.status(400).json({ error: "Token lipsă" });

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Token invalid sau expirat. Solicită retrimiterea emailului." });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("verify post error:", e);
    res.status(500).json({ error: "Eroare la verificare" });
  }
});

/* ================= RESEND VERIFICATION ===================== */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email = "" } = req.body;
    if (!email) return res.status(400).json({ error: "Email lipsă" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "Nu există cont cu acest email" });

    if (user.verified) {
      return res.status(400).json({ error: "Email deja verificat" });
    }

    const { token, expires } = newVerificationToken();
    user.verificationToken = token;
    user.verificationTokenExpiresAt = expires;
    await user.save();

    const verifyLink = `${FRONTEND_URL}/verifica-email?token=${token}`;
    const apiFallback = `${BACKEND_URL}/api/auth/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Re-trimitere verificare email — Oltenița Imobiliare",
      html: `
        <p>Salut${user.name ? " " + user.name : ""},</p>
        <p>Apasă pe link pentru a-ți activa contul:</p>
        <p><a href="${verifyLink}" target="_blank">Confirmă adresa de email</a></p>
        <p style="font-size:12px;color:#666">
          Dacă linkul de mai sus nu funcționează, folosește varianta de rezervă:<br/>
          <a href="${apiFallback}" target="_blank">${apiFallback}</a>
        </p>
        <p>Linkul este valabil 24 de ore.</p>
      `,
    });

    res.json({ ok: true, message: "Emailul de verificare a fost retrimis." });
  } catch (e) {
    console.error("resend error:", e);
    res.status(500).json({ error: "Eroare la retrimiterea emailului" });
  }
});

/* ========================= LOGIN =========================== */
router.post("/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: "Email sau parolă incorecte" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Email sau parolă incorecte" });

    if (!user.verified) {
      return res
        .status(403)
        .json({ error: "Emailul nu este verificat", code: "EMAIL_NOT_VERIFIED" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: "Eroare la autentificare" });
  }
});

/* =============== TEST: TRIMITE UN EMAIL SIMPLU ============== */
router.post("/test-email", async (req, res) => {
  try {
    const { to = "" } = req.body;
    if (!to) return res.status(400).json({ error: "Lipsește 'to'." });

    await sendEmail({
      to,
      subject: "Test — Oltenița Imobiliare",
      html: "<p>Salut! Acesta este un email de test trimis prin API.</p>",
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("test-email error:", e);
    res.status(500).json({ error: e.message || "Eroare la trimitere" });
  }
});

export default router;
