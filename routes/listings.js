import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// ✅ Get toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// ✅ Adaugă un anunț nou (inclusiv userEmail)
router.post("/", async (req, res) => {
  try {
    console.log("📥 Date primite de la frontend:", req.body); // 👈 DEBUG

    const { title, description, price, category, location, images, userEmail } = req.body;

    const newListing = new Listing({
      title,
      description,
      price,
      category,
      location,
      images,
      userEmail, // 👈 forțăm salvarea
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare la salvarea anunțului:", err);
    res.status(500).json({ error: "Eroare la salvarea anunțului" });
  }
});

// ✅ Șterge un anunț după ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Listing.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    }
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

// ✅ Editează un anunț după ID
router.put("/:id", async (req, res) => {
  try {
    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

// ✅ Marchează ca rezervat / disponibil
router.patch("/:id/rezervat", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    }

    listing.rezervat = !listing.rezervat;
    await listing.save();

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la actualizarea statusului" });
  }
});

export default router;
