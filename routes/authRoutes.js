// routes/authRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* ------------------- REGISTER ------------------- */
router.post("/register", async (req, res) => {
  try {
    const { name = "", email = "", password = "" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email și parolă obligatorii" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email deja folosit" });

    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email,
      password: hash,
      isVerified: false,
      verifyToken,
    });

    // trimitem email de verificare
    const verifyLink = `${process.env.FRONTEND_URL}/verifica-email?token=${verifyToken}`;
    await sendEmail(
      user.email,
      "Confirmă-ți adresa de email",
      `
      <p>Bună ${user.name || ""},</p>
      <p>Te rugăm să-ți confirmi adresa de email pentru Oltenița Imobiliare:</p>
      <p><a href="${verifyLink}" target="_blank" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Confirmă emailul</a></p>
      <p>Sau accesează: ${verifyLink}</p>
      `
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("register error:", e);
    res.status(500).json({ error: "Eroare la înregistrare" });
  }
});

/* ------------------- VERIFY EMAIL ------------------- */
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Token lipsă" });

    const user = await User.findOne({ verifyToken: token });
    if (!user) return res.status(400).json({ error: "Token invalid" });

    user.isVerified = true;
    user.verifyToken = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("verify error:", e);
    res.status(500).json({ error: "Eroare la verificare" });
  }
});

/* ------------------- RESEND VERIFY ------------------- */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Nu există cont cu acest email" });
    if (user.isVerified) return res.status(400).json({ error: "Cont deja verificat" });

    user.verifyToken = crypto.randomBytes(32).toString("hex");
    await user.save();

    const verifyLink = `${process.env.FRONTEND_URL}/verifica-email?token=${user.verifyToken}`;
    await sendEmail(
      user.email,
      "Re-trimitem confirmarea adresei de email",
      `
      <p>Bună ${user.name || ""},</p>
      <p>Accesează linkul pentru a confirma adresa de email:</p>
      <p><a href="${verifyLink}" target="_blank" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Confirmă emailul</a></p>
      <p>Sau: ${verifyLink}</p>
      `
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("resend error:", e);
    res.status(500).json({ error: "Eroare la retrimitere email" });
  }
});

/* ------------------- LOGIN ------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Email sau parolă greșite" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(400).json({ error: "Email sau parolă greșite" });

    // Poți forța verificarea emailului înainte de login dacă vrei
    // if (!user.isVerified) return res.status(403).json({ error: "Confirmă-ți adresa de email" });

    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, isVerified: user.isVerified, createdAt: user.createdAt }
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ error: "Eroare la autentificare" });
  }
});

/* ------------------- FORGOT PASSWORD ------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email = "" } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email obligatoriu" });

    const user = await User.findOne({ email });
    // răspuns generic, fără a divulga existența contului
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 oră
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/resetare-parola?token=${token}`;

    await sendEmail(
      user.email,
      "Resetează-ți parola",
      `
      <p>Bună ${user.name || ""},</p>
      <p>Ai solicitat resetarea parolei pentru Oltenița Imobiliare.</p>
      <p><a href="${resetLink}" target="_blank" style="background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Resetează parola</a></p>
      <p>Linkul expiră în 1 oră. Dacă nu ai solicitat tu, ignoră acest email.</p>
      <p>Sau: ${resetLink}</p>
      `
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("forgot-password error:", e);
    res.status(500).json({ error: "Eroare la trimiterea emailului de resetare" });
  }
});

/* ------------------- CHECK RESET TOKEN (opțional UX) ------------------- */
router.get("/check-reset-token", async (req, res) => {
  try {
    const { token = "" } = req.query || {};
    if (!token) return res.status(400).json({ error: "Token lipsă" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: "Token invalid sau expirat" });
    res.json({ ok: true });
  } catch (e) {
    console.error("check-reset-token error:", e);
    res.status(500).json({ error: "Eroare verificare token" });
  }
});

/* ------------------- RESET PASSWORD ------------------- */
router.post("/reset-password", async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "Date incomplete" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: "Token invalid sau expirat" });

    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // dacă vrei, consideră contul verificat după schimbarea parolei
    // user.isVerified = true;

    await user.save();
    res.json({ ok: true });
  } catch (e) {
    console.error("reset-password error:", e);
    res.status(500).json({ error: "Eroare la resetarea parolei" });
  }
});

export default router;
