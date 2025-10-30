import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";

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
   📲 Trimitere OTP
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr de telefon lipsă." });

    const result = await sendOtpSMS(phone);
    if (!result.success) return res.status(400).json({ error: result.error || "Eroare SMS." });

    res.json({ success: true, message: "Cod trimis cu succes." });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea SMS-ului." });
  }
});

/* =======================================================
   🔐 Verificare OTP + Autentificare / Înregistrare
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Telefon sau cod lipsă." });

    const result = await verifyOtpSMS(phone, code);
    if (!result.success) return res.status(400).json({ error: "Cod incorect sau expirat." });

    // ✅ Caută userul sau creează-l
    const normalizedPhone = phone.replace(/[^\d]/g, "").replace(/^40/, "0");
    let user = await User.findOne({ phone: normalizedPhone });

    if (!user) {
      user = new User({
        name: `Utilizator ${String(normalizedPhone).slice(-4)}`,
        email: `${normalizedPhone}@smslogin.local`,
        password: Math.random().toString(36).slice(-10),
        phone: normalizedPhone,
      });
      await user.save();
      console.log("👤 Utilizator nou creat:", normalizedPhone);
    }

    // ✅ Generează token JWT
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user: { id: user._id, phone: user.phone } });
  } catch (err) {
    console.error("❌ Eroare verify-otp:", err);
    res.status(500).json({ error: "Eroare server la verificarea OTP." });
  }
});

/* =======================================================
   🧪 Test — verifică dacă ruta merge
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

export default router;
