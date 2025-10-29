import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import sendSMS from "../utils/smsLink.js";
import User from "../models/User.js";

const router = express.Router();

/* =======================================================
   ⚙️ Limitare requesturi — max 3/min per IP
======================================================= */
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Prea multe cereri. Încearcă din nou peste 1 minut." },
});

/* =======================================================
   🔢 Generare și stocare OTP temporar (în memorie)
======================================================= */
const otpStore = new Map(); // { phone: { code, expires } }

/* =======================================================
   📲 Trimitere OTP prin SMS
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr de telefon lipsă." });

    const normalized = phone.replace(/\D/g, "").replace(/^0/, "4");

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(normalized, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 min

    const result = await sendSMS(normalized, `Codul tău de autentificare este: ${code}`);

    if (result.success) {
      res.json({ success: true, message: "Cod trimis cu succes prin SMS." });
    } else {
      res.status(400).json({ error: result.error || "Eroare la trimiterea SMS-ului." });
    }
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea SMS-ului." });
  }
});

/* =======================================================
   🔐 Verificare OTP + Autentificare / Creare user
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "Telefon sau cod lipsă." });

    const normalized = phone.replace(/\D/g, "").replace(/^0/, "4");

    const otpData = otpStore.get(normalized);
    if (!otpData || otpData.code !== code || otpData.expires < Date.now()) {
      return res.status(400).json({ error: "Cod invalid sau expirat." });
    }

    // Ștergem OTP-ul după validare
    otpStore.delete(normalized);

    // Căutăm userul sau îl creăm
    let user = await User.findOne({ phone: normalized });
    if (!user) {
      user = new User({
        name: `Utilizator ${normalized.slice(-4)}`,
        email: `${normalized}@smslogin.local`,
        password: Math.random().toString(36).slice(-8),
        phone: normalized,
      });
      await user.save();
      console.log("👤 Utilizator nou creat prin SMS:", normalized);
    }

    // Token JWT
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
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
   🧪 Test route
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

export default router;
