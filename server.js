import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import Listing from "./models/Listing.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================
// Middleware
// ==========================
app.use(
  cors({
    origin: [
      "http://localhost:5173",          // pentru test local
      "https://oltenitaimobiliare.ro", // pentru producție
    ],
    credentials: true,
  })
);

app.use(express.json());

// ==========================
// Multer - pentru upload imagini
// ==========================
const upload = multer({ dest: "uploads/" });

// ==========================
// Configurare Cloudinary
// ==========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================
// Conectare MongoDB
// ==========================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare MongoDB:", err));

// ==========================
// RUTE ANUNȚURI
// ==========================

// GET toate anunțurile
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// POST adaugă un nou anunț (cu imagini + body)
app.post("/api/listings", upload.array("images", 10), async (req, res) => {
  try {
    console.log("📥 Body primit:", req.body);
    console.log("📂 Fișiere primite:", req.files);

    // Upload imagini pe Cloudinary
    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "oltenitaimobiliare",
        });
        fs.unlinkSync(file.path); // ștergem fișierul local după upload
        return result.secure_url;
      })
    );

    const newListing = new Listing({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      location: req.body.location,
      images: uploadResults, // linkuri Cloudinary
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare la POST /api/listings:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// RUTE USERI
// ==========================

// Register user
app.post("/api/register", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: "Eroare la înregistrare", error: err });
  }
});

// Login user (simplu)
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password }); // ⚠️ folosește bcrypt în producție
    if (!user) {
      return res.status(401).json({ message: "Email sau parolă greșite" });
    }
    res.json({ message: "Login reușit", user });
  } catch (err) {
    res.status(500).json({ message: "Eroare la login", error: err });
  }
});

// ==========================
// START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
});
