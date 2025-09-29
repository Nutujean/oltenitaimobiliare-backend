import express from "express";
import multer from "multer";
import Listing from "../models/Listing.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// Configurare multer - păstrăm fișierele în memorie pentru upload direct în Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta pentru adăugare anunț nou
router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    console.log("📥 BODY primit:", req.body);
    console.log("🖼️ FIȘIERE primite:", req.files?.length || 0);

    const listing = new Listing({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      location: req.body.location,
      user: req.body.user || null,
      images: [],
    });

    // Dacă avem fișiere, le urcăm pe Cloudinary
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oltenitaimobiliare" },
            (error, uploaded) => {
              if (error) reject(error);
              else resolve(uploaded);
            }
          );
          stream.end(file.buffer);
        });

        listing.images.push(result.secure_url);
      }
    }

    // Salvăm anunțul în MongoDB
    await listing.save();

    console.log("✅ Anunț salvat:", listing._id);
    res.status(201).json(listing);
  } catch (err) {
    console.error("❌ Eroare la salvarea anunțului:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ruta pentru listarea tuturor anunțurilor
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la obținerea anunțurilor:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
