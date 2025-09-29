import express from "express";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

/** Helper */
const isValidId = (id) => mongoose.isValidObjectId(id);

/** GET /api/listings  (listare) */
router.get("/", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const items = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Eroare la listare", error: err.message });
  }
});

/** POST /api/listings  (creare) */
router.post("/", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const listing = await Listing.create({
      title: payload.title,
      description: payload.description,
      price: payload.price,
      imageUrl: payload.imageUrl,
      images: Array.isArray(payload.images) ? payload.images : [],
      status: payload.status || "disponibil",
      user: payload.user || undefined,
    });
    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ message: "Eroare la creare", error: err.message });
  }
});

/** GET /api/listings/:id  (detalii) */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "ID invalid" });

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: "Anunțul nu a fost găsit" });

    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Eroare la detalii", error: err.message });
  }
});

/** PUT /api/listings/:id  (actualizare totală/parțială) */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "ID invalid" });

    const updated = await Listing.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Anunțul nu a fost găsit" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Eroare la actualizare", error: err.message });
  }
});

/** PATCH /api/listings/:id/status  (update doar status) */
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!isValidId(id)) return res.status(400).json({ message: "ID invalid" });
    if (!status) return res.status(400).json({ message: "Status lipsă" });

    const updated = await Listing.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) return res.status(404).json({ message: "Anunțul nu a fost găsit" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Eroare la schimbarea statusului", error: err.message });
  }
});

/** DELETE /api/listings/:id  (ștergere) */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "ID invalid" });

    const deleted = await Listing.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Anunțul nu a fost găsit" });

    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    res.status(500).json({ message: "Eroare la ștergere", error: err.message });
  }
});

export default router;
