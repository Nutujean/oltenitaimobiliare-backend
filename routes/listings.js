// backend/src/routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const sortParam = req.query.sort || "newest";
    const category = req.query.category;
    const location = req.query.location;
    const intent = req.query.intent;
    const q = req.query.q;

    let sortQuery = { createdAt: -1 };
    if (sortParam === "cheapest") sortQuery = { price: 1 };
    if (sortParam === "expensive") sortQuery = { price: -1 };
    if (sortParam === "oldest") sortQuery = { createdAt: 1 };

    const baseFilter = {
      $or: [
        { featuredUntil: { $gte: now } },
        { expiresAt: { $gte: now } },
        { featuredUntil: null, expiresAt: null },
        { isFree: { $exists: false } },
      ],
    };

    const filter = { ...baseFilter };
    if (category) filter.category = category;
    if (location) filter.location = location;
    if (intent) filter.intent = intent;

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const listings = await Listing.find(filter).sort(sortQuery).lean().exec();
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings:", err);
    res
      .status(500)
      .json({ error: "Eroare server la încărcarea anunțurilor." });
  }
});

/* =======================================================
   🟦 GET anunțurile mele (autentificat)
======================================================= */
router.get("/mine", protect, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings/mine:", err);
    res
      .status(500)
      .json({ error: "Eroare server la încărcarea anunțurilor tale." });
  }
});

/* =======================================================
   🟦 GET un singur anunț după ID (public)
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "ID invalid." });
    }

    const listing = await Listing.findById(id).lean().exec();
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit." });
    }

    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings/:id:", err);
    res.status(500).json({ error: "Eroare server la încărcarea anunțului." });
  }
});

/* =======================================================
   🟧 POST creare anunț nou (autentificat)
   - primește FormData cu "images"
   - limitează un singur anunț gratuit activ / user
======================================================= */
router.post("/", protect, upload.array("images", 10), async (req, res) => {
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
    } = req.body;

    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !location ||
      !phone
    ) {
      return res.status(400).json({
        error: "Te rugăm să completezi toate câmpurile obligatorii.",
      });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res
        .status(400)
        .json({ error: "Preț invalid. Trebuie să fie mai mare decât 0." });
    }

    const now = new Date();
    const existingFree = await Listing.findOne({
      user: req.user._id,
      isFree: true,
      $or: [{ expiresAt: { $gte: now } }, { expiresAt: null }],
    }).exec();

    if (existingFree) {
      return res.status(400).json({
        error:
          "Ai deja un anunț gratuit activ. Pentru a publica încă un anunț, acesta trebuie să fie promovat (plătit).",
        mustPay: true,
        message:
          "Ai deja un anunț gratuit activ. Pentru a publica încă un anunț, te rugăm să alegi opțiunea de promovare.",
      });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((file) => file.path || file.secure_url);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const listing = new Listing({
      user: req.user._id,
      title,
      description,
      price: numericPrice,
      category,
      location,
      phone,
      email,
      intent,
      images: imageUrls,
      isFree: true,
      featured: false,
      featuredUntil: null,
      expiresAt,
    });

    await listing.save();

    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Anunțul tău a fost publicat pe OltenitaImobiliare.ro",
          html: `
            <p>Bună,</p>
            <p>Anunțul tău <strong>${title}</strong> a fost publicat cu succes pe <a href="https://oltenitaimobiliare.ro" target="_blank">OltenitaImobiliare.ro</a>.</p>
            <p>Îți mulțumim că folosești platforma noastră!</p>
          `,
        });
      }

      await sendEmail({
        to: process.env.ADMIN_EMAIL || "oltenitaimobiliare@gmail.com",
        subject: "Anunț nou publicat",
        html: `
          <p>A fost publicat un anunț nou:</p>
          <ul>
            <li><strong>Titlu:</strong> ${title}</li>
            <li><strong>Preț:</strong> ${numericPrice} €</li>
            <li><strong>Localitate:</strong> ${location}</li>
            <li><strong>Telefon:</strong> ${phone}</li>
            <li><strong>Email:</strong> ${email || "-"}</li>
          </ul>
        `,
      });
    } catch (mailErr) {
      console.error("❌ Eroare la trimiterea email-urilor:", mailErr);
    }

    res.status(201).json(listing);
  } catch (err) {
    console.error("❌ Eroare POST /api/listings:", err);
    res
      .status(500)
      .json({ error: "Eroare server la adăugarea anunțului." });
  }
});

/* =======================================================
   🟧 PUT actualizare anunț
======================================================= */
router.put("/:id", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "ID invalid." });
    }

    const listing = await Listing.findById(id).exec();
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit." });
    }

    if (listing.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Nu ai dreptul să modifici acest anunț." });
    }

    const {
      title,
      description,
      price,
      category,
      location,
      phone,
      email,
      intent,
    } = req.body;

    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (price !== undefined) listing.price = Number(price);
    if (category !== undefined) listing.category = category;
    if (location !== undefined) listing.location = location;
    if (phone !== undefined) listing.phone = phone;
    if (email !== undefined) listing.email = email;
    if (intent !== undefined) listing.intent = intent;

    if (req.files && req.files.length > 0) {
      listing.images = req.files.map((file) => file.path || file.secure_url);
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare PUT /api/listings/:id:", err);
    res
      .status(500)
      .json({ error: "Eroare server la actualizarea anunțului." });
  }
});

/* =======================================================
   🟥 DELETE ștergere anunț
======================================================= */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "ID invalid." });
    }

    const listing = await Listing.findById(id).exec();
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit." });
    }

    if (listing.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Nu ai dreptul să ștergi acest anunț." });
    }

    await listing.deleteOne();
    res.json({ success: true, message: "Anunț șters cu succes." });
  } catch (err) {
    console.error("❌ Eroare DELETE /api/listings/:id:", err);
    res
      .status(500)
      .json({ error: "Eroare server la ștergerea anunțului." });
  }
});

export default router;
