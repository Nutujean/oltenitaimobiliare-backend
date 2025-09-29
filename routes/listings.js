import express from "express";
import Listing from "../models/Listing.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/* ================================
   GET toate anunțurile
================================ */
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/* ================================
   GET anunțurile unui user
================================ */
router.get("/user/:email", async (req, res) => {
  try {
    const listings = await Listing.find({ userEmail: req.params.email });
    res.json(listings);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Eroare la preluarea anunțurilor utilizatorului" });
  }
});

/* ================================
   GET un anunț după ID
================================ */
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/* ================================
   POST creare anunț nou
================================ */
router.post("/", verifyToken, async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la crearea anunțului" });
  }
});

/* ================================
   PUT actualizare anunț
   - editează text + imagini (max 15)
================================ */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { title, description, price, category, location, images } = req.body;

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    listing.title = title || listing.title;
    listing.description = description || listing.description;
    listing.price = price || listing.price;
    listing.category = category || listing.category;
    listing.location = location || listing.location;

    if (images && Array.isArray(images)) {
      if (images.length > 15) {
        return res
          .status(400)
          .json({ error: "Poți avea maxim 15 imagini la un anunț" });
      }
      listing.images = images;
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

/* ================================
   DELETE ștergere anunț
================================ */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

/* ================================
   PATCH marchează / scoate rezervat
================================ */
router.patch("/:id/rezervat", verifyToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    listing.rezervat = !listing.rezervat;
    await listing.save();

    res.json({ rezervat: listing.rezervat });
  } catch (err) {
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});

export default router;
