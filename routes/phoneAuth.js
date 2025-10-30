import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import sendSMS from "../utils/smsLink.js";
import User from "../models/User.js";

const router = express.Router();

// 🧠 Stocăm temporar codurile OTP în memorie
const otpStore = {};

/* =======================================================
   ⚙️ Limitare requesturi — max 3/min per IP
======================================================= */
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Prea multe cereri. Încearcă din nou peste 1 minut." },
});

/* =======================================================
   🧪 Testare rută
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

/* =======================================================
   📲 Trimitere cod OTP
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ error: "Număr de telefon lipsă." });

    const normalized = phone.replace(/\D/g, "").replace(/^0/, "4");
    const otp = Math.floor(100000 + Math.random() * 900000); // 6 cifre random
    otpStore[normalized] = { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    const result = await sendSMS.sendOtpSMS(normalized, otp);

    if (result.success) {
      console.log(`📤 OTP ${otp} trimis către ${normalized}`);
      res.json({ success: true, message: "Cod trimis prin SMS." });
    } else {
      delete otpStore[normalized];
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
    const record = otpStore[normalized];

    if (!record)
      return res.status(400).json({ error: "Cod expirat sau inexistent." });
    if (Date.now() > record.expiresAt)
      return res.status(400).json({ error: "Cod expirat." });
    if (String(record.code) !== String(code))
      return res.status(400).json({ error: "Cod incorect." });

    delete otpStore[normalized]; // curățăm codul după validare

    // 🔍 verificăm dacă userul există deja
    let user = await User.findOne({ phone: normalized });

    if (!user) {
      const email = `${normalized}@smslogin.local`;
      user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          name: `Utilizator ${normalized.slice(-4)}`,
          email,
          password: Math.random().toString(36).slice(-8),
          phone: normalized,
        });
        console.log("👤 Utilizator nou creat:", normalized);
      } else if (!user.phone) {
        user.phone = normalized;
        await user.save();
      }
    }

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

/* =======================================================
   🧾 Completare profil
======================================================= */
router.post("/complete-profile", async (req, res) => {
  try {
    const { phone, name, email } = req.body;
    const user = await User.findOneAndUpdate(
      { phone },
      { name, email },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User inexistent." });
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Eroare completare profil:", err);
    res.status(500).json({ error: "Eroare server la completarea profilului." });
  }
});

export default router;
