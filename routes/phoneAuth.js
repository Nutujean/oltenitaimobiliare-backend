// routes/phoneAuth.js
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendSms, generateOtp, hashOtp } from "../utils/smsLink.js";

const router = express.Router();

// 🔒 Limităm cererile brute-force
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// 📱 Normalizează numărul de telefon
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "4" + digits;
  if (!digits.startsWith("4")) return "4" + digits;
  return digits;
}

/* =======================================================
   🔹 Trimite OTP
======================================================= */
router.post("/send-otp", sendLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ success: false, error: "Număr de telefon lipsă." });

    const phoneNorm = normalizePhone(phone);
    const otp = generateOtp(6);
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute

    // Verificăm dacă userul există deja
    let user = await User.findOne({ phone: phoneNorm });
    if (!user) {
      user = new User({ phone: phoneNorm });
    }

    user.smsOtpHash = otpHash;
    user.smsOtpExpiresAt = expiresAt;
    user.smsOtpAttempts = 0;
    await user.save();

    // Trimitem SMS prin SMSLink
    const message = `[OltenitaImobiliare] Codul tău de verificare este ${otp}. Valabil 10 minute.`;
    await sendSms({ to: phoneNorm, message });

    console.log(`📲 OTP trimis către ${phoneNorm}: ${otp}`);
    res.json({ success: true, message: "Cod trimis cu succes", phone: phoneNorm });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ success: false, error: "Eroare la trimiterea SMS-ului" });
  }
});

/* =======================================================
   🔹 Verifică OTP + Creează token
======================================================= */
router.post("/verify-otp", verifyLimiter, async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ success: false, error: "Telefon și cod obligatorii." });

    const phoneNorm = normalizePhone(phone);
    const user = await User.findOne({ phone: phoneNorm }).select(
      "+smsOtpHash +smsOtpExpiresAt +smsOtpAttempts"
    );

    if (!user || !user.smsOtpHash || !user.smsOtpExpiresAt)
      return res.status(400).json({ success: false, error: "OTP inexistent. Trimite din nou." });

    if (new Date() > new Date(user.smsOtpExpiresAt))
      return res.status(400).json({ success: false, error: "OTP expirat. Trimite din nou." });

    if (user.smsOtpAttempts >= 5)
      return res.status(429).json({ success: false, error: "Prea multe încercări. Trimite un nou cod." });

    user.smsOtpAttempts += 1;

    const valid = user.smsOtpHash === hashOtp(code);
    if (!valid) {
      await user.save();
      return res.status(400).json({ success: false, error: "Cod incorect." });
    }

    // ✅ OTP corect → curățăm datele temporare
    user.isPhoneVerified = true;
    user.smsOtpHash = undefined;
    user.smsOtpExpiresAt = undefined;
    user.smsOtpAttempts = 0;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Verificare reușită",
      token,
      user: { id: user._id, phone: user.phone },
    });
  } catch (err) {
    console.error("❌ Eroare verify-otp:", err);
    res.status(500).json({ success: false, error: "Eroare la verificare." });
  }
});

export default router;
