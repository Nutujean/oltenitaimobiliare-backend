// === RESEND VERIFICATION EMAIL ===
router.post("/resend-verification", async (req, res) => {
  try {
    const { email = "" } = req.body || {};
    if (!email.trim()) return res.status(400).json({ error: "Email lipsă" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: "Nu există cont cu acest email" });

    if (user.verified) {
      return res.status(200).json({ ok: true, message: "Contul este deja activ." });
    }

    // generează token nou, valabil 24h
    const token = crypto.randomBytes(32).toString("hex");
    user.verificationToken = token;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const FRONTEND =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_ORIGIN ||
      "https://oltenitaimobiliare.ro";
    const BACKEND =
      process.env.BACKEND_URL ||
      "https://oltenitaimobiliare-backend.onrender.com";

    const verifyUrl = `${BACKEND}/api/auth/verify?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Confirmă-ți contul - Oltenița Imobiliare",
      html: `<p>Bună, ${user.name}!</p>
             <p>Confirmă-ți contul apăsând pe link (valabil 24h):</p>
             <p><a href="${verifyUrl}" target="_blank">${verifyUrl}</a></p>`,
    });

    return res.json({ ok: true, message: "Email de verificare trimis din nou." });
  } catch (e) {
    console.error("resend-verification error:", e);
    res.status(500).json({ error: "Eroare la retrimiterea emailului" });
  }
});
