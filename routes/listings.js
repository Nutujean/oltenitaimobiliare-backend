import express from "express";
import multer from "multer";
import Listing from "../models/Listing.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// multer pentru imagini
const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor" });
  }
});

// GET un anunț după id
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      "user",
      "name email"
    );
    if (!listing) return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare server la preluarea anunțului" });
  }
});

// POST adăugare anunț nou
router.post("/", authMiddleware, upload.array("images", 10), async (req, res) => {
  try {
    const { title, description, price, location, category } = req.body;

    // Upload pe Cloudinary
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oltenitaimobiliare" },
            (err, result) => {
              if (err) reject(err);
              else {
                imageUrls.push(result.secure_url);
                resolve();
              }
            }
          );
          stream.end(file.buffer);
        });
      }
    }

    const listing = new Listing({
      title,
      description,
      price,
      location,
      category,
      images: imageUrls,
      user: req.user.id,
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: "Eroare server la adăugarea anunțului" });
  }
});

// GET anunțurile utilizatorului logat
router.get("/my-listings", authMiddleware, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Eroare server la preluarea anunțurilor tale" });
  }
});

export default router;
