import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import Listing from "./models/Listing.js";

dotenv.config();
const app = express();

// ================== MIDDLEWARE ==================
app.use(express.json());

// ✅ CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://oltenitaimobiliare.ro"
    ],
    credentials: true,
  })
);

// ================== MONGODB ==================
mongoose
  .connect(process.env.MONGO_URI, { dbName: "oltenitaimobiliare" })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ================== CLOUDINARY ==================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "oltenitaimobiliare",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});
const upload = multer({ storage });

// ================== ROUTES ==================

// ➡️ Test root
app.get("/", (req, res) => {
  res.send("✅ Backend OltenitaImobiliare funcționează!");
});

// ➡️ Get all listings
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings:", err.message);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ➡️ Get listing by ID (⚡ ruta nouă!)
app.get("/api/listings/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există" });
    }
    res.json(listing);
  } catch (err) {
    console.error("❌ Eroare la GET /api/listings/:id:", err.message);
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// ➡️ Add new listing
app.post("/api/listings", upload.array("images", 15), async (req, res) => {
  try {
    const { title, description, price, category, location, phone, email } = req.body;

    const images = req.files.map((file) => file.path);

    const newListing = new Listing({
      title,
      description,
      price,
      category,
      location,
      phone,
      email,
      images,
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare POST /api/listings:", err.message);
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
});
