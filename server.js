import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Listing from "./models/Listing.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "*",
  credentials: true
}));
app.use(express.json());

// 🔹 Configurare Multer (în memorie, nu pe disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 Configurare Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Conectare la MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Conectat la MongoDB Atlas"))
.catch((err) => console.error("❌ Eroare conectare MongoDB:", err));

// ---------- Rute ----------

// Test simplu
app.get("/", (req, res) => {
  res.send("🌍 API OltenitaImobiliare funcționează!");
});

// 🔹 Adaugă un anunț cu imagini
app.post("/api/listings", upload.array("images", 10), async (req, res) => {
  try {
    console.log("📥 Request primit la /api/listings");
    console.log("📝 Body:", req.body);
    console.log("📂 Fișiere:", req.files);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Nu s-au trimis imagini" });
    }

    // Upload direct din buffer în Cloudinary
    const uploadResults = await Promise.all(
      req.files.map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }).end(file.buffer);
        });
      })
    );

    console.log("☁️ Răspuns Cloudinary:", uploadResults);

    const newListing = new Listing({
      ...req.body,
      images: uploadResults.map(img => img.secure_url),
    });

    await newListing.save();
    res.status(201).json(newListing);

  } catch (err) {
    console.error("❌ Eroare la upload:", err);
    res.status(500).json({ error: err.message || "Eroare necunoscută la upload" });
  }
});

// 🔹 Obține toate anunțurile
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error("❌ Eroare la GET /api/listings:", err);
    res.status(500).json({ error: "Eroare la obținerea anunțurilor" });
  }
});

// ---------- Pornire server ----------
app.listen(PORT, () => {
  console.log(`✅ Server OltenitaImobiliare pornit pe portul ${PORT}`);
});
