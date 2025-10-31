import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";
import User from "../models/User.js";

const router = express.Router();

/* =======================================================
   ⚙️ Limitare cereri OTP — max 3/min/IP
======================================================= */
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Prea multe cereri. Încearcă din nou peste 1 minut." },
});

/* =======================================================
   📲 Trimite OTP
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr de telefon lipsă." });

    const result = await sendOtpSMS(phone);
    if (!result.success) return res.status(400).json(result);

    res.json({ success: true, message: "Codul a fost trimis prin SMS." });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea SMS-ului." });
  }
});

/* =======================================================
   🔐 Verificare OTP + creare / autentificare user
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Telefon sau cod lipsă." });
    }

    const verified = await verifyOtpSMS(phone, code);
    if (!verified.success) {
      return res.status(400).json({ error: "Cod incorect sau expirat." });
    }

    // ⚙️ Normalizează telefonul — doar cifre
    const cleanPhone = phone.replace(/[^\d]/g, "").replace(/^4/, "");

    // 🧠 Căutăm dacă există deja utilizatorul
    let user = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: `${cleanPhone}@smslogin.local` }],
    });

    // Dacă nu există, îl creăm
    if (!user) {
      user = new User({
        name: `Utilizator ${cleanPhone.slice(-4)}`,
        email: `${cleanPhone}@smslogin.local`,
        password: Math.random().toString(36).slice(-8),
        phone: cleanPhone,
      });
      await user.save();
      console.log("👤 Utilizator nou creat:", user.email);
    } else {
      console.log("👤 Utilizator existent autentificat:", user.email);
    }

    // 🔑 Generăm token JWT
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: { id: user._id, phone: user.phone },
    });
  } catch (err) {
    console.error("❌ Eroare verify-otp:", err);
    res.status(500).json({ error: "Eroare server la verificarea OTP." });
  }
});

/* =======================================================
   🧪 Test — pentru verificare rapidă
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

export default router;
