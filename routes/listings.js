import express from "express";
import Listing from "../models/Listing.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/listings
 * Filtre opționale:
 *  - category: potrivire exactă, case-insensitive (ex. "Apartamente")
 *  - q: căutare text în title/description (case-insensitive)
 *  - location: potrivire exactă, case-insensitive (ex. "Oltenita")
 *  - price: preț maxim (<=)
 *  - sort: latest | oldest | price_asc | price_desc
 * Include contactPhone: listing.phone || owner.phone
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

    const docs = await Listing.find(query)
      .populate({ path: "owner", select: "name phone" })
      .sort(sortObj);

    const data = docs.map((d) => {
      const o = d.toObject();
      o.contactPhone = o.phone || (o.owner && o.owner.phone) || null;
      return o;
    });

    res.json(data);
  } catch (err) {
    console.error("❌ Eroare GET /listings:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțurilor" });
  }
});

/**
 * GET /api/listings/:id
 * Include contactPhone: listing.phone || owner.phone
 */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Listing.findById(req.params.id)
      .populate({ path: "owner", select: "name phone" });

    if (!doc) return res.status(404).json({ error: "Anunțul nu există" });

    const o = doc.toObject();
    o.contactPhone = o.phone || (o.owner && o.owner.phone) || null;

    res.json(o);
  } catch (err) {
    console.error("❌ Eroare GET /listings/:id:", err);
    res.status(500).json({ error: "Eroare la preluarea anunțului" });
  }
});

/**
 * POST /api/listings
 * Dacă lipsește phone în body, îl completăm automat din profilul owner-ului.
 */
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };

    if (!body.phone && body.owner) {
      const ownerUser = await User.findById(body.owner).select("phone");
      if (ownerUser?.phone) {
        body.phone = ownerUser.phone;
      }
    }

    const newListing = new Listing(body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare POST /listings:", err);
    res.status(500).json({ error: "Eroare la adăugarea anunțului" });
  }
});

/**
 * PUT /api/listings/:id
 */
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

/**
 * DELETE /api/listings/:id
 */
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
