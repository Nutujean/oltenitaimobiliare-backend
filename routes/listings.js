// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// 🔧 helper normalizare telefon (doar cifre, scoatem 4 din față dacă e 407..)
const normalizePhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  return digits.replace(/^4/, ""); // 4072... -> 072...
};

/* =======================================================
   🟩 GET toate anunțurile (public)
   - promovatele primele
   - activele înaintea celor expirate
   - expiratele rămân jos
======================================================= */
router.get("/", async (req, res) => {
  try {
    const sortParam = req.query.sort || "newest";
    const category = (req.query.category || "").trim();
    const location = (req.query.location || "").trim();
    const intent = (req.query.intent || "").trim();
    const q = (req.query.q || "").trim();

    // 🔥 sortare: ACTIVE + PROMOVATE primele
    let sortQuery = {
      status: 1,          // disponibil < expirat
      featured: -1,
      featuredUntil: -1,
      createdAt: -1,
    };

    if (sortParam === "cheapest") {
      sortQuery = { status: 1, featured: -1, price: 1, createdAt: -1 };
    }
    if (sortParam === "expensive") {
      sortQuery = { status: 1, featured: -1, price: -1, createdAt: -1 };
    }
    if (sortParam === "oldest") {
      sortQuery = { status: 1, featured: -1, createdAt: 1 };
    }

    const and = [];
    if (category) and.push({ category });
    if (location) and.push({ location });
    if (intent) and.push({ intent });

    if (q) {
      and.push({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
          { location: { $regex: q, $options: "i" } },
        ],
      });
    }

    const filter = and.length ? { $and: and } : {};

    const listings = await Listing.find(filter)
      .sort(sortQuery)
      .lean()
      .exec();

    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings:", err);
    res.status(500).json({ error: "Eroare server." });
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
    res.status(500).json({ error: "Eroare server la încărcarea anunțurilor tale." });
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

    return res.json(listing);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings/:id:", err);
    return res.status(500).json({ error: "Eroare server la încărcarea anunțului." });
  }
});

/* =======================================================
   🟧 POST creare anunț nou (autentificat)
   - primește FormData cu "images"
   - limitează: un singur anunț gratuit / număr (inclusiv cele vechi fără isFree)
   - expirare: ✅ 15 zile
   - trimite email: user (dacă are email) + admin
======================================================= */
router.post("/", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, price, category, location, phone, email, intent } = req.body;

    if (!title || !description || !price || !category || !location || !phone) {
      return res.status(400).json({ error: "Te rugăm să completezi toate câmpurile obligatorii." });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res.status(400).json({ error: "Preț invalid. Trebuie să fie mai mare decât 0." });
    }

    const normalizedPhone = normalizePhone(phone);
const COOLDOWN_DAYS = 7; // setezi tu (7/14/30)

const dbUser = await User.findById(req.user._id).exec();
if (!dbUser) {
  return res.status(401).json({ error: "Utilizator inexistent." });
}

// ✅ dacă e în cooldown → blochează FREE
if (dbUser.freeCooldownUntil && new Date(dbUser.freeCooldownUntil) > new Date()) {
  const msLeft = new Date(dbUser.freeCooldownUntil) - new Date();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return res.status(400).json({
    error: `Poți publica un nou anunț gratuit peste ${daysLeft} zile.`,
    mustPay: true,
    cooldownUntil: dbUser.freeCooldownUntil,
  });
}

    // ✅ REGULA OLX: un singur anunț gratuit ACTIV / cont
const activeFree = await Listing.findOne({
  user: req.user._id,
  isFree: true,
  expiresAt: { $gt: new Date() },
}).lean();

if (activeFree) {
  const daysLeft = Math.ceil(
    (new Date(activeFree.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
  );
  return res.status(400).json({
    error:
      `Poți păstra anunțul gratuit existent (mai este valabil ~${daysLeft} zile). ` +
      `Pentru anunțuri suplimentare, promovează unul dintre anunțurile tale sau așteaptă expirarea.`,
    mustPay: true,
  });
}

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((file) => file.path || file.secure_url);
    }

    // ✅ expirare la 15 zile
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15);

    const listing = new Listing({
      user: req.user._id,
      title,
      description,
      price: numericPrice,
      category,
      location,
      phone: normalizedPhone,
      email,
      intent,
      images: imageUrls,
      isFree: true,
      featured: false,
      featuredUntil: null,
      expiresAt,
    });

    await listing.save();
// ✅ pornește cooldown după publicarea unui FREE
const COOLDOWN_DAYS = 15;
dbUser.freeCooldownUntil = new Date(
  new Date(expiresAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
);
await dbUser.save();


    // ✅ EMAILURI (user + admin)
    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Anunț publicat pe OltenitaImobiliare.ro",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              <h2>Anunț publicat cu succes ✅</h2>
              <p>Anunțul tău a fost publicat pe <b>OltenitaImobiliare.ro</b>.</p>
              <p><b>Titlu:</b> ${title}</p>
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
            <p><b>Titlu:</b> ${title}</p>
            <p><b>Preț:</b> ${numericPrice}</p>
            <p><b>Categorie:</b> ${category}</p>
            <p><b>Localitate:</b> ${location}</p>
            <p><b>Telefon:</b> ${normalizedPhone}</p>
            <p><b>Email utilizator:</b> ${email || "-"}</p>
            <p><b>ID anunț:</b> ${listing._id}</p>
          </div>
        `,
      });

      console.log("✅ Emailuri trimise (user/admin) pentru anunț:", listing._id);
    } catch (e) {
      console.error("❌ Eroare trimitere email la publicare:", e?.message || e);
    }

    res.status(201).json(listing);
  } catch (err) {
    console.error("❌ Eroare POST /api/listings:", err);
    res.status(500).json({ error: "Eroare server la adăugarea anunțului." });
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

    if (listing.user && listing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Nu ai dreptul să modifici acest anunț." });
    }

    const { title, description, price, category, location, phone, email, intent } = req.body;

    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (price !== undefined) listing.price = Number(price);
    if (category !== undefined) listing.category = category;
    if (location !== undefined) listing.location = location;
    if (phone !== undefined) listing.phone = normalizePhone(phone);
    if (email !== undefined) listing.email = email;
    if (intent !== undefined) listing.intent = intent;

    if (req.files && req.files.length > 0) {
      listing.images = req.files.map((file) => file.path || file.secure_url);
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare PUT /api/listings/:id:", err);
    res.status(500).json({ error: "Eroare server la actualizarea anunțului." });
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

    if (listing.user && listing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Nu ai dreptul să ștergi acest anunț." });
    }

    await listing.deleteOne();
    res.json({ success: true, message: "Anunț șters cu succes." });
  } catch (err) {
    console.error("❌ Eroare DELETE /api/listings/:id:", err);
    res.status(500).json({ error: "Eroare server la ștergerea anunțului." });
  }
});

export default router;
