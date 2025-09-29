import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// ✅ Toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// ✅ Anunțurile unui user (trebuie să fie deasupra lui /:id!)
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

// ✅ Un singur anunț după ID (pentru DetaliuAnunt.jsx)
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

// ✅ Adaugă un anunț nou
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      location,
      images,
      userEmail,
    } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "Emailul utilizatorului este necesar" });
    }

    const newListing = new Listing({
      title,
      description,
      price,
      category,
      location,
      images,
      userEmail,
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    res.status(500).json({ error: "Eroare la salvarea anunțului" });
  }
});

// ✅ Șterge un anunț
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

// ✅ Editează un anunț
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

// ✅ Marchează / demarchează rezervat
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
