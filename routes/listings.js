import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🟩 GET toate anunțurile (public)
======================================================= */
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find()
      .sort({ createdAt: -1 })
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
router.get("/my", auth, async (req, res) => {
  try {
    const myListings = await Listing.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(myListings);
  } catch (e) {
    console.error("Eroare la GET /api/listings/my:", e);
    res.status(500).json({ error: "Eroare server la anunțurile mele" });
  }
});

/* =======================================================
   🟩 GET un singur anunț (cu user populat)
======================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id)
      .populate("user", "_id name email") // 🔹 Populăm user-ul proprietar
      .lean();

    if (!listing) {
      return res.status(404).json({ error: "Anunț inexistent" });
    }

    res.json(listing);
  } catch (e) {
    console.error("Eroare la GET /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

/* =======================================================
   🟩 POST - Adaugă un nou anunț (autentificat)
======================================================= */
router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      location,
      images,
      phone,
      dealType,
      surface,
      rooms,
      floor,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Titlu și preț obligatorii" });
    }

    const newListing = new Listing({
      title,
      description,
      price,
      category,
      location,
      images: images || [],
      phone,
      dealType,
      surface,
      rooms,
      floor,
      user: req.user.id,
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (e) {
    console.error("Eroare la POST /api/listings:", e);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/* =======================================================
   🟩 PUT - Editează un anunț (doar proprietarul)
======================================================= */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user.id)) {
      return res.status(403).json({ error: "Nu ai dreptul să editezi acest anunț" });
    }

    Object.assign(listing, req.body);
    await listing.save();

    res.json(listing);
  } catch (e) {
    console.error("Eroare la PUT /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la editarea anunțului" });
  }
});

/* =======================================================
   🟩 DELETE - Șterge un anunț (doar proprietarul)
======================================================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (String(listing.user) !== String(req.user.id)) {
      return res.status(403).json({ error: "Nu ai dreptul să ștergi acest anunț" });
    }

    await listing.deleteOne();
    res.json({ ok: true, message: "Anunț șters cu succes" });
  } catch (e) {
    console.error("Eroare la DELETE /api/listings/:id:", e);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
