import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import sendOtpSMS, { verifyOtpSMS } from "../utils/smsLink.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* --------------------------------------------------------
   1️⃣  Trimite cod SMS — doar dacă userul EXISTĂ
   Folosește sendOtpSMS din smsLink.js
-------------------------------------------------------- */
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Telefonul este obligatoriu." });
    }

    // verificăm dacă există utilizator cu acest telefon
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "Nu ai cont. Te rugăm să te înregistrezi.",
        mustRegister: true,
      });
    }

    // trimitem codul prin sistemul centralizat smsLink
    const result = await sendOtpSMS(phone);

    if (!result.success) {
      return res.status(400).json({
        message: result.error || "Eroare la trimiterea codului prin SMS.",
      });
    }

    return res.json({ success: true, message: "Cod trimis prin SMS." });
  } catch (e) {
    console.error("❌ Eroare /auth/send-code:", e);
    return res.status(500).json({ message: "Eroare server." });
  }
});

/* --------------------------------------------------------
   2️⃣  Verifică codul — loghează userul dacă EXISTĂ
   Folosește verifyOtpSMS din smsLink.js
-------------------------------------------------------- */
router.post("/verify-code", async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ message: "Telefon și cod obligatorii." });
    }

    const verified = await verifyOtpSMS(phone, code);
    if (!verified.success) {
      return res.status(400).json({ message: "Cod invalid sau expirat." });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "Nu ai cont, trebuie să te înregistrezi.",
        mustRegister: true,
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret",
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
      },
    });
  } catch (e) {
    console.error("❌ Eroare /auth/verify-code:", e);
    return res.status(500).json({ message: "Eroare server." });
  }
});

/* --------------------------------------------------------
   3️⃣  Înregistrare utilizator (telefon + nume)
-------------------------------------------------------- */
router.post("/register", async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!phone || !name) {
      return res
        .status(400)
        .json({ message: "Numele și telefonul sunt obligatorii." });
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Telefon deja înregistrat. Autentifică-te." });
    }

    const user = await User.create({
      name,
      phone,
      password: "smslogin", // dummy, necesar pentru model
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret",
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
      },
    });
  } catch (e) {
    console.error("❌ Eroare /auth/register:", e);
    return res.status(500).json({ message: "Eroare la înregistrare." });
  }
});

export default router;
