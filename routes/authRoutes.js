import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendSMS } from "../utils/sendSMS.js"; // tu ai deja
import bcrypt from "bcryptjs";

const router = express.Router();

// memorie temporară pentru coduri
const codes = {}; // { telefon: cod }

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* --------------------------------------------------------
   1️⃣  Trimite cod SMS — doar dacă userul EXISTĂ
-------------------------------------------------------- */
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Telefonul este obligatoriu." });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "Nu ai cont. Te rugăm să te înregistrezi.",
        mustRegister: true
      });
    }

    const code = generateCode();
    codes[phone] = code;

    await sendSMS(phone, `Codul tău de autentificare este ${code}`);

    return res.json({ success: true, message: "Cod trimis prin SMS." });
  } catch (e) {
    return res.status(500).json({ message: "Eroare server." });
  }
});

/* --------------------------------------------------------
   2️⃣  Verifică codul — loghează userul dacă EXISTĂ
-------------------------------------------------------- */
router.post("/verify-code", async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!codes[phone] || codes[phone] !== code) {
      return res.status(400).json({ message: "Cod invalid." });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: "Nu ai cont, trebuie să te înregistrezi.",
        mustRegister: true
      });
    }

    delete codes[phone]; // ștergere cod după folosire

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone
      }
    });
  } catch (e) {
    return res.status(500).json({ message: "Eroare server." });
  }
});

/* --------------------------------------------------------
   3️⃣  Înregistrare utilizator (telefon + nume)
-------------------------------------------------------- */
router.post("/register", async (req, res) => {
  try {
    const { name, phone } = req.body;

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: "Telefon deja înregistrat." });
    }

    const user = await User.create({
      name,
      phone,
      password: "smslogin" // dummy, dar necesar pentru model
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone
      }
    });
  } catch (e) {
    return res.status(500).json({ message: "Eroare la înregistrare." });
  }
});

export default router;
