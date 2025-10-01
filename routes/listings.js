// routes/listings.js
import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * GET /api/listings
 * Filtre suportate (toate opționale):
 *  - category (potrivire exactă, case-insensitive)
 *  - q (căutare în title/description, case-insensitive)
 *  - location (potrivire exactă, case-insensitive)
 *  - price (preț maxim, <=)
 *  - sort: latest | oldest | price_asc | price_desc
 *
 * Notă: FĂRĂ populate ca să nu riscăm 500. contactPhone = listing.phone.
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
      query.location = { $regex: new RegExp("^" + location + "$", "i") };
    }
    if (price) {
      const max = Number(price);
      if (!Number.isNaN(max)) {
        query.price = { ...(query.price || {}), $lte: max };
      }
    }

    let sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    if (sort === "price_asc") sortObj = { price: 1, createdAt: -1 };
    if (sort === "price_desc") sortObj = { price: -1, createdAt: -1 };

    const docs = await Listing.find(query).sort(sortObj).lean();

    // contactPhone = phone din anunț (fără populate/owner)
    const data = docs.map((o) => ({
      ...o,
      contactPhone: o.phone || null,
    }));

    return res.json(data);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    return res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/**
 * GET /api/listings/:id
 * FĂRĂ populate; contactPhone = listing.phone
 */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Listing.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Anunțul nu există" });

    const data = { ...doc, contactPhone: doc.phone || null };
    return res.json(data);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    return res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/** (opțional) debug simplu: câte anunțuri sunt */
router.get("/__debug", async (req, res) => {
  try {
    const count = await Listing.countDocuments();
    const sample = await Listing.findOne().lean();
    res.json({
      count,
      hasSample: !!sample,
      sampleKeys: sample ? Object.keys(sample) : [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
