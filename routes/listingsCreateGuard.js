import express from "express";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";
import { findSimilarActiveListing, normalizeListingPhone } from "../utils/duplicateCheck.js";

const router = express.Router();
const COOLDOWN_DAYS = 15;

router.post("/", protect, upload.array("images", 15), async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      location,
      phone,
      email,
      intent,
      isFree,
      section,
    } = req.body;

    const finalSection = String(section || "imobiliare").trim();

    if (finalSection === "angajari") {
      return res.status(402).json({
        error: "Anunțurile de angajări se publică doar după plată (din pagina Angajări).",
        mustPay: true,
      });
    }

    if (!title || !description || !price || !category || !location || !phone) {
      return res.status(400).json({ error: "Te rugăm să completezi toate câmpurile obligatorii." });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res.status(400).json({ error: "Preț invalid. Trebuie să fie mai mare decât 0." });
    }

    const normalizedPhone = normalizeListingPhone(phone);
    const cleanTitle = String(title).trim();
    const cleanDescription = String(description).trim();
    const isFreeListing = String(isFree ?? "true") === "true";

    if (!isFreeListing) {
      return res.status(402).json({
        error: "Pentru a publica un anunț Promovat trebuie să finalizezi plata.",
        mustPay: true,
      });
    }

    const maxImages = isFreeListing ? 10 : 15;
    if (req.files && req.files.length > maxImages) {
      return res.status(400).json({ error: `Maxim ${maxImages} imagini pentru acest tip de anunț.` });
    }

    const dbUser = await User.findById(req.user._id).exec();
    if (!dbUser) {
      return res.status(401).json({ error: "Utilizator inexistent." });
    }

    if (isFreeListing) {
      const activeFree = await Listing.findOne({
        user: req.user._id,
        isFree: true,
        expiresAt: { $gt: new Date() },
        visibility: "public",
        $or: [{ section: "imobiliare" }, { section: { $exists: false } }],
      }).lean();

      if (activeFree) {
        const daysLeft = Math.ceil((new Date(activeFree.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
        return res.status(400).json({
          error:
            `Poți păstra anunțul gratuit existent (mai este valabil ~${daysLeft} zile). ` +
            `Pentru anunțuri suplimentare, salvează ca draft și plătește ca să publici.`,
          mustPay: true,
        });
      }

      if (dbUser.freeCooldownUntil && new Date(dbUser.freeCooldownUntil) > new Date()) {
        const msLeft = new Date(dbUser.freeCooldownUntil) - new Date();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        return res.status(400).json({
          error: `Poți publica un nou anunț gratuit peste ${daysLeft} zile.`,
          mustPay: true,
          cooldownUntil: dbUser.freeCooldownUntil,
        });
      }
    }

    const similar = await findSimilarActiveListing({
      userId: req.user._id,
      phone: normalizedPhone,
      title: cleanTitle,
      description: cleanDescription,
      price: numericPrice,
      category,
      location,
      section: "imobiliare",
    });

    if (similar) {
      return res.status(409).json({
        error: "Acest anunț pare foarte asemănător cu unul deja publicat. Te rugăm să editezi anunțul existent sau să modifici detaliile.",
        duplicate: true,
        existingId: similar._id,
      });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((file) => file.path || file.secure_url).filter(Boolean);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const listing = new Listing({
      user: req.user._id,
      title: cleanTitle,
      description: cleanDescription,
      price: numericPrice,
      category,
      location,
      section: "imobiliare",
      phone: normalizedPhone,
      email,
      intent,
      images: imageUrls,
      visibility: "public",
      isFree: isFreeListing,
      featured: false,
      featuredUntil: null,
      expiresAt,
    });

    listing.createdAt = listing.createdAt instanceof Date ? listing.createdAt : new Date();
    listing.updatedAt = new Date();
    await listing.save();

    if (isFreeListing) {
      dbUser.freeCooldownUntil = new Date(new Date(expiresAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      await dbUser.save();
    }

    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Anunț publicat pe OltenitaImobiliare.ro",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              <h2>Anunț publicat cu succes ✅</h2>
              <p>Anunțul tău a fost publicat pe <b>OltenitaImobiliare.ro</b>.</p>
              <p><b>Titlu:</b> ${cleanTitle}</p>
              <p><b>Localitate:</b> ${location}</p>
              <p><b>Telefon:</b> ${normalizedPhone}</p>
            </div>
          `,
        });
      }

      await sendEmail({
        to: "oltenitaimobiliare@gmail.com",
        subject: "📩 Anunț nou publicat pe OltenitaImobiliare.ro",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Anunț nou ✅</h2>
            <p><b>Titlu:</b> ${cleanTitle}</p>
            <p><b>Preț:</b> ${numericPrice}</p>
            <p><b>Categorie:</b> ${category}</p>
            <p><b>Localitate:</b> ${location}</p>
            <p><b>Telefon:</b> ${normalizedPhone}</p>
            <p><b>Email utilizator:</b> ${email || "-"}</p>
            <p><b>ID anunț:</b> ${listing._id}</p>
            <p><b>Tip:</b> ${isFreeListing ? "FREE" : "PAID"}</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("❌ Eroare trimitere email la publicare:", e?.message || e);
    }

    return res.status(201).json(listing);
  } catch (err) {
    console.error("❌ Eroare POST /api/listings guarded:", err);
    return res.status(500).json({ error: "Eroare server la adăugarea anunțului." });
  }
});

export default router;
