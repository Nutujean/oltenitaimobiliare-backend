import express from "express";
import Listing from "../models/Listing.js";
import { protect } from "../middleware/authMiddleware.js"; // folosim middleware-ul tău JWT

const router = express.Router();

/**
 * ✅ GET /api/listings
 * Listează toate anunțurile (cu filtre opționale)
 */
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.location) filter.location = req.query.location;
    if (req.query.dealType) filter.dealType = req.query.dealType;

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("Eroare la preluarea anunțurilor:", err);
    res.status(500).json({ error: "Eroare la încărcarea anunțurilor" });
  }
});

/**
 * ✅ GET /api/listings/:id
 * Obține detaliile unui anunț
 */
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });
    res.json(listing);
  } catch (err) {
    console.error("Eroare la obținerea anunțului:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

/**
 * ✅ POST /api/listings
 * Creează un anunț (doar utilizator logat)
 */
router.post("/", protect, async (req, res) => {
  try {
    const data = req.body;

    const newListing = new Listing({
      ...data,
      user: req.user._id, // asociem anunțul cu utilizatorul curent
    });

    const saved = await newListing.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Eroare la crearea anunțului:", err);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/**
 * ✅ PUT /api/listings/:id
 * Editare anunț (doar proprietarul)
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    // verificăm dacă userul logat este proprietarul
    if (listing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Nu ai dreptul să modifici acest anunț" });
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("Eroare la actualizarea anunțului:", err);
    res.status(500).json({ error: "Eroare la actualizare" });
  }
});

/**
 * ✅ DELETE /api/listings/:id
 * Ștergere anunț (doar proprietarul)
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    if (listing.user.toString() !== req.userId) {
      return res.status(403).json({ error: "Nu ai dreptul să ștergi acest anunț" });
    }

    await listing.deleteOne();
    res.json({ success: true, message: "Anunț șters cu succes" });
  } catch (err) {
    console.error("Eroare la ștergerea anunțului:", err);
    res.status(500).json({ error: "Eroare la ștergere" });
  }
});

export default router;
