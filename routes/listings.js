import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * 📌 GET /api/listings
 * Returnează toate anunțurile
 */
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la preluarea anunțurilor:", err.message);
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor" });
  }
});

/**
 * 📌 GET /api/listings/:id
 * Returnează un anunț după ID
 */
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit!" });
    }
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare la căutarea anunțului:", err.message);
    res.status(500).json({ error: "Eroare server la căutarea anunțului" });
  }
});

/**
 * 📌 POST /api/listings
 * Creează un anunț nou
 */
router.post("/", async (req, res) => {
  try {
    const { title, description, price, category, location, images } = req.body;

    if (!title || !description || !price || !category || !location) {
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii!" });
    }

    const listing = new Listing({
      title,
      description,
      price,
      category,
      location,
      images: images || [],
    });

    await listing.save();
    res.status(201).json({ message: "✅ Anunț adăugat cu succes!", listing });
  } catch (err) {
    console.error("❌ Eroare la salvarea anunțului:", err.message);
    res.status(500).json({ error: "Eroare server la salvarea anunțului" });
  }
});

/**
 * 📌 PUT /api/listings/:id
 * Actualizează un anunț
 */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit!" });
    }
    res.json({ message: "✅ Anunț actualizat cu succes!", updated });
  } catch (err) {
    console.error("❌ Eroare la actualizare:", err.message);
    res.status(500).json({ error: "Eroare server la actualizare" });
  }
});

/**
 * 📌 DELETE /api/listings/:id
 * Șterge un anunț
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Listing.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit!" });
    }
    res.json({ message: "✅ Anunț șters cu succes!" });
  } catch (err) {
    console.error("❌ Eroare la ștergere:", err.message);
    res.status(500).json({ error: "Eroare server la ștergere" });
  }
});

export default router;
