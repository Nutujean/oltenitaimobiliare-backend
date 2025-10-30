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

/* =======================================================
   🧪 Test rapid
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

/* =======================================================
   📲 Trimitere OTP prin SMS
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr de telefon lipsă." });

    // Normalizează numărul în format internațional (+40)
    phone = phone
      .replace(/[^\d]/g, "")
      .replace(/^0/, "+40")
      .replace(/^4/, "+4")
      .replace(/^40/, "+40");

    console.log("📞 Trimitem OTP către:", phone);

    const result = await sendOtpSMS(phone);
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
   🔐 Verificare OTP + Creare user automat (doar telefon)
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    let { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "Telefon sau cod lipsă." });

    // Normalizează
    phone = phone
      .replace(/[^\d]/g, "")
      .replace(/^0/, "+40")
      .replace(/^4/, "+4")
      .replace(/^40/, "+40");

    const result = await verifyOtpSMS(phone, code);
    if (!result.success) {
      return res.status(400).json({ error: "Cod invalid sau expirat." });
    }

    // 🔹 Verificăm dacă userul există
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({
        name: `Utilizator ${phone.slice(-4)}`,
        phone,
        email: `${phone}@sms.local`, // pentru unicitate, dar nu se folosește
        password: "smslogin", // dummy field pentru model
      });
      await user.save();
      console.log("👤 Utilizator nou creat prin SMS:", phone);
    }

    // 🔹 Generăm token JWT
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: { id: user._id, phone: user.phone, name: user.name },
    });
  } catch (err) {
    console.error("❌ Eroare verify-otp:", err);
    res.status(500).json({ error: "Eroare server la verificarea OTP." });
  }
});

export default router;
