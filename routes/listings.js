// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const sortParam = req.query.sort || "newest";

    let sortQuery = { createdAt: -1 }; // implicit: cele mai noi
    if (sortParam === "cheapest") sortQuery = { price: 1 };
    if (sortParam === "expensive") sortQuery = { price: -1 };

    const listings = await Listing.find({
      $or: [
        { featuredUntil: { $gte: now } },
        { expiresAt: { $gte: now } },
        { featuredUntil: null, expiresAt: null },
        { isFree: { $exists: false } },
      ],
    })
      .sort(sortQuery)
      .lean();

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
    const myListings = await Listing.find({
      user: req.user._id || req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 GET un singur anunț
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id)
      .populate("user", "_id name email")
      .lean();

    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    res.json(listing);
  } catch (e) {
    console.error("Eroare la GET /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (autentificat)
======================================================= */
router.post("/", protect, async (req, res) => {
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

    const newListing = new Listing({
      ...req.body,
      user: userId,
      isFree: true,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    await newListing.save();

    // 🟢 Trimite email de notificare către admin
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.CONTACT_PASS || process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Oltenița Imobiliare",
            email: process.env.CONTACT_EMAIL,
          },
          to: [{ email: "oltenitaimobiliare@gmail.com" }],
          subject: `📢 Anunț nou: ${newListing.title}`,
          htmlContent: `
            <h3>📢 Anunț nou adăugat pe site</h3>
            <p><b>Titlu:</b> ${newListing.title}</p>
            <p><b>Categorie:</b> ${newListing.category}</p>
            <p><b>Localitate:</b> ${newListing.location}</p>
            <p><b>Preț:</b> ${newListing.price} lei</p>
            <p><b>Telefon:</b> ${newListing.phone || "nespecificat"}</p>
            <hr>
            <p><a href="https://oltenitaimobiliare.ro/detaliu/${newListing._id}" target="_blank">🔗 Vezi anunțul</a></p>
          `,
        }),
      });
      console.log("📨 Email trimis către admin: anunț nou publicat.");
    } catch (err) {
      console.error("❌ Eroare la trimiterea emailului admin:", err.message);
    }

    res.status(201).json(newListing);
  } catch (e) {
    console.error("Eroare la POST /api/listings:", e);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/* =======================================================
   🟩 PUT - Editează un anunț (doar proprietarul)
======================================================= */
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ error: "Nu ai permisiunea să editezi acest anunț." });
    }

    Object.assign(listing, req.body);
    await listing.save();

    res.json({ ok: true, message: "Anunț actualizat cu succes.", listing });
  } catch (e) {
    console.error("Eroare la PUT /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la editarea anunțului" });
  }
});

/* =======================================================
   🟩 DELETE - Șterge un anunț (doar proprietarul)
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
      return res.status(403).json({ error: "Nu ai permisiunea să ștergi acest anunț." });
    }

    await listing.deleteOne();
    res.json({ ok: true, message: "Anunț șters cu succes." });
  } catch (e) {
    console.error("Eroare la DELETE /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
