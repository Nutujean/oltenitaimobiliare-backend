import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";
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

// helper universal pt. normalizare
function to07(value = "") {
  let d = String(value).replace(/\D/g, "");
  if (d.startsWith("00407")) d = d.slice(3);
  if (d.startsWith("407")) d = d.slice(1);
  return (d.startsWith("07") && d.length === 10) ? d : null;
}

/* =======================================================
   📲 Trimite OTP
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const n07 = to07(req.body.phone);
    if (!n07) return res.status(400).json({ error: "Număr invalid (07xxxxxxxx)" });

    const result = await sendOtpSMS(n07);
    if (result.success) {
      return res.json({ success: true, message: "Cod trimis cu succes." });
    } else {
      return res.status(400).json({ error: result.error || "Eroare la trimiterea SMS-ului." });
    }
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea SMS-ului." });
  }
});

// 🔐 Verificare OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const n07 = to07(req.body.phone);
    const { code } = req.body;

    if (!n07 || !code) return res.status(400).json({ error: "Telefon sau cod lipsă." });

    const result = await verifyOtpSMS(n07, code);
    if (!result.success) {
      return res.status(400).json({ error: "Cod invalid sau expirat." });
    }

    // 👉 verificăm dacă userul există deja după phone sau email
    let user = await User.findOne({
      $or: [{ phone: n07 }, { email: `${n07}@smslogin.local` }],
    });

    // dacă nu există, îl creăm
    if (!user) {
      user = new User({
        name: `Utilizator ${n07.slice(-4)}`,
        email: `${n07}@smslogin.local`,
        password: Math.random().toString(36).slice(-8),
        phone: n07,
      });
      await user.save();
      console.log("👤 Utilizator nou creat:", n07);
    } else {
      console.log("👤 Utilizator existent:", n07);
    }

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
