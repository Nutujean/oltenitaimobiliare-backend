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
   📲 Trimitere OTP
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr de telefon lipsă." });

    // normalizează numărul (ex: 07 → 407)
    const normalized = phone.replace(/\D/g, "").replace(/^0/, "4");

    const result = await sendOtpSMS(normalized);
    if (result.success) {
      res.json({ success: true, message: "Cod trimis cu succes." });
    } else {
      res.status(400).json({ error: result.error || "Eroare la trimiterea SMS-ului." });
    }
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea SMS-ului." });
  }
});

/* =======================================================
   🔐 Verificare OTP
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "Telefon sau cod lipsă." });

    const normalized = phone.replace(/\D/g, "").replace(/^0/, "4");
    const result = await verifyOtpSMS(normalized, code);

    if (!result.success) {
      return res.status(400).json({ error: "Cod invalid sau expirat." });
    }

    // 👉 verificăm dacă userul există deja
    let user = await User.findOne({ phone: normalized });
    if (!user) {
      user = new User({
        name: `Utilizator ${normalized.slice(-4)}`,
        email: `${normalized}@smslogin.local`,
        password: Math.random().toString(36).slice(-8), // generăm ceva random
        phone: normalized,
      });
      await user.save();
      console.log("👤 Utilizator nou creat prin SMS:", normalized);
    }

    // generăm token JWT
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

export default router;
