// routes/contactRoutes.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Toate câmpurile sunt obligatorii." });
  }

  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Cheia Brevo lipsește din configurare." });
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Oltenița Imobiliare", email: "noreply@oltenitaimobiliare.ro" },
        to: [{ email: "oltenitaimobiliare@gmail.com", name: "Oltenița Imobiliare" }],
        subject: `Mesaj nou de la ${name}`,
        htmlContent: `
          <h2>📬 Mesaj nou de pe site</h2>
          <p><strong>Nume:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Mesaj:</strong></p>
          <p>${message}</p>
        `,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Brevo API error:", text);
      return res.status(500).json({ error: "Eroare la trimiterea emailului." });
    }

    res.json({ ok: true, message: "Email trimis cu succes!" });
  } catch (err) {
    console.error("Eroare trimitere email:", err);
    res.status(500).json({ error: "Eroare internă la trimiterea mesajului." });
  }
});

export default router;
