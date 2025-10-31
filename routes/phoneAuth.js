// routes/phoneAuth.js
import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";
import User from "../models/User.js";

const router = express.Router();

/* =======================================================
   ⚙️ Limitare cereri OTP — max 3/minut/IP
======================================================= */
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Prea multe cereri. Încearcă din nou peste 1 minut." },
});

/* =======================================================
   🧪 Test
======================================================= */
router.get("/test", (_req, res) =>
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" })
);

/* =======================================================
   1️⃣ Trimite OTP prin SMSLink
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Număr lipsă" });

    const result = await sendOtpSMS(phone);
    if (result.success) return res.json({ success: true });

    res.status(400).json({ error: result.error || "Eroare la trimiterea SMS-ului" });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server send-otp" });
  }
});

/* =======================================================
   2️⃣ Verificare OTP + Creare / Autentificare Utilizator
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code, name, email } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "Telefon sau cod lipsă" });

    // ✅ verificăm OTP-ul
    const result = await verifyOtpSMS(phone, code);
    if (!result.success)
      return res.status(400).json({ error: "Cod incorect sau expirat" });

    // 🔍 verificăm dacă utilizatorul există deja
    let user = await User.findOne({ phone });
    if (!user) {
      // dacă emailul e deja folosit de alt cont, îl ignorăm și generăm unul virtual
      let finalEmail = email;
      if (email) {
        const existing = await User.findOne({ email });
        if (existing) {
          console.log(`⚠️ Email deja folosit (${email}) — generăm email virtual`);
          finalEmail = `${phone}@smslogin.local`;
        }
      } else {
        finalEmail = `${phone}@smslogin.local`;
      }

      user = new User({
        name: name || `Utilizator ${phone.slice(-4)}`,
        email: finalEmail,
        password: Math.random().toString(36).slice(-8),
        phone,
      });

      await user.save();
      console.log("👤 Utilizator nou creat:", phone);
    } else {
      console.log("🔁 Utilizator existent autentificat:", phone);
    }

    // 🔑 Generăm token JWT
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error("❌ Eroare verify-otp:", err);
    res.status(500).json({ error: "Eroare server la verificarea OTP" });
  }
});

export default router;
