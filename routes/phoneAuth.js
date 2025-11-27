// src/routes/phoneAuth.js
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
   📲 Trimite OTP (login / înregistrare)
   - mode: "login"    → trebuie să EXISTE cont
   - mode: "register" → NU trebuie să existe cont
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone, mode } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, error: "Număr de telefon lipsă." });
    }

    // curățăm numărul: doar cifre, fără +4, spații etc.
    const cleanPhone = phone.replace(/[^\d]/g, "").replace(/^4/, "");

    if (!/^07\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: "Număr invalid (format corect: 07xxxxxxxx).",
      });
    }

    // mod invalid → mesaj profi, nu tehnic
    if (!mode || !["login", "register"].includes(mode)) {
      return res.status(400).json({
        success: false,
        error:
          "A apărut o problemă la autentificare. Te rugăm să reîncerci sau să creezi un cont nou.",
        mustRegister: true,
      });
    }

    console.log("📞 [send-otp] Telefon:", cleanPhone, "mode:", mode);

    // căutăm user după telefon sau email-ul generat automat
    const existingUser = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: `${cleanPhone}@smslogin.local` }],
    });

    // 🔐 La LOGIN → trebuie să existe cont
    if (mode === "login" && !existingUser) {
      return res.status(400).json({
        success: false,
        error:
          "Acest număr nu este înregistrat. Creează un cont nou pentru a continua.",
        mustRegister: true,
      });
    }

    // 🆕 La ÎNREGISTRARE → NU trebuie să existe cont
    if (mode === "register" && existingUser) {
      return res.status(400).json({
        success: false,
        error:
          "Există deja un cont creat cu acest număr de telefon. Te rugăm să mergi la pagina de autentificare.",
        mustLogin: true,
      });
    }

    // aici chiar trimitem OTP-ul prin SMSLink
    const result = await sendOtpSMS(cleanPhone);
    if (!result.success) {
      return res.status(400).json({ success: false, ...result });
    }

    console.log("📤 [send-otp] SMS trimis către:", cleanPhone);

    res.json({ success: true, message: "Codul a fost trimis prin SMS." });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({
      success: false,
      error: "Eroare server la trimiterea SMS-ului.",
    });
  }
});

/* =======================================================
   🔐 Verificare OTP + creare / autentificare user
======================================================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: "Telefon sau cod lipsă.",
      });
    }

    const cleanPhone = phone.replace(/[^\d]/g, "").replace(/^4/, "");

    const verified = await verifyOtpSMS(cleanPhone, code);
    if (!verified.success) {
      return res.status(400).json({
        success: false,
        error: "Cod incorect sau expirat.",
      });
    }

    // 🧠 Căutăm dacă există deja utilizatorul
    let user = await User.findOne({
      $or: [{ phone: cleanPhone }, { email: `${cleanPhone}@smslogin.local` }],
    });

    // Dacă nu există, îl creăm (valabil pentru fluxul de înregistrare)
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
    res.status(500).json({
      success: false,
      error: "Eroare server la verificarea OTP.",
    });
  }
});

/* =======================================================
   🧪 Test — pentru verificare rapidă
======================================================= */
router.get("/test", (_req, res) => {
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" });
});

export default router;
