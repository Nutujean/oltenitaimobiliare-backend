import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * GET /api/listings
 * Filtre (toate opționale):
 * - category: potrivire exactă, case-insensitive (ex. "Apartamente")
 * - q: căutare text în title/description (case-insensitive)
 * - location: căutare text în location (case-insensitive)
 * - price: preț maxim (<=)
 * Sortare (opțional): sort = latest | price_asc | price_desc
 */
router.get("/", async (req, res) => {
  try {
    const { category, q, location, price, sort } = req.query;
    const query = {};

    if (category) {
      query.category = { $regex: new RegExp("^" + category + "$", "i") };
    }

    if (q) {
      const rx = new RegExp(q, "i");
      query.$or = [{ title: rx }, { description: rx }];
    }

    if (location) {
      query.location = { $regex: new RegExp(location, "i") };
    }

    if (price) {
      const max = Number(price);
      if (!Number.isNaN(max)) {
        query.price = { ...(query.price || {}), $lte: max };
      }
    }

    // 🔽 sortare
    let sortObj = { createdAt: -1 }; // implicit cele mai noi
    if (sort === "price_asc") sortObj = { price: 1, createdAt: -1 };
    if (sort === "price_desc") sortObj = { price: -1, createdAt: -1 };
    if (sort === "latest") sortObj = { createdAt: -1 };

    const listings = await Listing.find(query).sort(sortObj);
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/** GET /api/listings/:id */
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/** POST /api/listings */
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

/** PUT /api/listings/:id */
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

/** DELETE /api/listings/:id */
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
