import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// ping rapid ca să verifici montarea rutei
router.get("/ping", (_req, res) => res.json({ ok: true, route: "/api/contact" }));

// transport Gmail (folosește PAROLĂ DE APLICAȚIE!)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CONTACT_EMAIL, // ex: oltenitaimobiliarea@gmail.com
    pass: process.env.CONTACT_PASS,  // parolă de aplicație, nu parola contului
  },
});

router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii." });
    }

    await transporter.sendMail({
      from: `"Formular Contact" <${process.env.CONTACT_EMAIL}>`,
      replyTo: `${name} <${email}>`,
      to: process.env.CONTACT_EMAIL, // adresa unde primești mesajele
      subject: "Mesaj nou de pe OltenitaImobiliare.ro",
      text: `Nume: ${name}\nEmail: ${email}\n\nMesaj:\n${message}`,
    });

    res.json({ ok: true, message: "Mesaj trimis cu succes!" });
  } catch (err) {
    console.error("Eroare trimitere email:", err);
    res.status(500).json({ error: "Eroare la trimiterea mesajului." });
  }
});

export default router;
