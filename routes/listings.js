// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// ✅ CONFIG OLX-like
// - FREE: 1 activ / cont + cooldown după expirare
// - PAID: nelimitat
const COOLDOWN_DAYS = 15;

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
   - ✅ EXCLUDE drafturile (visibility="draft")
======================================================= */
router.get("/", async (req, res) => {
  try {
    const sortParam = req.query.sort || "newest";
    const category = (req.query.category || "").trim();
    const location = (req.query.location || "").trim();
    const intent = (req.query.intent || "").trim();
    const q = (req.query.q || "").trim();
    const section = (req.query.section || "").trim();

    // 🔥 sortare: ACTIVE + PROMOVATE primele
    let sortQuery = {
      status: 1,
      featured: -1,
      updatedAt: -1, // ✅ urcă sus când se publică după plată
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
    and.push({
      $or: [
        { visibility: "public" },
        { visibility: { $exists: false } }, // ✅ anunțurile vechi
      ],
    });

    // ✅ separare: implicit arătăm DOAR imobiliare (și cele vechi fără section)
    if (section) {
      and.push({ section }); // ex: section=angajari
    } else {
      and.push({
        $or: [{ section: "imobiliare" }, { section: { $exists: false } }],
      });
    }

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
    const now = new Date();

// ✅ curățăm promovările expirate
await Listing.updateMany(
  { featured: true, featuredUntil: { $lte: now } },
  { $set: { featured: false, featuredUntil: null } }
).exec();

// ✅ apoi citim lista
const listings = await Listing.find(filter).sort(sortQuery).lean().exec();
return res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings:", err);
    res.status(500).json({ error: "Eroare server." });
  }
});

/* =======================================================
   🟦 GET anunțurile mele (autentificat)
   - ✅ include și drafturi (pentru că sunt ale userului)
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

    return res.json(listing);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings/:id:", err);
    return res
      .status(500)
      .json({ error: "Eroare server la încărcarea anunțului." });
  }
});

/* =======================================================
   🟧 POST creare anunț nou (autentificat) - PUBLIC
   - primește FormData cu "images"
   - FREE: 1 anunț gratuit activ / cont + cooldown după expirare
   - PAID (isFree=false): 🔒 blocat până legăm plata (402)
   - ❗️ANGAJARI: NU se publică aici (doar draft+plată)
======================================================= */
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

    // 🔒 Joburile NU se publică direct pe /api/listings
    if (finalSection === "angajari") {
      return res.status(402).json({
        error:
          "Anunțurile de angajări se publică doar după plată (din pagina Angajări).",
        mustPay: true,
      });
    }

    if (!title || !description || !price || !category || !location || !phone) {
      return res
        .status(400)
        .json({ error: "Te rugăm să completezi toate câmpurile obligatorii." });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res
        .status(400)
        .json({ error: "Preț invalid. Trebuie să fie mai mare decât 0." });
    }

    const normalizedPhone = normalizePhone(phone);

    // ✅ stabilim tipul anunțului: FREE vs PAID (default: FREE)
    const isFreeListing = String(isFree ?? "true") === "true";

    // 🔒 IMPORTANT: nu permitem creare PAID fără plată confirmată
    if (!isFreeListing) {
      return res.status(402).json({
        error: "Pentru a publica un anunț Promovat trebuie să finalizezi plata.",
        mustPay: true,
      });
    }

    // ✅ limită imagini în funcție de tip (FREE 10 / PAID 15)
    const maxImages = isFreeListing ? 10 : 15;
    if (req.files && req.files.length > maxImages) {
      return res.status(400).json({
        error: `Maxim ${maxImages} imagini pentru acest tip de anunț.`,
      });
    }

    // user din DB (pentru cooldown)
    const dbUser = await User.findById(req.user._id).exec();
    if (!dbUser) {
      return res.status(401).json({ error: "Utilizator inexistent." });
    }

    // ✅ Limitare + cooldown DOAR pentru anunțuri GRATUITE IMOBILIARE
    if (isFreeListing) {
      // ✅ 1 anunț gratuit ACTIV / cont (DOAR imobiliare + vechi fără section)
      const activeFree = await Listing.findOne({
        user: req.user._id,
        isFree: true,
        expiresAt: { $gt: new Date() },
        visibility: "public",
        $or: [{ section: "imobiliare" }, { section: { $exists: false } }],
      }).lean();

      if (activeFree) {
        const daysLeft = Math.ceil(
          (new Date(activeFree.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
        );
        return res.status(400).json({
          error:
            `Poți păstra anunțul gratuit existent (mai este valabil ~${daysLeft} zile). ` +
            `Pentru anunțuri suplimentare, salvează ca draft și plătește ca să publici.`,
          mustPay: true,
        });
      }

      // ✅ cooldown după expirare (tot pentru imobiliare)
      if (
        dbUser.freeCooldownUntil &&
        new Date(dbUser.freeCooldownUntil) > new Date()
      ) {
        const msLeft = new Date(dbUser.freeCooldownUntil) - new Date();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        return res.status(400).json({
          error: `Poți publica un nou anunț gratuit peste ${daysLeft} zile.`,
          mustPay: true,
          cooldownUntil: dbUser.freeCooldownUntil,
        });
      }
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
      section: "imobiliare", // ✅ FIX
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

    await listing.save();

    // ✅ dacă e FREE, setăm cooldown = expiresAt + COOLDOWN_DAYS
    if (isFreeListing) {
      dbUser.freeCooldownUntil = new Date(
        new Date(expiresAt).getTime() +
          COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      );
      await dbUser.save();
    }

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
            <p><b>Tip:</b> ${isFreeListing ? "FREE" : "PAID"}</p>
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
   🟨 POST salvare DRAFT (autentificat)
======================================================= */
router.post("/draft", protect, upload.array("images", 15), async (req, res) => {
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
      section,
    } = req.body;

    if (!title || !description || !price || !category || !location || !phone) {
      return res
        .status(400)
        .json({ error: "Completează toate câmpurile obligatorii." });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res.status(400).json({ error: "Preț invalid." });
    }

    const normalizedPhone = normalizePhone(phone);

    // limită draft: max 15
    if (req.files && req.files.length > 15) {
      return res.status(400).json({ error: "Maxim 15 imagini pentru draft." });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((file) => file.path || file.secure_url);
    }

    const draft = new Listing({
      user: req.user._id,
      title,
      description,
      price: numericPrice,
      category,
      location,
      section: section === "angajari" ? "angajari" : "imobiliare",
      phone: normalizedPhone,
      email,
      intent,
      images: imageUrls,

      visibility: "draft",
      isFree: false,
      expiresAt: null,

      featured: false,
      featuredUntil: null,
      status: "disponibil",
    });

    await draft.save();

    return res.status(201).json({
      ok: true,
      draftId: draft._id,
      message: "Draft salvat.",
    });
  } catch (err) {
    console.error("❌ Eroare POST /api/listings/draft:", err);
    return res.status(500).json({ error: "Eroare server la salvarea draftului." });
  }
});

/* =======================================================
   🟧 PUT actualizare anunț
======================================================= */
router.put("/:id", protect, upload.array("images", 15), async (req, res) => {
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

    const { title, description, price, category, location, phone, email, intent, type } =
      req.body;

    const finalIntent = type ?? intent;

    const t = String(title ?? listing.title ?? "").trim();
    const c = String(category ?? listing.category ?? "").trim();
    const loc = String(location ?? listing.location ?? "").trim();
    const ph = normalizePhone(phone ?? listing.phone ?? "");
    const it = String(finalIntent ?? listing.intent ?? "").trim();

    if (!t || !c || !loc || !ph || !it) {
      return res.status(400).json({
        error:
          "Completează obligatoriu: Titlu, Categorie, Tip (Vând/Cumpăr/Închiriez/Schimb), Localitate, Telefon.",
      });
    }

    if (ph.length < 9) {
      return res.status(400).json({ error: "Număr de telefon invalid." });
    }

    const maxImages = listing.isFree ? 10 : 15;

    const existingImagesRaw = req.body.existingImages ?? [];
    const existingImages = Array.isArray(existingImagesRaw)
      ? existingImagesRaw.filter(Boolean)
      : [existingImagesRaw].filter(Boolean);

    const uploadedCount = (req.files || []).length;
    const total = existingImages.length + uploadedCount;

    if (total > maxImages) {
      return res.status(400).json({
        error: `Maxim ${maxImages} imagini pentru acest tip de anunț.`,
      });
    }

    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (price !== undefined) listing.price = Number(price);
    if (category !== undefined) listing.category = category;
    if (location !== undefined) listing.location = location;
    if (phone !== undefined) listing.phone = ph;
    if (email !== undefined) listing.email = email;
    if (finalIntent !== undefined) listing.intent = finalIntent;

    const existing = [].concat(req.body.existingImages || []).filter(Boolean);
    const existingImages2 = Array.isArray(existing) ? existing : [existing];

    const uploadedImages = (req.files || [])
      .map((file) => file.path || file.secure_url)
      .filter(Boolean);

    const combined = [...existingImages2, ...uploadedImages];
    if (combined.length > 0) {
      listing.images = combined;
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare PUT /api/listings/:id:", err);
    res.status(500).json({ error: "Eroare server la actualizarea anunțului." });
  }
});

/* =======================================================
   🟩 PUT publicare DRAFT după plată (manual)
======================================================= */
router.put("/:id/publish", protect, async (req, res) => {
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
      return res
        .status(403)
        .json({ error: "Nu ai dreptul să publici acest anunț." });
    }

    if (listing.visibility !== "draft") {
      return res.status(400).json({ error: "Acest anunț nu este draft." });
    }

    listing.visibility = "public";
    listing.isFree = false;

    // ✅ expirare 30 zile
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    listing.expiresAt = expiresAt;

    // ✅ dacă e job, îl lăsăm job; dacă nu, îl setăm imobiliare
    if (!listing.section) listing.section = "imobiliare";

    if (!listing.status) listing.status = "disponibil";

    await listing.save();

    // ✅ EMAILURI (user + admin) și la publicarea după plată
    try {
      if (listing.email) {
        await sendEmail({
          to: listing.email,
          subject: "Anunț publicat pe OltenitaImobiliare.ro",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              <h2>Anunț publicat cu succes ✅</h2>
              <p>Anunțul tău a fost publicat pe <b>OltenitaImobiliare.ro</b>.</p>
              <p><b>Titlu:</b> ${listing.title}</p>
              <p><b>Localitate:</b> ${listing.location}</p>
              <p><b>Telefon:</b> ${listing.phone}</p>
            </div>
          `,
        });
      }

      await sendEmail({
        to: "oltenitaimobiliare@gmail.com",
        subject:
          "💳 Anunț publicat după plată (Promovat) - OltenitaImobiliare.ro",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Anunț publicat după plată ✅</h2>
            <p><b>Titlu:</b> ${listing.title}</p>
            <p><b>Preț:</b> ${listing.price}</p>
            <p><b>Categorie:</b> ${listing.category}</p>
            <p><b>Localitate:</b> ${listing.location}</p>
            <p><b>Telefon:</b> ${listing.phone}</p>
            <p><b>Email utilizator:</b> ${listing.email || "-"}</p>
            <p><b>ID anunț:</b> ${listing._id}</p>
            <p><b>Tip:</b> PAID / PROMOVAT</p>
          </div>
        `,
      });

      console.log(
        "✅ Emailuri trimise (publish paid) pentru anunț:",
        listing._id
      );
    } catch (e) {
      console.error("❌ Eroare trimitere email la publish:", e?.message || e);
    }

    return res.json({ ok: true, listing });
  } catch (err) {
    console.error("❌ Eroare PUT /api/listings/:id/publish:", err);
    return res.status(500).json({ error: "Eroare server la publicare." });
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