import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// 🟢 GET toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("Eroare GET /listings:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// 🟢 GET un anunț după ID
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există" });
    }
    res.json(listing);
  } catch (err) {
    console.error("Eroare GET /listings/:id:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// 🟢 POST un anunț nou
router.post("/", async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("Eroare POST /listings:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

export default router;
