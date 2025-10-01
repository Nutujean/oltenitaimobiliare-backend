import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// ... sus ai importuri și router etc.

// ✅ GET toate anunțurile (cu filtru opțional după categorie)
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};

    if (category) {
      // potrivire exactă, case-insensitive (ex: "Apartamente", "Case", "Spațiu comercial")
      query.category = { $regex: new RegExp("^" + category + "$", "i") };
    }

    const listings = await Listing.find(query).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

// ✅ GET un singur anunț după ID
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu există" });
    }
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});


// ✅ POST adăugare anunț nou
router.post("/", async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare POST /listings:", err);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});


// ✅ PUT actualizare anunț
router.put("/:id", async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedListing) {
      return res.status(404).json({ error: "Anunțul nu există" });
    }
    res.json(updatedListing);
  } catch (err) {
    console.error("❌ Eroare PUT /listings/:id:", err);
    res.status(500).json({ error: "Eroare la actualizarea anunțului" });
  }
});


// ✅ DELETE ștergere anunț
router.delete("/:id", async (req, res) => {
  try {
    const deletedListing = await Listing.findByIdAndDelete(req.params.id);
    if (!deletedListing) {
      return res.status(404).json({ error: "Anunțul nu există" });
    }
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    console.error("❌ Eroare DELETE /listings/:id:", err);
    res.status(500).json({ error: "Eroare la ștergerea anunțului" });
  }
});

export default router;
