// routes/listings.js
import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * GET /api/listings
 * Filtre: category, q, location, price, sort (latest|oldest|price_asc|price_desc)
 * Fără populate (safe-mode). contactPhone = listing.phone
 */
router.get("/", async (req, res) => {
  try {
    const { category, q, location, price, sort } = req.query;
    const query = {};

    if (category) query.category = { $regex: new RegExp("^" + category + "$", "i") };
    if (q) {
      const rx = new RegExp(q, "i");
      query.$or = [{ title: rx }, { description: rx }];
    }
    if (location) query.location = { $regex: new RegExp("^" + location + "$", "i") };
    if (price) {
      const max = Number(price);
      if (!Number.isNaN(max)) query.price = { ...(query.price || {}), $lte: max };
    }

    let sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    if (sort === "price_asc") sortObj = { price: 1, createdAt: -1 };
    if (sort === "price_desc") sortObj = { price: -1, createdAt: -1 };

    const docs = await Listing.find(query).sort(sortObj).lean();

    const data = docs.map((o) => ({
      ...o,
      contactPhone: o.phone || null,
    }));

    res.json(data);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/** 🔎 DEBUG – ATENȚIE: înainte de /:id ca să nu fie „înghițită” */
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

/**
 * GET /api/listings/:id — cu validare de ObjectId
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID invalid" });
    }
    const doc = await Listing.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Anunțul nu există" });

    const data = { ...doc, contactPhone: doc.phone || null };
    res.json(data);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

export default router;
