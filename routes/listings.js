import express from "express";
import Listing from "../models/Listing.js";
import { verifyToken } from "../middleware/auth.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// Config upload memorie
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Adaugă un anunț nou
router.post("/", verifyToken, upload.array("images", 15), async (req, res) => {
  try {
    const imageUrls = [];

    if (req.files) {
      for (const file of req.files) {
        const uploadRes = await cloudinary.uploader.upload_stream({
          resource_type: "image",
        });
        imageUrls.push(uploadRes.secure_url);
      }
    }

    const listing = new Listing({
      ...req.body,
      images: imageUrls,
      user: req.user.id,
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    console.error("❌ Eroare la crearea anunțului:", err);
    res.status(500).json({ error: "Eroare server la crearea anunțului" });
  }
});

// ✅ Obține toate anunțurile
router.get("/", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la preluarea anunțurilor:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ✅ Obține anunțurile unui user
router.get("/my-listings", verifyToken, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la anunțurile userului:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ✅ Obține un anunț după ID
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu a fost găsit" });
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare la preluarea anunțului:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ✅ Căutare în baza de date (titlu, categorie, locație)
router.get("/search", async (req, res) => {
  try {
    const { title, category, location } = req.query;

    let filter = {};

    if (title) {
      filter.$or = [
        { title: { $regex: title, $options: "i" } },
        { description: { $regex: title, $options: "i" } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la search:", err);
    res.status(500).json({ error: "Eroare server la căutare" });
  }
});

// ✅ Editează un anunț
router.put("/:id", verifyToken, upload.array("images", 15), async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });
    if (listing.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Nu ai voie să editezi acest anunț" });

    let imageUrls = listing.images;

    if (req.files && req.files.length > 0) {
      imageUrls = [];
      for (const file of req.files) {
        const uploadRes = await cloudinary.uploader.upload_stream({
          resource_type: "image",
        });
        imageUrls.push(uploadRes.secure_url);
      }
    }

    listing.title = req.body.title || listing.title;
    listing.description = req.body.description || listing.description;
    listing.price = req.body.price || listing.price;
    listing.category = req.body.category || listing.category;
    listing.location = req.body.location || listing.location;
    listing.images = imageUrls;

    await listing.save();
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare la editare:", err);
    res.status(500).json({ error: "Eroare server la editare" });
  }
});

// ✅ Marchează ca rezervat
router.patch("/:id/rezervat", verifyToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    if (listing.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Nu ai voie să modifici acest anunț" });

    listing.rezervat = !listing.rezervat;
    await listing.save();

    res.json({ success: true, rezervat: listing.rezervat });
  } catch (err) {
    console.error("❌ Eroare la rezervare:", err);
    res.status(500).json({ error: "Eroare server la rezervare" });
  }
});

// ✅ Șterge un anunț
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Anunțul nu există" });

    if (listing.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Nu ai voie să ștergi acest anunț" });

    await listing.deleteOne();
    res.json({ message: "Anunț șters cu succes" });
  } catch (err) {
    console.error("❌ Eroare la ștergere:", err);
    res.status(500).json({ error: "Eroare server la ștergere" });
  }
});

export default router;
