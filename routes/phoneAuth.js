import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";

const router = express.Router();

// 🔹 Limităm cererile (max. 3 pe minut / IP)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Prea multe cereri. Încearcă peste 1 minut." },
});

/* =======================================================
   📤 1️⃣ Trimitere OTP pentru înregistrare
======================================================= */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Telefon lipsă." });

    const result = await sendOtpSMS(phone);
    if (!result.success) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: "Cod OTP trimis cu succes!" });
  } catch (err) {
    console.error("❌ Eroare send-otp:", err);
    res.status(500).json({ error: "Eroare server la trimiterea OTP." });
  }
});

/* =======================================================
   🧾 2️⃣ Înregistrare nouă (cu email + nume + telefon)
======================================================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, code } = req.body;

    if (!name || !email || !phone || !code)
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii." });

    const verified = await verifyOtpSMS(phone, code);
    if (!verified.success)
      return res.status(400).json({ error: "Cod invalid sau expirat." });

    // verificăm dacă există deja contul
    let existing = await User.findOne({ phone });
    if (existing)
      return res.status(400).json({ error: "Numărul de telefon este deja înregistrat." });

    const user = new User({
      name,
      email,
      phone,
      password: Math.random().toString(36).slice(-8),
    });
    await user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error("❌ Eroare înregistrare:", err);
    res.status(500).json({ error: "Eroare server la înregistrare." });
  }
});

/* =======================================================
   🔑 3️⃣ Logare simplă prin SMS OTP
======================================================= */
router.post("/login", async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code)
      return res.status(400).json({ error: "Telefon și cod OTP necesare." });

    const verified = await verifyOtpSMS(phone, code);
    if (!verified.success)
      return res.status(400).json({ error: "Cod invalid sau expirat." });

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ error: "Nu există cont pentru acest număr." });

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error("❌ Eroare login:", err);
    res.status(500).json({ error: "Eroare server la logare." });
  }
});

/* =======================================================
   🧪 Test
======================================================= */
router.get("/test", (_req, res) =>
  res.json({ success: true, message: "Ruta /api/phone funcționează 🎯" })
);

export default router;
