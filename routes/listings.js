// routes/listings.js
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

    let sortQuery = { createdAt: -1 };
    if (sortParam === "cheapest") sortQuery = { price: 1 };
    if (sortParam === "expensive") sortQuery = { price: -1 };

    const filter = category
      ? {
          category: new RegExp(category, "i"),
          $or: [
            { featuredUntil: { $gte: now } },
            { expiresAt: { $gte: now } },
            { featuredUntil: null, expiresAt: null },
            { isFree: { $exists: false } },
          ],
        }
      : {
          $or: [
            { featuredUntil: { $gte: now } },
            { expiresAt: { $gte: now } },
            { featuredUntil: null, expiresAt: null },
            { isFree: { $exists: false } },
          ],
        };

    const listings = await Listing.find(filter).sort(sortQuery).lean();
    res.json(listings);
  } catch (e) {
    console.error("Eroare la GET /api/listings:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor" });
  }
});

/* =======================================================
   🟩 GET anunțurile utilizatorului logat
======================================================= */
router.get("/my", protect, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id || req.user.id);
    const myListings = await Listing.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (cu imagini) + trimite email
======================================================= */
router.post("/", protect, upload.array("images", 10), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const existingFree = await Listing.findOne({
      user: userId,
      isFree: true,
      expiresAt: { $gt: new Date() },
    });

    if (existingFree) {
      return res.status(403).json({
        error:
          "Ai deja un anunț gratuit activ. Poți promova sau aștepta expirarea (10 zile).",
      });
    }

    const imageUrls = req.files ? req.files.map((f) => f.path) : [];

    const newListing = new Listing({
      ...req.body,
      images: imageUrls,
      user: userId,
      isFree: true,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    await newListing.save();

    // 🔔 După ce s-a salvat anunțul, pregătim datele pentru email
    const userEmail = req.user?.email; // dacă authMiddleware pune email-ul aici
    const adminEmail = "oltenitaimobiliare@gmail.com";

    const titlu =
      req.body.title || req.body.titlu || "Anunț nou pe OltenitaImobiliare.ro";
    const locatie =
      req.body.location || req.body.localitate || req.body.city || "";
    const pret = req.body.price ? `${req.body.price} €` : "Nespecificat";
    const telefon = req.body.phone || req.body.telefon || "";

    const listingUrl = `https://oltenitaimobiliare.ro/anunt/${newListing._id}`;

    // 🧾 HTML simplu pentru email
    const adminHtml = `
      <h2>📢 Anunț nou publicat pe OltenitaImobiliare.ro</h2>
      <p><strong>Titlu:</strong> ${titlu}</p>
      <p><strong>Locație:</strong> ${locatie}</p>
      <p><strong>Preț:</strong> ${pret}</p>
      <p><strong>Telefon:</strong> ${telefon}</p>
      <p><strong>Utilizator:</strong> ${userEmail || "necunoscut"}</p>
      <p><a href="${listingUrl}" target="_blank">Vezi anunțul în site</a></p>
    `;

    const userHtml = `
      <h2>✅ Anunțul tău a fost publicat cu succes</h2>
      <p>Îți mulțumim că folosești <strong>OltenitaImobiliare.ro</strong>.</p>
      <p><strong>Titlu:</strong> ${titlu}</p>
      <p><strong>Locație:</strong> ${locatie}</p>
      <p><strong>Preț:</strong> ${pret}</p>
      <p>Anunțul tău este gratuit și va fi activ timp de 10 zile.</p>
      <p><a href="${listingUrl}" target="_blank">Vezi anunțul</a></p>
    `;

    // 📧 Email către TINE (admin)
    (async () => {
      try {
        await sendEmail({
          to: adminEmail,
          subject: "Anunț nou pe OltenitaImobiliare.ro",
          html: adminHtml,
        });
        console.log("📧 Email trimis către admin");
      } catch (err) {
        console.error("❌ Eroare trimitere email către admin:", err.message);
      }
    })();

    // 📧 Email către UTILIZATOR (dacă avem email)
    if (userEmail) {
      (async () => {
        try {
          await sendEmail({
            to: userEmail,
            subject: "Anunțul tău a fost publicat pe OltenitaImobiliare.ro",
            html: userHtml,
          });
          console.log("📧 Email trimis către utilizator");
        } catch (err) {
          console.error(
            "❌ Eroare trimitere email către utilizator:",
            err.message
          );
        }
      })();
    }

    // 🔚 Răspuns către frontend
    res.status(201).json(newListing);
  } catch (e) {
    console.error("Eroare la POST /api/listings:", e);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/* =======================================================
   🟩 PUT - Editează un anunț
======================================================= */
router.put("/:id", protect, upload.array("images", 10), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      return res
        .status(403)
        .json({ error: "Nu ai permisiunea să editezi acest anunț." });
    }

    const updatedData = { ...req.body };
    if (req.files && req.files.length > 0) {
      updatedData.images = req.files.map((f) => f.path);
    }

    Object.assign(listing, updatedData);
    await listing.save();

    res.json({ ok: true, message: "Anunț actualizat cu succes.", listing });
  } catch (e) {
    console.error("Eroare la PUT /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la editarea anunțului" });
  }
});

/* =======================================================
   🟩 DELETE - Șterge un anunț
======================================================= */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      return res
        .status(403)
        .json({ error: "Nu ai permisiunea să ștergi acest anunț." });
    }

    await listing.deleteOne();
    res.json({ ok: true, message: "Anunț șters cu succes." });
  } catch (e) {
    console.error("Eroare la DELETE /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

/* =======================================================
   🟩 Permite preflight pentru mobile (CORS)
======================================================= */
router.options("/:id", (req, res) => res.sendStatus(200));

/* =======================================================
   🟩 GET un singur anunț după ID — trebuie să fie ULTIMA
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    id = id.trim(); // 🧹 elimină spații invizibile sau newline

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }

    const listing = await Listing.findById(id).lean();
    if (!listing) {
      return res.status(404).json({ error: "Anunț inexistent" });
    }

    res.json(listing);
  } catch (e) {
    console.error("Eroare la GET /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

export default router;
